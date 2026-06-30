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
async function findTalkingPoints({ text, productType, limit = DEFAULT_LIMIT, preferLearned = false }) {
  const comparisonMode = isComparisonQuery(text);
  const searchProductType = comparisonMode ? inferCompareProductType(text, productType) : productType;
  const searchText = comparisonMode ? expandCompareSearchText(text, searchProductType) : text;

  const learnedLimit = comparisonMode || preferLearned ? limit : Math.max(limit, 4);
  const approvedCap = comparisonMode ? 1 : preferLearned ? Math.min(2, limit) : limit;

  let learned = await vectorStore.semanticSearch({
    text: searchText,
    productType: searchProductType,
    limit: learnedLimit,
    minSimilarity: comparisonMode ? 0.58 : 0.65,
    comparisonMode,
  });
  let learnedVia = 'semantic';
  if (learned === null) {
    learned = await ruleEngine.findLearnedTalkingPoints(searchText, searchProductType, learnedLimit, {
      comparisonMode,
    });
    learnedVia = 'keyword';
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
