const db = require('../db/connection');

/**
 * Deterministic rule/knowledge-base engine.
 *
 * This is the core, always-on guidance engine: it never calls the network,
 * never hallucinates, and always returns the same result for the same input.
 * It is the safety net underneath the optional OpenAI enhancement layer.
 */

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textContainsPhrase(haystackLower, phraseLower) {
  // Loose word-boundary match so "act now" matches inside a sentence,
  // but avoids matching inside unrelated longer words where practical.
  const pattern = new RegExp(`(^|\\W)${escapeRegex(phraseLower)}(\\W|$)`, 'i');
  return pattern.test(haystackLower);
}

/**
 * Finds compliance issues in a piece of text (something the rep said/typed).
 * Rules with product_type = NULL apply globally; rules scoped to a specific
 * product_type only apply when that product is the active context.
 */
async function findComplianceFlags(text, productType) {
  if (!text || !text.trim()) return [];
  const lower = text.toLowerCase();

  const rules = await db
    .prepare(`SELECT * FROM compliance_rules WHERE product_type IS NULL OR product_type = ?`)
    .all(productType || '__none__');

  const flags = [];
  for (const rule of rules) {
    if (textContainsPhrase(lower, rule.flagged_phrase.toLowerCase())) {
      flags.push({
        id: rule.id,
        phrase: rule.flagged_phrase,
        severity: rule.severity,
        reason: rule.reason,
        suggestedReplacement: rule.suggested_replacement,
      });
    }
  }
  return flags;
}

/**
 * Finds the best-matching approved knowledge base entries for a piece of text
 * (something the customer asked, or a topic the rep is discussing).
 * Scored by number of distinct keyword hits, scoped to the active product
 * when provided, otherwise searched across all products.
 */
async function findTalkingPoints(text, productType, limit = 3) {
  if (!text || !text.trim()) return [];
  const lower = text.toLowerCase();

  const entries = await (productType
    ? db.prepare(`SELECT * FROM knowledge_base WHERE product_type = ?`).all(productType)
    : db.prepare(`SELECT * FROM knowledge_base`).all());

  const scored = [];
  for (const entry of entries) {
    const keywords = entry.keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
    let score = 0;
    const matchedKeywords = [];
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        score += 1;
        matchedKeywords.push(kw);
      }
    }
    if (score > 0) {
      scored.push({
        id: entry.id,
        productType: entry.product_type,
        topic: entry.topic,
        approvedMessage: entry.approved_message,
        plainEnglish: entry.plain_english,
        matchedKeywords,
        score,
        source: 'approved',
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// Common short words excluded from the learned-document word-overlap
// matcher below, so two sentences sharing only "the", "is", "what" etc.
// don't count as a topical match.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'of', 'to', 'in', 'on', 'for', 'with', 'as', 'by', 'at',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he',
  'she', 'they', 'we', 'my', 'your', 'his', 'her', 'their', 'our', 'me', 'him', 'them', 'us', 'do', 'does', 'did',
  'can', 'could', 'will', 'would', 'should', 'shall', 'may', 'might', 'must', 'about', 'what', 'which', 'who', 'whom',
  'how', 'when', 'where', 'why', 'not', 'no', 'yes', 'so', 'than', 'too', 'very', 'just', 'also', 'have', 'has', 'had',
  'from', 'into', 'out', 'up', 'down', 'over', 'under', 'again', 'more', 'most', 'some', 'such', 'only', 'own', 'same',
  'there', 'here', 'please', 'thanks', 'thank', 'get', 'got', 'like', 'want', 'need', 'know',
]);

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function tokenMatches(queryToken, chunkToken) {
  if (queryToken === chunkToken) return true;
  if (queryToken.length > 3 && chunkToken.startsWith(queryToken)) return true;
  if (chunkToken.length > 3 && queryToken.startsWith(chunkToken)) return true;
  if (queryToken.endsWith('s') && queryToken.slice(0, -1) === chunkToken) return true;
  if (chunkToken.endsWith('s') && chunkToken.slice(0, -1) === queryToken) return true;
  return false;
}

function countSharedTokens(queryTokens, chunkTokens) {
  let shared = 0;
  const matched = [];
  for (const qt of queryTokens) {
    if (chunkTokens.some((ct) => tokenMatches(qt, ct))) {
      shared += 1;
      matched.push(qt);
    }
  }
  return { shared, matched };
}

const LEARNED_SELECT = `SELECT lc.*, ld.filename, ld.title, ld.source_type, ld.source_url
           FROM learned_chunks lc
           JOIN learned_documents ld ON ld.id = lc.document_id
           WHERE ld.status = 'active'`;

/**
 * Finds the best-matching chunks from agent-uploaded reference PDFs/URLs.
 * @param {{ comparisonMode?: boolean }} options
 */
async function findLearnedTalkingPoints(text, productType, limit = 4, options = {}) {
  const { comparisonMode = false, agentId } = options;
  if (!agentId) return [];
  if (!text || !text.trim()) return [];

  const queryTokens = new Set(tokenize(text));
  if (queryTokens.size === 0) return [];

  const { chunkLooksLikeComparisonTable } = require('./comparisonQuery');

  const agentClause = ` AND ld.agent_id = ?`;
  const baseParams = [agentId];

  // Comparison questions: search all products so a CI URL isn't hidden by session product type.
  const rows = await (comparisonMode || !productType
    ? db.prepare(`${LEARNED_SELECT}${agentClause}`).all(...baseParams)
    : db.prepare(`${LEARNED_SELECT}${agentClause} AND (lc.product_type IS NULL OR lc.product_type = ?)`).all(...baseParams, productType));

  const scored = [];
  for (const row of rows) {
    const chunkTokens = tokenize(row.content);
    const { shared, matched } = countSharedTokens([...queryTokens], chunkTokens);
    const isTableChunk = chunkLooksLikeComparisonTable(row.content);
    const minShared = comparisonMode && isTableChunk ? 1 : 2;

    if (shared >= minShared || (comparisonMode && isTableChunk && shared >= 1)) {
      let score = shared;
      if (row.source_type === 'url') score += 2;
      if (isTableChunk) score += 3;
      if (comparisonMode && /compare|comparison/i.test(row.title || row.filename || '')) score += 2;

      scored.push({
        id: row.id,
        productType: row.product_type,
        topic: row.topic,
        approvedMessage: row.content,
        plainEnglish: row.content.length > 420 ? `${row.content.slice(0, 417)}...` : row.content,
        matchedKeywords: matched,
        score,
        source: 'learned',
        sourceDocument: row.title || row.filename,
        sourceType: row.source_type || 'pdf',
        sourceUrl: row.source_url || null,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Single entry point: given a chunk of conversation text, return both the
 * relevant approved talking points and any compliance flags.
 */
async function matchGuidance(text, productType) {
  return {
    talkingPoints: await findTalkingPoints(text, productType),
    complianceFlags: await findComplianceFlags(text, productType),
  };
}

module.exports = { matchGuidance, findTalkingPoints, findLearnedTalkingPoints, findComplianceFlags };
