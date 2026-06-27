const express = require('express');
const db = require('../db/connection');
const { genId } = require('../utils/idGen');

const router = express.Router();

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

module.exports = router;
