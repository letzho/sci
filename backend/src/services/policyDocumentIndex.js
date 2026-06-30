const db = require('../db/connection');
const { genId } = require('../utils/idGen');
const { chunkText } = require('./documentService');
const openaiService = require('./openaiService');
const { cosineSimilarity } = require('./vectorStore');
const { cleanExtractedText, isReadableText } = require('./pdfTextQuality');

/**
 * Full-document index for customer-uploaded policy PDFs.
 * Chunks the entire extracted text (not just named sections) and optionally
 * embeds each chunk so any question can retrieve the relevant passages.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'of', 'to', 'in', 'on', 'for', 'with', 'as', 'by', 'at',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he',
  'she', 'they', 'we', 'my', 'your', 'his', 'her', 'their', 'our', 'me', 'him', 'them', 'us', 'do', 'does', 'did',
  'can', 'could', 'will', 'would', 'should', 'shall', 'may', 'might', 'must', 'about', 'what', 'which', 'who', 'whom',
  'how', 'when', 'where', 'why', 'not', 'no', 'yes', 'so', 'than', 'too', 'very', 'just', 'also', 'have', 'has', 'had',
  'from', 'into', 'out', 'up', 'down', 'over', 'under', 'again', 'more', 'most', 'some', 'such', 'only', 'own', 'same',
  'there', 'here', 'please', 'thanks', 'thank', 'get', 'got', 'like', 'want', 'need', 'know', 'many', 'much',
]);

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

async function getChunkCount(uploadId) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM policy_upload_chunks WHERE upload_id = ?`).get(uploadId);
  return row?.n || 0;
}

/**
 * Chunks and persists the full document text. Re-index replaces prior chunks.
 */
async function indexAndStore(uploadId, extractedText) {
  if (!uploadId || !extractedText?.trim()) return 0;

  const cleaned = cleanExtractedText(extractedText);
  const chunks = chunkText(cleaned);
  if (chunks.length === 0) return 0;

  await db.prepare(`DELETE FROM policy_upload_chunks WHERE upload_id = ?`).run(uploadId);

  const ids = chunks.map(() => genId('pchk'));
  await db.withTransaction(async (txDb) => {
    const insert = txDb.prepare(
      `INSERT INTO policy_upload_chunks (id, upload_id, chunk_index, topic, content) VALUES (?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < chunks.length; i += 1) {
      await insert.run(ids[i], uploadId, i, chunks[i].topic, chunks[i].content);
    }
  });

  for (let i = 0; i < ids.length; i += 1) {
    try {
      const vector = await openaiService.embedText(chunks[i].content);
      if (vector) {
        await db.prepare(`UPDATE policy_upload_chunks SET embedding = ? WHERE id = ?`).run(
          JSON.stringify(vector),
          ids[i]
        );
      }
    } catch (err) {
      console.warn('[policyDocumentIndex] embedding failed for one chunk, continuing:', err.message);
    }
  }

  console.log(`[policyDocumentIndex] indexed ${chunks.length} chunk(s) for upload ${uploadId}`);
  return chunks.length;
}

async function ensureIndexed(uploadId, extractedText) {
  const count = await getChunkCount(uploadId);
  if (count > 0) {
    const sample = await db
      .prepare(`SELECT content FROM policy_upload_chunks WHERE upload_id = ? ORDER BY chunk_index ASC LIMIT 1`)
      .get(uploadId);
    if (!sample?.content || isReadableText(sample.content, 0.45)) {
      return count;
    }
    console.log(`[policyDocumentIndex] re-indexing upload ${uploadId} — prior chunks looked garbled`);
  }
  if (!extractedText?.trim()) return 0;
  return indexAndStore(uploadId, extractedText);
}

function keywordSearch(rows, query, limit = 5) {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];

  const scored = [];
  for (const row of rows) {
    const chunkTokens = tokenize(row.content);
    const shared = chunkTokens.filter((t) => queryTokens.has(t));
    if (shared.length >= 1) {
      scored.push({
        topic: row.topic,
        content: row.content,
        score: shared.length,
        via: 'keyword',
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

async function semanticSearch(rows, query, limit = 5, minSimilarity = 0.58) {
  if (!openaiService.isEnabled() || !query?.trim()) return null;

  const queryVector = await openaiService.embedText(query);
  if (!queryVector) return null;

  const scored = [];
  for (const row of rows) {
    if (!row.embedding) continue;
    let vector;
    try {
      vector = JSON.parse(row.embedding);
    } catch {
      continue;
    }
    const similarity = cosineSimilarity(queryVector, vector);
    if (similarity >= minSimilarity) {
      scored.push({
        topic: row.topic,
        content: row.content,
        score: Number(similarity.toFixed(3)),
        via: 'semantic',
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Search all indexed chunks for passages relevant to the customer's question.
 */
async function searchPolicyChunks(uploadId, query, limit = 5) {
  if (!uploadId || !query?.trim()) return [];

  const rows = await db
    .prepare(`SELECT topic, content, embedding FROM policy_upload_chunks WHERE upload_id = ? ORDER BY chunk_index ASC`)
    .all(uploadId);

  if (rows.length === 0) return [];

  let results = await semanticSearch(rows, query, limit);
  if (results === null || results.length === 0) {
    results = keywordSearch(rows, query, limit);
  }
  if (results.length === 0) {
    results = keywordSearch(rows, query.split(/\s+/).slice(0, 6).join(' '), limit);
  }

  return results;
}

/**
 * Representative-facing preview: first N chunks from the full document.
 */
function buildDocumentSections(extractedText, max = 8) {
  return chunkText(cleanExtractedText(extractedText))
    .slice(0, max)
    .map((c) => ({
      topic: c.topic,
      preview: c.content.length > 160 ? `${c.content.slice(0, 157)}...` : c.content,
    }));
}

module.exports = {
  indexAndStore,
  ensureIndexed,
  getChunkCount,
  searchPolicyChunks,
  buildDocumentSections,
  keywordSearch,
};
