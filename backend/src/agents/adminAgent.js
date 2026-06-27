const db = require('../db/connection');
const { insertMessage, persistGuidanceResult } = require('../db/repo');

/**
 * Admin Agent
 * -----------
 * Bookkeeping/back-office stage of the pipeline: persists transcripts,
 * messages and guidance events, and computes the "measurable impact" metrics
 * shown on the dashboard - all from real usage data, never fabricated.
 * Every other agent is stateless; this is the only one that touches the DB.
 */

const AGENT_NAME = 'Admin Agent';

/**
 * Records a message/transcript row.
 */
async function logMessage({ conversationId, sender, kind = 'text', content }) {
  const message = await insertMessage({ conversationId, sender, kind, content });
  console.log(`[${AGENT_NAME}] recorded ${kind} message from ${sender} (conversation ${conversationId})`);
  return message;
}

/**
 * Persists a guidance result (talking points + compliance flags + optional
 * AI explainer) as individual guidance_events rows.
 */
async function logGuidance(conversationId, guidance) {
  const ids = await persistGuidanceResult(conversationId, guidance);
  console.log(`[${AGENT_NAME}] persisted ${ids.length} guidance event(s) for conversation ${conversationId}`);
  return ids;
}

/**
 * Computes the live "measurable impact" snapshot from real usage data.
 */
async function computeMetrics() {
  const totalConversations = (await db.prepare(`SELECT COUNT(*) AS n FROM conversations`).get()).n;

  const byChannelRows = await db
    .prepare(`SELECT channel, COUNT(*) AS n FROM conversations GROUP BY channel`)
    .all();
  const byChannel = byChannelRows.reduce((acc, r) => ({ ...acc, [r.channel]: r.n }), { face_to_face: 0, virtual_call: 0, chat: 0 });

  const totalTalkingPoints = (await db
    .prepare(`SELECT COUNT(*) AS n FROM guidance_events WHERE guidance_type = 'talking_point'`)
    .get()).n;

  const totalComplianceFlags = (await db
    .prepare(`SELECT COUNT(*) AS n FROM guidance_events WHERE guidance_type = 'compliance_flag'`)
    .get()).n;

  const flagsBySeverityRows = await db
    .prepare(
      `SELECT severity, COUNT(*) AS n FROM guidance_events WHERE guidance_type = 'compliance_flag' GROUP BY severity`
    )
    .all();
  const flagsBySeverity = flagsBySeverityRows.reduce((acc, r) => ({ ...acc, [r.severity]: r.n }), { high: 0, medium: 0, low: 0 });

  const topTopics = await db
    .prepare(
      `SELECT title, COUNT(*) AS n FROM guidance_events WHERE guidance_type = 'talking_point' GROUP BY title ORDER BY n DESC LIMIT 5`
    )
    .all();

  const topFlags = await db
    .prepare(
      `SELECT title, COUNT(*) AS n FROM guidance_events WHERE guidance_type = 'compliance_flag' GROUP BY title ORDER BY n DESC LIMIT 5`
    )
    .all();

  const totalMessages = (await db.prepare(`SELECT COUNT(*) AS n FROM messages`).get()).n;
  const draftsReviewed = (await db.prepare(`SELECT COUNT(*) AS n FROM messages WHERE kind = 'draft'`).get()).n;

  console.log(`[${AGENT_NAME}] computed impact metrics snapshot (${totalConversations} conversation(s))`);

  return {
    totalConversations,
    byChannel,
    totalTalkingPoints,
    totalComplianceFlags,
    flagsBySeverity,
    topTopics,
    topFlags,
    totalMessages,
    draftsReviewed,
  };
}

module.exports = { logMessage, logGuidance, computeMetrics, AGENT_NAME };
