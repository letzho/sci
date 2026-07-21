const db = require('../db/connection');
const openaiService = require('./openaiService');

/**
 * Vector Store (RAG)
 * ------------------
 * A deliberately minimal local vector database: chunk embeddings live in
 * the `embedding` column of the existing `learned_chunks` table (JSON-encoded
 * float arrays), and similarity search is a plain cosine-similarity scan in
 * Node. No separate vector DB process to install or keep running alongside
 * the app - everything stays in the one SQLite file this project already
 * uses, which matters for a hackathon demo that needs to "just run".
 *
 * Fully optional: every function degrades to a safe no-op/null when
 * OPENAI_API_KEY isn't set (no embeddings can be computed), and callers
 * (backend/src/agents/knowledgeAgent.js) fall back to the deterministic
 * keyword-overlap matcher in ruleEngine.js in that case - semantic search
 * is an enhancement layer, never a hard dependency.
 */

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Embeds one chunk's text and persists the vector. Called right after a PDF
 * or URL is ingested (backend/src/services/documentService.js). Safe to
 * call even when embeddings are disabled - it just leaves the column NULL.
 * @returns {Promise<boolean>} whether an embedding was actually stored
 */
async function embedAndStoreChunk(chunkId, text) {
  if (!openaiService.isEnabled()) return false;
  const vector = await openaiService.embedText(text);
  if (!vector) return false;
  await db.prepare(`UPDATE learned_chunks SET embedding = ? WHERE id = ?`).run(JSON.stringify(vector), chunkId);
  return true;
}

/**
 * Semantic search over every embedded chunk from active, learned documents.
 * Mirrors the shape ruleEngine.findLearnedTalkingPoints returns so the two
 * are interchangeable to callers.
 *
 * @returns {Promise<?Array>} ranked matches, or `null` (not `[]`) when
 *   semantic search isn't available at all (no API key) - the `null` is the
 *   signal callers use to fall back to keyword matching instead of treating
 *   "no embeddings yet" the same as "no semantic match found".
 */
async function semanticSearch({ text, productType, limit = 4, minSimilarity = 0.65, comparisonMode = false, agentId }) {
  if (!openaiService.isEnabled() || !text || !text.trim() || !agentId) return null;

  const queryVector = await openaiService.embedText(text);
  if (!queryVector) return null;

  const { chunkLooksLikeComparisonTable } = require('./comparisonQuery');

  const agentClause = ` AND ld.agent_id = ?`;
  const baseParams = [agentId];

  const rows = await (comparisonMode || !productType
    ? db
        .prepare(
          `SELECT lc.*, ld.filename, ld.title, ld.source_type, ld.source_url
           FROM learned_chunks lc
           JOIN learned_documents ld ON ld.id = lc.document_id
           WHERE ld.status = 'active' AND lc.embedding IS NOT NULL${agentClause}`
        )
        .all(...baseParams)
    : db
        .prepare(
          `SELECT lc.*, ld.filename, ld.title, ld.source_type, ld.source_url
           FROM learned_chunks lc
           JOIN learned_documents ld ON ld.id = lc.document_id
           WHERE ld.status = 'active' AND lc.embedding IS NOT NULL${agentClause} AND (lc.product_type IS NULL OR lc.product_type = ?)`
        )
        .all(...baseParams, productType));

  if (rows.length === 0) return [];

  const effectiveMin = comparisonMode ? Math.min(minSimilarity, 0.58) : minSimilarity;

  const scored = [];
  for (const row of rows) {
    let vector;
    try {
      vector = JSON.parse(row.embedding);
    } catch {
      continue;
    }
    let similarity = cosineSimilarity(queryVector, vector);
    if (row.source_type === 'url') similarity += 0.04;
    if (chunkLooksLikeComparisonTable(row.content)) similarity += 0.05;

    if (similarity >= effectiveMin) {
      scored.push({
        id: row.id,
        productType: row.product_type,
        topic: row.topic,
        approvedMessage: row.content,
        plainEnglish: row.content.length > 420 ? `${row.content.slice(0, 417)}...` : row.content,
        matchedKeywords: [],
        score: Number(similarity.toFixed(3)),
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

module.exports = { cosineSimilarity, embedAndStoreChunk, semanticSearch };
