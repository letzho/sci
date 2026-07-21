const ruleEngine = require('../services/ruleEngine');
const vectorStore = require('../services/vectorStore');
const {
  isComparisonQuery,
  inferCompareProductType,
  expandCompareSearchText,
  chunkLooksLikeComparisonTable,
} = require('../services/comparisonQuery');

/**
 * Knowledge Agent
 * ---------------
 * Retrieves approved, compliance-cleared talking points from the knowledge
 * base for the text + product context resolved by the NLU Agent.
 */

const AGENT_NAME = 'Knowledge Agent';

const DEFAULT_LIMIT = 5;
const LEARNED_STRONG_SCORE = 0.72;
const GENERIC_COMPARE_TOPICS = /^comparing (two )?(critical illness|life|shield|ilp|retirement)/i;

function hasComparisonLearned(learned) {
  return (learned || []).some(
    (l) => l.sourceType === 'url' || chunkLooksLikeComparisonTable(l.approvedMessage || l.plainEnglish)
  );
}

function filterGenericCompareApproved(approved, learned) {
  if (!hasComparisonLearned(learned)) return approved;
  return approved.filter((a) => !GENERIC_COMPARE_TOPICS.test(a.topic || ''));
}

/**
 * @param {{text: string, productType: ?string, limit?: number, preferLearned?: boolean}} input
 */
async function findTalkingPoints({ text, productType, limit = DEFAULT_LIMIT, preferLearned = false, agentId }) {
  const comparisonMode = isComparisonQuery(text);
  const searchProductType = comparisonMode ? inferCompareProductType(text, productType) : productType;
  const searchText = comparisonMode ? expandCompareSearchText(text, searchProductType) : text;

  const learnedLimit = comparisonMode || preferLearned ? limit : Math.max(limit, 4);
  const approvedCap = comparisonMode ? 1 : preferLearned ? Math.min(2, limit) : limit;

  // Thresholds tuned for text-embedding-3-small, whose relevant cosine scores
  // typically fall in ~0.35-0.55 — the old 0.65 floor silently dropped good
  // chunks and (returning [] not null) also skipped the keyword fallback.
  const semanticMin = comparisonMode ? 0.32 : 0.4;

  // Semantic search over-fetches so the hybrid merge below has candidates to rank.
  const semantic = await vectorStore.semanticSearch({
    text: searchText,
    productType: searchProductType,
    limit: learnedLimit + 3,
    minSimilarity: semanticMin,
    comparisonMode,
    agentId,
  });

  let learned;
  let learnedVia;
  if (semantic === null) {
    // Embeddings unavailable (no API key) — deterministic keyword matching only.
    learned = await ruleEngine.findLearnedTalkingPoints(searchText, searchProductType, learnedLimit, {
      comparisonMode,
      agentId,
    });
    learnedVia = 'keyword';
  } else {
    // Hybrid recall: keep semantic hits first (ranked by cosine), then backfill
    // with keyword-only matches the embedding missed. Chunks found by both are
    // already covered by the semantic entry, so we just skip the duplicate.
    const keyword = await ruleEngine.findLearnedTalkingPoints(searchText, searchProductType, learnedLimit + 3, {
      comparisonMode,
      agentId,
    });
    const semanticIds = new Set(semantic.map((s) => s.id));
    const keywordExtras = keyword.filter((k) => !semanticIds.has(k.id));
    learned = [...semantic, ...keywordExtras].slice(0, learnedLimit);
    learnedVia = keywordExtras.length ? 'hybrid' : 'semantic';
  }

  let approved = await ruleEngine.findTalkingPoints(text, searchProductType || productType, approvedCap);
  if (comparisonMode) {
    approved = filterGenericCompareApproved(approved, learned);
  }

  const strongLearned =
    comparisonMode && learned.length > 0
      ? hasComparisonLearned(learned)
      : preferLearned || (learned.length > 0 && learned[0].score >= LEARNED_STRONG_SCORE);

  const points = strongLearned
    ? [...learned, ...approved].slice(0, limit)
    : [...approved, ...learned].slice(0, limit);

  console.log(
    `[${AGENT_NAME}] retrieved ${approved.length} approved + ${learned.length} learned (via ${learnedVia}, learnedFirst=${strongLearned}, compareMode=${comparisonMode}) talking point(s) (returning ${points.length}) for productType=${
      searchProductType || productType || 'unscoped'
    }`
  );
  return points;
}

module.exports = { findTalkingPoints, AGENT_NAME, isComparisonQuery };
