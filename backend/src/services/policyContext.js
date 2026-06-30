const db = require('../db/connection');
const {
  ensureIndexed,
  searchPolicyChunks,
} = require('./policyDocumentIndex');
const {
  extractCompensationScale,
  matchCompensationToQuery,
} = require('./policyCompensationExtractor');
const { cleanExtractedText, salvageTableContent, buildMergedExtractionText } = require('./pdfTextQuality');
const {
  matchBenefitsToQuery,
  expandPolicySearchQuery,
  isDeathBenefitQuestion,
} = require('./policyBenefitMatcher');
const { getDeathBenefitAnswer } = require('./policyTierExtractor');

/** Infer product line from filename when the conversation context is wrong (e.g. life vs hospital). */
function inferDocumentProductType(filename, analysis) {
  const fn = (filename || '').toLowerCase();
  if (/hospital|shield|medishield|medical|hospitalisation|hospitalization/.test(fn)) {
    return 'integrated_shield_plan';
  }
  if (/personal.?accident|\bpa[\s_-]?assurance\b/.test(fn)) return 'personal_accident';
  if (/critical.?illness|\bci\b|ci_/.test(fn)) return 'critical_illness';
  if (/ilp|investment.?linked/.test(fn)) return 'ilp';
  if (/cpf|retirement/.test(fn)) return 'retirement_cpf';
  if (/life|term|whole.?life/.test(fn)) return 'life_insurance';
  return analysis?.productTypeGuess || null;
}

/**
 * Latest analyzed customer policy PDF for this conversation (Interpreter Agent output).
 */
/**
 * Best available text for table/benefit parsing — merges cleaned, salvaged, and raw.
 */
function getPolicyTextForParsing(policyContext) {
  const raw = policyContext.rawExtractedText || '';
  if (policyContext.extractedText?.trim()) {
    const salvaged = salvageTableContent(raw);
    return [policyContext.extractedText, salvaged].filter(Boolean).join('\n\n');
  }
  if (raw.trim()) {
    return buildMergedExtractionText(raw).text;
  }
  return '';
}

async function loadPolicyContext(conversationId) {
  if (!conversationId) return null;
  const row = await db
    .prepare(
      `SELECT id, filename, analysis_json, extracted_text, raw_extracted_text FROM policy_uploads
       WHERE conversation_id = ? AND status = 'analyzed' AND analysis_json IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(conversationId);

  if (!row?.analysis_json) return null;

  let analysis;
  try {
    analysis = JSON.parse(row.analysis_json);
  } catch {
    return null;
  }

  const documentProductType = inferDocumentProductType(row.filename, analysis);
  const rawExtractedText = row.raw_extracted_text || '';
  const extractedText = row.extracted_text?.trim()
    ? row.extracted_text
    : buildMergedExtractionText(rawExtractedText).text;

  return {
    ...analysis,
    uploadId: row.id,
    filename: row.filename,
    documentProductType,
    rawExtractedText,
    extractedText,
    compensationScale:
      analysis.compensationScale?.length > 0
        ? analysis.compensationScale
        : extractCompensationScale(extractedText),
  };
}

/**
 * Enrich policy context by searching the full indexed document for the question.
 */
async function enrichPolicyContextForQuestion(policyContext, customerMessage, recentHistory = []) {
  if (!policyContext) return null;

  const priorCustomer = (recentHistory || [])
    .filter((m) => m.sender === 'customer')
    .slice(-2)
    .map((m) => m.content)
    .join(' ');
  const combinedQuery = [customerMessage, priorCustomer].filter(Boolean).join(' ');

  const policyText = getPolicyTextForParsing(policyContext);
  await ensureIndexed(policyContext.uploadId, policyText);

  const benefitMatches = matchBenefitsToQuery(
    policyText,
    combinedQuery,
    policyContext.insuredPlanTier,
    policyContext.benefitTable
  );
  const searchQuery = expandPolicySearchQuery(combinedQuery);
  let relevantChunks = await searchPolicyChunks(policyContext.uploadId, searchQuery, 5);

  if (relevantChunks.length === 0 && isDeathBenefitQuestion(combinedQuery)) {
    relevantChunks = await searchPolicyChunks(
      policyContext.uploadId,
      'accidental death sum insured beneficiary Section 1',
      5
    );
  }

  const compensationMatches = matchCompensationToQuery(policyContext.compensationScale || [], combinedQuery);

  const relevantExcerpts = [
    ...benefitMatches,
    ...compensationMatches,
    ...relevantChunks.map((c) => c.content),
  ];

  return {
    ...policyContext,
    benefitMatches,
    relevantChunks,
    compensationMatches,
    relevantExcerpts: [...new Set(relevantExcerpts)],
  };
}

/** Customer message likely refers to the uploaded policy (not a generic product question). */
function messageAboutUploadedPolicy(message) {
  const m = (message || '').toLowerCase();
  return (
    /\b(policy|document|pdf|plan|cover|coverage|covered|this|upload|shared|hospital|hospitali[sz]ation|medical|shield|robbed|robbery|theft|stolen|admitted|ward|claim|limb|disability|percent|percentage)\b/.test(
      m
    ) || m.includes('what does') || m.includes('what do') || m.includes('how many') || m.includes('how much')
  );
}

/** Turn policy context + retrieved chunks into talking-point shape for the Drafting Agent. */
function policyToTalkingPoints(policyContext) {
  if (!policyContext) return [];
  const doc = policyContext.filename || 'uploaded policy';
  const points = [];

  (policyContext.benefitMatches || []).forEach((text, i) => {
    points.push({
      id: `policy-benefit-${i}`,
      topic: 'Benefit from customer policy (matched to question)',
      plainEnglish: text,
      approvedMessage: text,
      source: 'learned',
      sourceDocument: doc,
    });
  });

  if (points.length === 0 && policyContext.benefitTable?.accidental_death) {
    const deathAnswer = getDeathBenefitAnswer(
      getPolicyTextForParsing(policyContext),
      policyContext.insuredPlanTier,
      policyContext.benefitTable
    );
    if (deathAnswer) {
      points.push({
        id: 'policy-benefit-death-table',
        topic: 'Accidental death (Table of cover)',
        plainEnglish: deathAnswer,
        approvedMessage: deathAnswer,
        source: 'learned',
        sourceDocument: doc,
      });
    }
  }

  (policyContext.relevantChunks || []).forEach((chunk, i) => {
    const text = chunk.content.length > 320 ? `${chunk.content.slice(0, 317)}...` : chunk.content;
    points.push({
      id: `policy-chunk-${i}`,
      topic: chunk.topic || 'Policy document section',
      plainEnglish: text,
      approvedMessage: text,
      source: 'learned',
      sourceDocument: doc,
    });
  });

  (policyContext.compensationMatches || []).forEach((text, i) => {
    if (points.some((p) => p.plainEnglish.includes(text))) return;
    points.push({
      id: `policy-comp-match-${i}`,
      topic: 'Scale of compensation (from customer document)',
      plainEnglish: text,
      approvedMessage: text,
      source: 'learned',
      sourceDocument: doc,
    });
  });

  if (points.length === 0) {
    (policyContext.coverageHighlights || []).slice(0, 4).forEach((text, i) => {
      points.push({
        id: `policy-cov-${i}`,
        topic: policyContext.insuredPlanTier
          ? `Coverage (${policyContext.insuredPlanTier} plan, customer document)`
          : 'Coverage (from customer document)',
        plainEnglish: text,
        approvedMessage: text,
        source: 'learned',
        sourceDocument: doc,
      });
    });
  }

  if (points.length === 0 && policyContext.summary) {
    points.push({
      id: 'policy-summary',
      topic: 'Document summary',
      plainEnglish: policyContext.summary,
      approvedMessage: policyContext.summary,
      source: 'learned',
      sourceDocument: doc,
    });
  }

  return points;
}

module.exports = {
  loadPolicyContext,
  inferDocumentProductType,
  messageAboutUploadedPolicy,
  policyToTalkingPoints,
  enrichPolicyContextForQuestion,
  getPolicyTextForParsing,
};
