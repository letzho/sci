const ruleEngine = require('../services/ruleEngine');
const openaiService = require('../services/openaiService');
const { extractInsuredPlanTier, reconcileCoverageHighlights } = require('../services/policyTierExtractor');

/**
 * Interpreter Agent
 * -----------------
 * New pipeline stage that helps a representative quickly understand a
 * policy document a customer has shared via the chat channel. Given the
 * raw text extracted from that PDF (see backend/src/services/
 * documentService.js's extractText, reused as-is for this), it returns a
 * structured, plain-English breakdown for the rep's ChatReview screen.
 *
 * Same compliance boundary as every other agent in this pipeline: it only
 * ever describes what IS in the document, scoped to coverage / exclusions /
 * costs / cancellation terms it can find, plus clarifying questions the rep
 * could ask - it never evaluates, recommends, or advises. There is always a
 * deterministic, network-free rule-based result; the optional OpenAI layer
 * (backend/src/services/openaiService.js's interpretPolicy) only enhances
 * the summary/highlights/questions when available, and falls back cleanly
 * when it isn't.
 */

const AGENT_NAME = 'Interpreter Agent';

const SECTION_KEYWORDS = {
  coverage: ['sum assured', 'sum insured', 'coverage', 'covered', 'benefit', 'death benefit', 'payout', 'cash value', 'maturity', 'critical illness benefit'],
  exclusions: ['exclusion', 'not covered', 'waiting period', 'pre-existing', 'excluded', 'limitation', 'does not cover'],
  costs: ['premium', 'charge', 'fee', 'deductible', 'co-payment', 'copayment', 'sum payable'],
  cancellation: ['free-look', 'free look', 'surrender', 'cancellation', 'cooling-off', 'cooling off'],
};

function splitSentences(text) {
  return (text.match(/[^.!?\n]+[.!?]?/g) || []).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function findSentencesContaining(sentences, keywords, limit) {
  const hits = [];
  for (const s of sentences) {
    const lower = s.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) {
      hits.push(s.length > 200 ? `${s.slice(0, 197)}...` : s);
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

async function guessProductType(text) {
  const matches = await ruleEngine.findTalkingPoints(text, null, 1);
  return matches.length > 0 ? matches[0].productType : null;
}

/**
 * Deterministic, network-free baseline analysis. No network calls - it
 * issues one DB lookup (the product-type guess) so callers must await it.
 */
async function ruleBasedAnalysis(text, productType) {
  const sentences = splitSentences(text);
  const coverageHighlights = findSentencesContaining(sentences, SECTION_KEYWORDS.coverage, 4);
  const exclusionsOrGaps = findSentencesContaining(sentences, SECTION_KEYWORDS.exclusions, 4);
  const costNotes = findSentencesContaining(sentences, SECTION_KEYWORDS.costs, 3);
  const cancellationNotes = findSentencesContaining(sentences, SECTION_KEYWORDS.cancellation, 2);
  const resolvedProductType = productType || (await guessProductType(text));

  const summaryParts = [];
  if (coverageHighlights.length) summaryParts.push(`${coverageHighlights.length} coverage detail${coverageHighlights.length === 1 ? '' : 's'}`);
  if (exclusionsOrGaps.length) summaryParts.push(`${exclusionsOrGaps.length} exclusion/limitation note${exclusionsOrGaps.length === 1 ? '' : 's'}`);
  if (costNotes.length) summaryParts.push(`${costNotes.length} cost/premium note${costNotes.length === 1 ? '' : 's'}`);

  const summary = summaryParts.length
    ? `Scanned the document and found ${summaryParts.join(', ')}. Review the highlights below before the conversation.`
    : `Scanned the document but couldn't confidently match standard policy sections - it may be a scanned/image PDF or use unusual wording. Open the original file to review it directly.`;

  return {
    productTypeGuess: resolvedProductType || null,
    summary,
    coverageHighlights,
    exclusionsOrGaps,
    costNotes,
    cancellationNotes,
    suggestedQuestions: [],
  };
}

/**
 * @param {{text: string, productType: ?string}} input - extracted PDF text
 *   (backend/src/services/documentService.js's extractText) and the
 *   conversation's active product context, if any.
 * @returns {Promise<object>} structured analysis for the rep's ChatReview
 *   screen: { productTypeGuess, summary, coverageHighlights, exclusionsOrGaps,
 *   costNotes, cancellationNotes, suggestedQuestions, complianceFlags, source }
 */
async function analyzePolicyText({ text, productType }) {
  const cleaned = (text || '').trim();
  if (!cleaned) {
    return {
      productTypeGuess: productType || null,
      summary: 'No readable text was found in this document - it may be a scanned/image PDF.',
      coverageHighlights: [],
      exclusionsOrGaps: [],
      costNotes: [],
      cancellationNotes: [],
      suggestedQuestions: [],
      complianceFlags: [],
      source: 'rule_engine',
    };
  }

  const base = await ruleBasedAnalysis(cleaned, productType);
  const complianceFlags = await ruleEngine.findComplianceFlags(cleaned, base.productTypeGuess);
  const insuredPlanTier = extractInsuredPlanTier(cleaned);

  let aiResult = null;
  if (openaiService.isEnabled()) {
    aiResult = await openaiService.interpretPolicy({
      text: cleaned,
      productType: base.productTypeGuess,
      insuredPlanTier,
    });
  }

  const coverageHighlights = reconcileCoverageHighlights({
    text: cleaned,
    tier: insuredPlanTier,
    aiHighlights: aiResult?.coverageHighlights?.length ? aiResult.coverageHighlights : base.coverageHighlights,
  });

  const result = aiResult
    ? {
        productTypeGuess: base.productTypeGuess,
        insuredPlanTier,
        summary: aiResult.summary || base.summary,
        coverageHighlights,
        exclusionsOrGaps: aiResult.exclusionsOrGaps?.length ? aiResult.exclusionsOrGaps : base.exclusionsOrGaps,
        costNotes: base.costNotes,
        cancellationNotes: base.cancellationNotes,
        suggestedQuestions: aiResult.suggestedQuestions?.length ? aiResult.suggestedQuestions : [],
        complianceFlags,
        source: 'rule_engine+openai',
      }
    : {
        ...base,
        insuredPlanTier,
        coverageHighlights,
        complianceFlags,
        source: 'rule_engine',
      };

  console.log(
    `[${AGENT_NAME}] analyzed policy document (${cleaned.length} chars, productType=${result.productTypeGuess || 'unknown'}) via ${result.source}`
  );
  return result;
}

module.exports = { analyzePolicyText, AGENT_NAME };
