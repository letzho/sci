const { compile } = require('html-to-text');

/**
 * URL Fetch Service
 * -----------------
 * Lets a rep teach the Knowledge Agent from a pasted link instead of a PDF
 * (e.g. an insurer's public product page, MAS/CPF guidance, a news article
 * explaining a term). Fetches the page, strips it down to readable text the
 * same way a PDF gets extracted to text, so it can flow into the exact same
 * chunking + embedding pipeline (backend/src/services/documentService.js).
 *
 * Deliberately simple - no headless browser, no JS rendering - this reads
 * server-rendered HTML only, which covers most insurer/government info
 * pages. A direct link to a PDF is also supported (sniffed by content-type),
 * parsed via a lazy-required pdf-parse - the same library documentService.js
 * uses, kept separate here (rather than importing documentService) purely
 * to avoid a circular require between the two service modules.
 */

const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = 'Mozilla/5.0 (compatible; ClarityAI-KnowledgeBot/1.0; +https://www.scicollege.edu.sg)';

const htmlToPlainText = compile({
  wordwrap: false,
  selectors: [
    { selector: 'a', options: { ignoreHref: true } },
    { selector: 'img', format: 'skip' },
    { selector: 'script', format: 'skip' },
    { selector: 'style', format: 'skip' },
    { selector: 'nav', format: 'skip' },
    { selector: 'footer', format: 'skip' },
  ],
});

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('url_fetch_timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : null;
}

/**
 * @param {string} url
 * @returns {Promise<{text: string, title: ?string, pageCount: number}>}
 * @throws when the URL can't be reached or returns an unusable response -
 *   callers (documentService.ingestUrl) catch this and record status:'failed'.
 */
async function fetchAndExtract(url) {
  const res = await withTimeout(
    fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/pdf,*/*' }, redirect: 'follow' }),
    FETCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Could not reach this URL (HTTP ${res.status})`);

  const contentType = (res.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/pdf') || /\.pdf($|\?)/i.test(url)) {
    const pdfParse = require('pdf-parse');
    const buffer = Buffer.from(await res.arrayBuffer());
    const data = await pdfParse(buffer);
    return { text: data.text || '', title: null, pageCount: data.numpages || 0 };
  }

  const html = await res.text();
  const text = htmlToPlainText(html);
  return { text, title: extractTitle(html), pageCount: 0 };
}

module.exports = { fetchAndExtract };
