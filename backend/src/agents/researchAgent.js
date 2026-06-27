const webSearchService = require('../services/webSearchService');

/**
 * Research Agent
 * ---------------
 * The "go find out" layer. The Knowledge Agent only ever returns what's
 * already in the curated knowledge base or something the rep has
 * uploaded/taught it (PDF or pasted URL) - it never makes anything up. But a
 * customer's question is sometimes broader than that: general
 * product-category facts, how a term is commonly defined, or a side-by-side
 * of how another insurer's product is typically structured. For those
 * moments this agent fires a live web search (Tavily) so the AI has
 * *something* concrete and current to ground its answer in, instead of
 * deflecting with "ask your supervisor" or "check the product summary".
 *
 * Guardrails baked in here, reinforced again in openaiService's system
 * prompt:
 *  - Only triggers when the Knowledge Agent's grounding is "thin" (no
 *    approved-tier match) - curated, compliance-cleared messaging always
 *    wins when it exists; the web is a fallback, never a replacement.
 *  - Every result keeps its source URL so the rep/AI can cite "from the web"
 *    rather than presenting it as house messaging.
 *  - This agent never advises, ranks, or recommends - it only retrieves
 *    public facts. The representative is still the human in the loop who
 *    talks the customer through what it means; the AI's job is just to keep
 *    the conversation moving with real information instead of deflecting.
 *  - Disabled cleanly (returns []) whenever TAVILY_API_KEY isn't set, or
 *    whenever the search itself fails - never throws, never blocks the rest
 *    of the guidance pipeline.
 */

const AGENT_NAME = 'Research Agent';

/**
 * Curated/learned grounding counts as "solid" only if at least one
 * approved-tier (compliance-cleared) talking point matched. Approved and
 * learned/semantic results live on different scoring scales (keyword counts
 * vs. cosine similarity vs. word overlap) so rather than normalize them all
 * onto one threshold, the simplest reliable signal is: did the strongest,
 * pre-approved tier find anything at all. If not, it's worth supplementing.
 */
function isGroundingThin(talkingPoints) {
  if (!talkingPoints || talkingPoints.length === 0) return true;
  return !talkingPoints.some((tp) => tp.source === 'approved');
}

function buildQuery({ text, productType }) {
  const scope = productType ? `${productType} insurance` : 'insurance';
  return `${text} ${scope} Singapore`.trim();
}

/**
 * @param {{text: string, productType: ?string, talkingPoints: Array}} input
 * @returns {Promise<Array<{title: ?string, url: ?string, snippet: string}>>}
 *   Always resolves - [] when disabled, grounding is already solid, or the
 *   search fails. Never throws.
 */
async function supplement({ text, productType, talkingPoints }) {
  if (!webSearchService.isEnabled()) return [];
  if (!text || !text.trim()) return [];
  if (!isGroundingThin(talkingPoints)) return [];

  const query = buildQuery({ text, productType });
  const results = await webSearchService.search(query, { maxResults: 4 });

  console.log(
    `[${AGENT_NAME}] grounding was thin, searched the web ("${query}") -> ${results.length} result(s)`
  );
  return results;
}

module.exports = { supplement, isGroundingThin, AGENT_NAME };
