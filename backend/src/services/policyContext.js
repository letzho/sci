const db = require('../db/connection');

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
async function loadPolicyContext(conversationId) {
  if (!conversationId) return null;
  const row = await db
    .prepare(
      `SELECT filename, analysis_json FROM policy_uploads
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

  return {
    filename: row.filename,
    documentProductType,
    ...analysis,
  };
}

/** Customer message likely refers to the uploaded policy (not a generic product question). */
function messageAboutUploadedPolicy(message) {
  const m = (message || '').toLowerCase();
  return (
    /\b(policy|document|pdf|plan|cover|coverage|covered|this|upload|shared|hospital|hospitali[sz]ation|medical|shield|robbed|robbery|theft|stolen|admitted|ward|claim)\b/.test(
      m
    ) || m.includes('what does') || m.includes('what do')
  );
}

/** Turn Interpreter Agent output into talking-point shape for the Drafting Agent. */
function policyToTalkingPoints(policyContext) {
  if (!policyContext) return [];
  const doc = policyContext.filename || 'uploaded policy';
  const points = [];

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

  (policyContext.exclusionsOrGaps || []).slice(0, 3).forEach((text, i) => {
    points.push({
      id: `policy-ex-${i}`,
      topic: 'Exclusion / limitation (from customer document)',
      plainEnglish: text,
      approvedMessage: text,
      source: 'learned',
      sourceDocument: doc,
    });
  });

  if (policyContext.summary && points.length === 0) {
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
};
