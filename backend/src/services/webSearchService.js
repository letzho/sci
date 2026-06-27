require('dotenv').config();

/**
 * Web Search Service
 * -------------------
 * Thin wrapper around the Tavily search API (https://tavily.com), used only
 * as a last resort by the Research Agent (backend/src/agents/researchAgent.js)
 * when the local knowledge base (approved messaging + uploaded PDFs/URLs) is
 * too thin to answer a customer's question - e.g. general definitions, or
 * comparing publicly-known facts across different insurers' products.
 *
 * Same optional-layer pattern as openaiService.js: isEnabled() gates on
 * TAVILY_API_KEY, every call has a safe empty-array fallback, and a short
 * timeout keeps a slow/unreachable search from ever blocking a chat draft.
 */

const TIMEOUT_MS = 6000;

function isEnabled() {
  return Boolean(process.env.TAVILY_API_KEY);
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('web_search_timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * @param {string} query
 * @param {{maxResults?: number}} [opts]
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 *   Always resolves - never throws - so a missing key or network hiccup
 *   never blocks the chat-draft pipeline; it just means no web grounding.
 */
async function search(query, { maxResults = 4 } = {}) {
  if (!isEnabled() || !query || !query.trim()) return [];
  try {
    const res = await withTimeout(
      fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: 'basic',
          max_results: maxResults,
          include_answer: false,
        }),
      }),
      TIMEOUT_MS
    );

    if (!res.ok) throw new Error(`Tavily responded ${res.status}`);
    const data = await res.json();
    return (data.results || []).slice(0, maxResults).map((r) => ({
      title: r.title || null,
      url: r.url || null,
      snippet: (r.content || '').slice(0, 500),
    }));
  } catch (err) {
    console.warn('[webSearchService] search failed, continuing without web results:', err.message);
    return [];
  }
}

module.exports = { isEnabled, search };
