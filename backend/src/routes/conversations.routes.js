const express = require('express');
const db = require('../db/connection');
const { genId } = require('../utils/idGen');
const openaiService = require('../services/openaiService');
const { buildRecapContext } = require('../services/comprehensionService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Reset THIS agent's demo data — deletes their conversations (messages,
 * guidance, and uploaded policy docs cascade via FK). Seeded customers,
 * policies and knowledge base are untouched, and other testers' sessions are
 * unaffected, so each tester can get a clean slate without stepping on others.
 */
router.post('/reset', requireAuth, async (req, res) => {
  try {
    const info = await db.prepare(`DELETE FROM conversations WHERE agent_id = ?`).run(req.agent.id);
    res.json({ ok: true, deleted: info.changes ?? 0 });
  } catch (err) {
    console.error('[conversations.routes] /reset error:', err);
    res.status(500).json({ error: 'Failed to reset demo data' });
  }
});

const RECAP_LANGS = ['en', 'zh', 'ms', 'ta'];

/** Deterministic Clarity Recap when OpenAI is off — built from logged topics. */
function buildDeterministicRecap(context, customerName) {
  const name = customerName ? customerName.split(' ')[0] : 'there';
  return {
    greeting: `Hi ${name}, here's a quick recap of what we went through today.`,
    explained: context.topicsCovered.length
      ? context.topicsCovered.slice(0, 8)
      : ['We talked through your questions and the relevant product information.'],
    stillUnclear: context.confusedMoments.slice(0, 4),
    sources: [...new Set(context.sources)].map((s) =>
      s === 'learned' ? 'your uploaded documents' : s === 'rule_engine' ? 'approved product messaging' : s
    ),
    nextSteps: ['Review this summary at your own pace.', 'Note any questions and we can go through them next time.'],
    language: 'en',
  };
}

const VALID_CHANNELS = ['face_to_face', 'virtual_call', 'chat'];

function mapConversation(row) {
  return {
    id: row.id,
    agentId: row.agent_id,
    customerId: row.customer_id,
    channel: row.channel,
    productContext: row.product_context,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

/**
 * Creates a conversation, or returns the existing active one for the same
 * agent + customer + channel. This lets the Agent Console and the Client
 * Portal each call this endpoint independently (no manual room codes to
 * type/copy) and still land on the exact same conversation/room id.
 */
router.post('/start', async (req, res) => {
  const { agentId, customerId, channel, productType } = req.body || {};
  if (!agentId || !customerId || !channel) {
    return res.status(400).json({ error: 'agentId, customerId and channel are required' });
  }
  if (!VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: `channel must be one of ${VALID_CHANNELS.join(', ')}` });
  }

  const agent = await db.prepare(`SELECT id FROM agents WHERE id = ?`).get(agentId);
  if (!agent) return res.status(401).json({ error: 'Agent session expired — please sign out and sign in again' });
  const customer = await db.prepare(`SELECT id FROM customers WHERE id = ?`).get(customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  let convo = await db
    .prepare(
      `SELECT * FROM conversations WHERE agent_id = ? AND customer_id = ? AND channel = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`
    )
    .get(agentId, customerId, channel);

  if (!convo) {
    const id = genId('conv');
    await db.prepare(
      `INSERT INTO conversations (id, agent_id, customer_id, channel, product_context, status) VALUES (?, ?, ?, ?, ?, 'active')`
    ).run(id, agentId, customerId, channel, productType || null);
    convo = await db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id);
  } else if (productType && productType !== convo.product_context) {
    await db.prepare(`UPDATE conversations SET product_context = ? WHERE id = ?`).run(productType, convo.id);
    convo = await db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(convo.id);
  }

  res.json({ conversation: mapConversation(convo) });
});

router.get('/', async (req, res) => {
  const { agentId, customerId, status } = req.query;
  let sql = `SELECT * FROM conversations WHERE 1=1`;
  const params = [];
  if (agentId) {
    sql += ` AND agent_id = ?`;
    params.push(agentId);
  }
  if (customerId) {
    sql += ` AND customer_id = ?`;
    params.push(customerId);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY started_at DESC`;
  const rows = await db.prepare(sql).all(...params);
  res.json({ conversations: rows.map(mapConversation) });
});

/**
 * Session history for the signed-in rep — every past conversation (active AND
 * ended) with the customer name and how much was recorded, so nothing is lost
 * from view once a session is ended. Declared before '/:id' so the literal
 * path isn't swallowed by the id param route.
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const rows = await db
      .prepare(
        `SELECT c.*, cu.name AS customer_name, cu.avatar_emoji AS customer_emoji,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
                (SELECT COUNT(*) FROM guidance_events g WHERE g.conversation_id = c.id) AS guidance_count
         FROM conversations c
         LEFT JOIN customers cu ON cu.id = c.customer_id
         WHERE c.agent_id = ?
         ORDER BY COALESCE(c.ended_at, c.started_at) DESC
         LIMIT 100`
      )
      .all(req.agent.id);

    res.json({
      sessions: rows.map((r) => ({
        ...mapConversation(r),
        customerName: r.customer_name,
        customerEmoji: r.customer_emoji,
        messageCount: Number(r.message_count || 0),
        guidanceCount: Number(r.guidance_count || 0),
      })),
    });
  } catch (err) {
    console.error('[conversations.routes] /history error:', err);
    res.status(500).json({ error: 'Failed to load session history' });
  }
});

router.get('/:id', async (req, res) => {
  const convo = await db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(req.params.id);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  const messageRows = await db
    .prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`)
    .all(convo.id);
  const messages = messageRows.map((m) => ({ id: m.id, sender: m.sender, kind: m.kind, content: m.content, createdAt: m.created_at }));

  const guidanceRows = await db
    .prepare(`SELECT * FROM guidance_events WHERE conversation_id = ? ORDER BY created_at ASC`)
    .all(convo.id);
  const guidanceEvents = guidanceRows.map((g) => ({
    id: g.id,
    triggerText: g.trigger_text,
    guidanceType: g.guidance_type,
    productType: g.product_type,
    title: g.title,
    content: g.content,
    severity: g.severity,
    source: g.source,
    accepted: Boolean(g.accepted),
    createdAt: g.created_at,
  }));

  res.json({ conversation: mapConversation(convo), messages, guidanceEvents });
});

router.post('/:id/end', async (req, res) => {
  const convo = await db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(req.params.id);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  await db.prepare(`UPDATE conversations SET status = 'ended', ended_at = ${db.NOW_EXPR} WHERE id = ?`).run(convo.id);
  const updated = await db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(convo.id);
  res.json({ conversation: mapConversation(updated) });
});

/**
 * Clarity Recap: a compliance-safe end-of-session summary the rep reviews and
 * shares with the customer (what was explained, what's still unclear, sources).
 * ?lang=en|zh|ms|ta translates the customer-facing recap. AI-enhanced with a
 * deterministic fallback so it always returns something useful.
 */
router.get('/:id/recap', async (req, res) => {
  const convo = await db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(req.params.id);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  const language = RECAP_LANGS.includes(req.query.lang) ? req.query.lang : 'en';
  const customer = await db.prepare(`SELECT name FROM customers WHERE id = ?`).get(convo.customer_id);

  try {
    const context = await buildRecapContext(db, convo.id);

    let recap = await openaiService.generateClarityRecap({ context, language });
    let source = 'ai';
    if (!recap) {
      recap = buildDeterministicRecap(context, customer?.name);
      // Best-effort translation of the deterministic recap when a non-English language is requested.
      if (language !== 'en') {
        const translated = await openaiService.translateRecap({ recap, language });
        if (translated) recap = translated;
      }
      source = 'deterministic';
    }

    res.json({
      recap,
      language,
      source,
      meta: { topicsCovered: context.topicsCovered.length, confusedMoments: context.confusedMoments.length },
    });
  } catch (err) {
    console.error('[conversations.routes] /recap error:', err);
    res.status(500).json({ error: 'Failed to generate recap' });
  }
});

module.exports = router;
