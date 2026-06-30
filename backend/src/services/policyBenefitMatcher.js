/**
 * Matches customer questions to benefit passages in an uploaded policy —
 * accidental death, sum insured, tier table amounts, etc.
 */

const {
  extractInsuredPlanTier,
  buildTierCoverageHighlights,
  getDeathBenefitAnswer,
} = require('./policyTierExtractor');
const { extractCompensationScale, matchCompensationToQuery } = require('./policyCompensationExtractor');

function isHowMuchQuestion(query) {
  return /\b(how much|how many|what amount|what is the|payout|pay out|receive|get paid)\b/i.test(query || '');
}
function isDeathBenefitQuestion(query) {
  return /\b(die|died|death|deceased|pass away|beneficiar|fatal|funeral)\b/i.test(query || '');
}

function isDisabilityQuestion(query) {
  return /\b(disabilit|limb|amputat|paralys|paralyz|percent|percentage)\b/i.test(query || '');
}

function normalizeExcerpt(text, max = 520) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 3)}...` : cleaned;
}

function extractAccidentalDeathPassages(text) {
  const results = [];
  const patterns = [
    /section\s*1[^\n]{0,120}accidental\s+death[\s\S]{0,2200}/gi,
    /accidental\s+death[\s\S]{0,1800}?(?=section\s*[2-9]|scale\s+of\s+compensation|$)/gi,
    /double\s+indemnity[\s\S]{0,1200}?(?=section\s*[3-9]|$)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const excerpt = normalizeExcerpt(match[0]);
      if (excerpt.length >= 40) results.push(excerpt);
    }
  }
  return results;
}

function extractSumInsuredMentions(text) {
  const results = [];
  const re = /sum\s+(?:assured|insured)[^.!?\n]{0,220}/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const excerpt = normalizeExcerpt(match[0], 280);
    if (excerpt.length >= 20) results.push(excerpt);
  }
  return results;
}

/**
 * @returns {string[]} factual snippets from the full policy text for this question
 */
function matchBenefitsToQuery(text, query, insuredPlanTier = null, benefitTable = null) {
  if (!text?.trim() && !benefitTable) return [];

  const tier = insuredPlanTier || extractInsuredPlanTier(text);
  const results = [];
  const q = query.toLowerCase();

  if (
    isDeathBenefitQuestion(query) ||
    (isHowMuchQuestion(query) && /plan|beneficiar|die|death|cover|policy/.test(q))
  ) {
    const deathAnswer = getDeathBenefitAnswer(text, tier, benefitTable);
    if (deathAnswer) results.push(deathAnswer);

    const tierHighlights = buildTierCoverageHighlights(text, tier);
    tierHighlights
      .filter((h) => /accidental death|double indemnity/i.test(h))
      .forEach((h) => results.push(h));

    extractAccidentalDeathPassages(text).forEach((p) => results.push(p));
    extractSumInsuredMentions(text).forEach((p) => results.push(p));

    const scale = extractCompensationScale(text);
    scale
      .filter((e) => /permanent total disability/i.test(e.label))
      .forEach((e) => results.push(`${e.text} (note: this is disability compensation, not death benefit)`));
  }

  if (isDisabilityQuestion(query)) {
    const scale = extractCompensationScale(text);
    matchCompensationToQuery(scale, query).forEach((r) => results.push(r));

    const tierHighlights = buildTierCoverageHighlights(text, tier);
    tierHighlights
      .filter((h) => /disability|medical expenses/i.test(h))
      .forEach((h) => results.push(h));

    const disabilityBlock = text.match(/(?:section\s*3[^\n]{0,80}permanent\s+disability|scale\s+of\s+compensation)[\s\S]{0,2500}/i);
    if (disabilityBlock) results.push(normalizeExcerpt(disabilityBlock[0]));
  }

  if (/medical|hospital|injur|admit|ward/.test(q)) {
    const tierHighlights = buildTierCoverageHighlights(text, tier);
    tierHighlights
      .filter((h) => /medical expenses/i.test(h))
      .forEach((h) => results.push(h));
  }

  if (/premium|cost|pay|fee|charge/.test(q)) {
    const premium = text.match(/(?:premium|payment frequency|sum payable)[^.!?\n]{0,200}/gi);
    if (premium) premium.slice(0, 3).forEach((p) => results.push(normalizeExcerpt(p, 200)));
  }

  return [...new Set(results)].slice(0, 6);
}

function expandPolicySearchQuery(query) {
  const parts = [query];
  const q = (query || '').toLowerCase();
  if (isDeathBenefitQuestion(query)) {
    parts.push('accidental death sum insured beneficiary payout benefit amount Section 1');
  }
  if (isDisabilityQuestion(query)) {
    parts.push('permanent disability scale of compensation percentage sum insured');
  }
  if (/under this plan|this plan|my plan/.test(q)) {
    parts.push('table of cover plan benefits sum insured');
  }
  return parts.join(' ');
}

module.exports = {
  isDeathBenefitQuestion,
  matchBenefitsToQuery,
  expandPolicySearchQuery,
};
