const db = require('./connection');
const { genId } = require('../utils/idGen');

/**
 * Small shared persistence helpers used by both the REST routes and the
 * Socket.io handlers, so the two real-time entry points (HTTP for
 * Face-to-Face, sockets for Virtual Call / Chat) never duplicate SQL.
 */

async function insertMessage({ conversationId, sender, kind = 'text', content }) {
  const id = genId('msg');
  await db.prepare(
    `INSERT INTO messages (id, conversation_id, sender, kind, content) VALUES (?, ?, ?, ?, ?)`
  ).run(id, conversationId, sender, kind, content);
  return db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id);
}

/**
 * Persists a guidance result (talking points + compliance flags + optional
 * AI explainer) returned by the agent pipeline's orchestrator as individual
 * guidance_events rows, for later review / the metrics dashboard. Called via
 * the Admin Agent (backend/src/agents/adminAgent.js), which is the only
 * agent allowed to touch the database.
 */
async function persistGuidanceResult(conversationId, guidance) {
  const rows = [];
  const stmt = db.prepare(`
    INSERT INTO guidance_events
      (id, conversation_id, trigger_text, guidance_type, product_type, title, content, severity, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const tp of guidance.talkingPoints) {
    const id = genId('ge');
    await stmt.run(id, conversationId, guidance.triggerText, 'talking_point', guidance.productType, tp.topic, tp.approvedMessage, 'info', guidance.source);
    rows.push(id);
  }

  for (const flag of guidance.complianceFlags) {
    const id = genId('ge');
    await stmt.run(
      id,
      conversationId,
      guidance.triggerText,
      'compliance_flag',
      guidance.productType,
      flag.phrase,
      `${flag.reason} Suggested: ${flag.suggestedReplacement}`,
      flag.severity,
      'rule_engine'
    );
    rows.push(id);
  }

  if (guidance.aiExplainer) {
    const id = genId('ge');
    await stmt.run(id, conversationId, guidance.triggerText, 'explainer', guidance.productType, 'AI explainer', guidance.aiExplainer, 'info', guidance.source);
    rows.push(id);
  }

  return rows;
}

module.exports = { insertMessage, persistGuidanceResult };
