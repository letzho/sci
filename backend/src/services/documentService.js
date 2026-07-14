const db = require('../db/connection');
const { genId } = require('../utils/idGen');
const urlFetchService = require('./urlFetchService');
const vectorStore = require('./vectorStore');
const { cleanExtractedText, assessExtractionQuality, filterReadableChunks, buildMergedExtractionText } = require('./pdfTextQuality');

/**
 * Document Service
 * ----------------
 * Lets an agent "teach" the Knowledge Agent by uploading a PDF (e.g. a
 * product summary, fact sheet, or fund prospectus). The file is parsed into
 * plain text, split into short chunks, and stored alongside (but clearly
 * separate from) the curated `knowledge_base` table.
 *
 * Important: this does NOT touch the curated, pre-approved knowledge_base
 * table, and does not retrain/fine-tune any model. It only gives the rule
 * engine (backend/src/services/ruleEngine.js) a second, transparently
 * labelled pool of reference material to match against - every chunk
 * retrieved downstream carries source: 'learned' plus the originating
 * filename, so a rep (and a compliance reviewer) can always tell approved
 * messaging apart from agent-uploaded reference material.
 */

const MAX_CHUNK_LEN = 700;
const MIN_CHUNK_LEN = 40;
const MAX_CHUNKS_PER_DOC = 80;
const CHUNK_OVERLAP_CHARS = 160;

function normalizeText(raw) {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}

function deriveTopic(paragraph) {
  const firstSentence = paragraph.split(/(?<=[.!?])\s/)[0] || paragraph;
  return firstSentence.length > 70 ? `${firstSentence.slice(0, 67)}...` : firstSentence;
}

/**
 * Splits raw extracted PDF text into short, topic-tagged chunks suitable
 * for keyword/word-overlap matching. Pure function - no DB access - so it
 * can be unit tested directly.
 */
function chunkText(rawText) {
  const text = normalizeText(rawText);
  if (!text) return [];
  const paragraphs = splitIntoParagraphs(text);

  const chunks = [];
  let buffer = '';

  function flush() {
    const trimmed = buffer.trim();
    if (trimmed.length >= MIN_CHUNK_LEN) {
      chunks.push({ topic: deriveTopic(trimmed), content: trimmed });
    }
    buffer = '';
  }

  for (const para of paragraphs) {
    if (para.length > MAX_CHUNK_LEN) {
      flush();
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sBuf = '';
      for (const s of sentences) {
        if (`${sBuf} ${s}`.trim().length > MAX_CHUNK_LEN) {
          if (sBuf.trim()) chunks.push({ topic: deriveTopic(sBuf.trim()), content: sBuf.trim() });
          sBuf = s;
        } else {
          sBuf = sBuf ? `${sBuf} ${s}` : s;
        }
      }
      if (sBuf.trim()) chunks.push({ topic: deriveTopic(sBuf.trim()), content: sBuf.trim() });
      continue;
    }

    if (`${buffer}\n\n${para}`.trim().length > MAX_CHUNK_LEN) {
      flush();
      buffer = para;
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }
  flush();

  return addChunkOverlap(filterReadableChunks(chunks).slice(0, MAX_CHUNKS_PER_DOC));
}

/**
 * Returns the trailing ~maxChars of a chunk, trimmed to start on a sentence
 * boundary where possible, for use as overlap context on the next chunk.
 */
function chunkTail(text, maxChars) {
  const trimmed = (text || '').trim();
  if (trimmed.length <= maxChars) return trimmed;
  const tail = trimmed.slice(trimmed.length - maxChars);
  const boundary = tail.search(/[.!?]\s/);
  return boundary >= 0 ? tail.slice(boundary + 2).trim() : tail.trim();
}

/**
 * Prepends a short slice of the previous chunk to each chunk so a fact split
 * across a boundary (e.g. a benefit named in one chunk, its amount in the
 * next) still embeds and matches together. `topic` stays derived from the
 * chunk's own opening sentence, so provenance labels remain accurate.
 */
function addChunkOverlap(chunks) {
  if (chunks.length < 2) return chunks;
  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const overlap = chunkTail(chunks[i - 1].content, CHUNK_OVERLAP_CHARS);
    return overlap ? { topic: chunk.topic, content: `${overlap} ${chunk.content}` } : chunk;
  });
}

/**
 * Extracts raw text from a PDF buffer. Lazy-requires pdf-parse so a missing
 * dependency only breaks the upload path, never the rest of the app.
 */
async function extractText(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  const raw = data.text || '';
  const { text, cleaned, salvaged } = buildMergedExtractionText(raw);
  const extractionQuality = assessExtractionQuality(raw, cleaned);
  if (salvaged) {
    extractionQuality.salvagedTableLines = true;
  }
  return { text, rawText: raw, pageCount: data.numpages || 0, extractionQuality };
}

function mapDocument(row) {
  return {
    id: row.id,
    agentId: row.agent_id,
    productType: row.product_type,
    filename: row.filename,
    title: row.title,
    pageCount: row.page_count,
    chunkCount: row.chunk_count,
    status: row.status,
    error: row.error,
    sourceType: row.source_type || 'pdf',
    sourceUrl: row.source_url || null,
    createdAt: row.created_at,
  };
}

async function getDocument(id) {
  const row = await db.prepare(`SELECT * FROM learned_documents WHERE id = ?`).get(id);
  return row ? mapDocument(row) : null;
}

async function listDocuments({ productType } = {}) {
  const rows = await (productType
    ? db.prepare(`SELECT * FROM learned_documents WHERE product_type = ? ORDER BY created_at DESC`).all(productType)
    : db.prepare(`SELECT * FROM learned_documents ORDER BY created_at DESC`).all());
  return rows.map(mapDocument);
}

async function deleteDocument(id) {
  const info = await db.prepare(`DELETE FROM learned_documents WHERE id = ?`).run(id);
  return info.changes > 0;
}

/**
 * Parses + chunks an uploaded PDF and persists it. Always resolves (never
 * throws) - failures are recorded on the document row as status: 'failed'
 * so the upload UI can show a clear error instead of a generic 500.
 */
async function ingestDocument({ buffer, filename, productType, agentId }) {
  const docId = genId('doc');
  await db.prepare(
    `INSERT INTO learned_documents (id, agent_id, product_type, filename, title, status)
     VALUES (?, ?, ?, ?, ?, 'processing')`
  ).run(docId, agentId || null, productType || null, filename, filename.replace(/\.pdf$/i, ''));

  try {
    const { text, pageCount } = await extractText(buffer);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await db.prepare(`UPDATE learned_documents SET status = 'failed', error = ?, page_count = ? WHERE id = ?`).run(
        'No extractable text found - the PDF may be scanned/image-only.',
        pageCount,
        docId
      );
      return getDocument(docId);
    }

    const chunkIds = await insertChunks(docId, productType, chunks);

    await db.prepare(`UPDATE learned_documents SET status = 'active', page_count = ?, chunk_count = ? WHERE id = ?`).run(
      pageCount,
      chunks.length,
      docId
    );
    await embedChunks(chunkIds, chunks);
    return getDocument(docId);
  } catch (err) {
    await db.prepare(`UPDATE learned_documents SET status = 'failed', error = ? WHERE id = ?`).run(
      String(err && err.message ? err.message : err),
      docId
    );
    return getDocument(docId);
  }
}

/**
 * Same ingestion pipeline as ingestDocument above, but starting from a URL
 * a rep pasted in instead of an uploaded file (backend/src/services/
 * urlFetchService.js does the fetch + HTML-to-text work). Kept as a
 * separate function rather than branching ingestDocument because the
 * source-fetching step is different enough (network fetch + content-type
 * sniffing vs. a multer-buffered file) to stay clearer as two functions.
 */
async function ingestUrl({ url, productType, agentId }) {
  const docId = genId('doc');
  await db.prepare(
    `INSERT INTO learned_documents (id, agent_id, product_type, filename, title, status, source_type, source_url)
     VALUES (?, ?, ?, ?, ?, 'processing', 'url', ?)`
  ).run(docId, agentId || null, productType || null, url, null, url);

  try {
    const { text, title } = await urlFetchService.fetchAndExtract(url);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await db.prepare(`UPDATE learned_documents SET status = 'failed', error = ? WHERE id = ?`).run(
        'No extractable text found at this URL - it may be JS-rendered, behind a login, or a scanned/image PDF.',
        docId
      );
      return getDocument(docId);
    }

    const chunkIds = await insertChunks(docId, productType, chunks);

    let resolvedTitle = title;
    if (!resolvedTitle) {
      try {
        resolvedTitle = new URL(url).hostname;
      } catch {
        resolvedTitle = url;
      }
    }

    await db.prepare(`UPDATE learned_documents SET status = 'active', title = ?, chunk_count = ? WHERE id = ?`).run(
      resolvedTitle,
      chunks.length,
      docId
    );
    await embedChunks(chunkIds, chunks);
    return getDocument(docId);
  } catch (err) {
    await db.prepare(`UPDATE learned_documents SET status = 'failed', error = ? WHERE id = ?`).run(
      String(err && err.message ? err.message : err),
      docId
    );
    return getDocument(docId);
  }
}

/**
 * Shared by both ingest paths: inserts the chunk rows in one transaction and
 * returns the generated chunk ids in the same order as `chunks`, so the
 * caller can embed each one afterwards.
 */
async function insertChunks(docId, productType, chunks) {
  const ids = chunks.map(() => genId('chk'));
  await db.withTransaction(async (txDb) => {
    const insertChunk = txDb.prepare(
      `INSERT INTO learned_chunks (id, document_id, product_type, topic, content) VALUES (?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < chunks.length; i += 1) {
      await insertChunk.run(ids[i], docId, productType || null, chunks[i].topic, chunks[i].content);
    }
  });
  return ids;
}

/**
 * Embeds each freshly-inserted chunk for semantic search
 * (backend/src/services/vectorStore.js). Sequential, not Promise.all, to
 * stay gentle on the embeddings API rate limit for documents with many
 * chunks; safe to await even when embeddings are disabled (no-ops fast).
 * Never throws - a failed embedding pass still leaves a fully usable,
 * keyword-searchable document, it just won't get a semantic-search boost.
 */
async function embedChunks(chunkIds, chunks) {
  for (let i = 0; i < chunkIds.length; i += 1) {
    try {
      await vectorStore.embedAndStoreChunk(chunkIds[i], chunks[i].content);
    } catch (err) {
      console.warn('[documentService] embedding failed for one chunk, continuing:', err.message);
    }
  }
}

module.exports = { ingestDocument, ingestUrl, listDocuments, getDocument, deleteDocument, chunkText, extractText };
