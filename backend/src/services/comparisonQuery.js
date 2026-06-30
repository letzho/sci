/**
 * Detects product-comparison questions and infers which product line the
 * customer is asking about — used to widen learned-document retrieval.
 */

const COMPARE_PATTERN =
  /\b(compare|comparison|versus|vs\.?|difference between|which is better|side by side|how do .+ differ|different .+ plan)\b/i;

const PRODUCT_HINTS = [
  { type: 'critical_illness', pattern: /critical illness|\bci\b|cancer cover|early.?stage/i },
  { type: 'integrated_shield_plan', pattern: /shield|medishield|hospital|ward class|integrated shield/i },
  { type: 'life_insurance', pattern: /life insurance|term life|whole life|death benefit|sum assured/i },
  { type: 'ilp', pattern: /investment.?linked|\bilp\b|fund/i },
  { type: 'retirement_cpf', pattern: /retirement|cpf life|payout/i },
];

const COMPARISON_TABLE_SIGNALS =
  /PRU\w+|\bcompare\b|comparison table|critical illnesses coverage|cancer coverage|policy term|premium waiver|conditions covered/i;

function isComparisonQuery(text) {
  return COMPARE_PATTERN.test(text || '');
}

function inferCompareProductType(text, sessionProductType = null) {
  const t = text || '';
  for (const { type, pattern } of PRODUCT_HINTS) {
    if (pattern.test(t)) return type;
  }
  return sessionProductType;
}

function chunkLooksLikeComparisonTable(content) {
  return COMPARISON_TABLE_SIGNALS.test(content || '');
}

/** Enrich query for embedding search when user asks to compare plans. */
function expandCompareSearchText(text, productType) {
  const parts = [text];
  if (productType === 'critical_illness') {
    parts.push('compare critical illness plans PRUActive PRUCancer coverage table');
  }
  return parts.filter(Boolean).join(' ');
}

module.exports = {
  isComparisonQuery,
  inferCompareProductType,
  chunkLooksLikeComparisonTable,
  expandCompareSearchText,
};
