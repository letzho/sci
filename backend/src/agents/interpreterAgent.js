const ruleEngine = require('../services/ruleEngine');
const openaiService = require('../services/openaiService');
const { extractInsuredPlanTier, reconcileCoverageHighlights, parseBenefitTableByTier } = require('../services/policyTierExtractor');
const {
  extractCompensationScale,
  compensationHighlightsFromScale,
} = require('../services/policyCompensationExtractor');
const { buildDocumentSections } = require('../services/policyDocumentIndex');
const { chunkText } = require('../services/documentService');

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

async function guessProductType(text) {
  const matches = await ruleEngine.findTalkingPoints(text, null, 1);
  return matches.length > 0 ? matches[0].productType : null;
}

/**
 * Deterministic baseline: indexes the full document into sections (chunk
 * previews) rather than hunting only for named keyword sections.
 */
async function ruleBasedAnalysis(text, productType) {
  const allChunks = chunkText(text);
  const documentSections = buildDocumentSections(text, 10);
  const resolvedProductType = productType || (await guessProductType(text));

  const summary =
    allChunks.length > 0
      ? `Indexed ${allChunks.length} section(s) from the full policy document for question-time retrieval. Preview key sections below before the conversation.`
      : `Scanned the document but couldn't extract readable sections - it may be a scanned/image PDF or use unusual wording. Open the original file to review it directly.`;

  return {
    productTypeGuess: resolvedProductType || null,
    summary,
    documentChunkCount: allChunks.length,
    documentSections,
    coverageHighlights: documentSections.map((s) => `${s.topic}: ${s.preview}`),
    exclusionsOrGaps: [],
    costNotes: [],
    cancellationNotes: [],
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
async function analyzePolicyText({ text, productType, extractionQuality = null }) {
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
  const compensationScale = extractCompensationScale(cleaned);
  const compensationHighlights = compensationHighlightsFromScale(compensationScale, 10);

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

  let benefitTable = parseBenefitTableByTier(cleaned);
  if (!benefitTable?.accidental_death && openaiService.isEnabled()) {
    const llmTable = await openaiService.extractPolicyBenefitTable(cleaned);
    if (llmTable && Object.keys(llmTable).length > 0) {
      benefitTable = { ...benefitTable, ...llmTable };
    }
  }

  const result = aiResult
    ? {
        productTypeGuess: base.productTypeGuess,
        insuredPlanTier,
        summary: extractionQuality?.warning
          ? `${aiResult.summary || base.summary} ${extractionQuality.warning}`
          : aiResult.summary || base.summary,
        documentChunkCount: base.documentChunkCount,
        documentSections: base.documentSections,
        extractionQuality,
        coverageHighlights,
        exclusionsOrGaps: aiResult.exclusionsOrGaps?.length ? aiResult.exclusionsOrGaps : base.exclusionsOrGaps,
        costNotes: base.costNotes,
        cancellationNotes: base.cancellationNotes,
        suggestedQuestions: aiResult.suggestedQuestions?.length ? aiResult.suggestedQuestions : [],
        compensationScale,
        compensationHighlights,
        benefitTable,
        complianceFlags,
        source: 'rule_engine+openai',
      }
    : {
        ...base,
        insuredPlanTier,
        coverageHighlights,
        compensationScale,
        compensationHighlights,
        benefitTable,
        complianceFlags,
        extractionQuality,
        summary: extractionQuality?.warning ? `${base.summary} ${extractionQuality.warning}` : base.summary,
        source: 'rule_engine',
      };

  console.log(
    `[${AGENT_NAME}] analyzed policy document (${cleaned.length} chars, productType=${result.productTypeGuess || 'unknown'}) via ${result.source}`
  );
  return result;
}

module.exports = { analyzePolicyText, AGENT_NAME };
