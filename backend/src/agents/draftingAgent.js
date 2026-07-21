const openaiService = require('../services/openaiService');
const { getDeathBenefitAnswer } = require('../services/policyTierExtractor');
const { getPolicyTextForParsing } = require('../services/policyContext');
const { isComparisonQuery, chunkLooksLikeComparisonTable } = require('../services/comparisonQuery');

const KNOWN_CI_PLANS = [
  'PRUActive Protect',
  'PRUCancer 360',
  'PRUEarly Stage Crisis Cover',
  'PRUMan',
  'PRULady',
  'PRUActive Crisis Guard',
];

function extractPlanNames(text) {
  const found = KNOWN_CI_PLANS.filter((name) => (text || '').includes(name));
  if (found.length >= 2) return found;
  const matches = [...(text || '').matchAll(/\b(PRU[A-Z][A-Za-z0-9 ]{2,28})\b/g)].map((m) => m[1].trim());
  return [...new Set(matches)].slice(0, 8);
}

function learnedComparisonPoints(talkingPoints) {
  return (talkingPoints || []).filter(
    (t) => t.source === 'learned' && (t.sourceType === 'url' || chunkLooksLikeComparisonTable(t.approvedMessage || t.plainEnglish))
  );
}

function buildCompareReplyFromLearned(learnedPoints) {
  const top = learnedPoints[0];
  const content = top.plainEnglish || top.approvedMessage || '';
  const plans = extractPlanNames(content);
  const src = top.sourceUrl || top.sourceDocument || 'our product reference';

  if (plans.length >= 2) {
    const planList = plans.join(', ');
    return `Thanks for asking! Based on ${src}, here are ${plans.length} critical illness plans you can compare: ${planList}. They differ on areas such as critical illness vs cancer-only cover, death benefit, total permanent disability, policy term, and whether premiums are waived after a claim. Your representative can walk through the side-by-side table with you and focus on the plans most relevant to you.`;
  }

  const excerpt = content.length > 400 ? `${content.slice(0, 397)}...` : content;
  return `Thanks for asking! From ${src}: ${excerpt} Let me know which plans you'd like to compare in more detail.`;
}

function isGenericCompareReply(text) {
  return /\b(factors like|useful reference points|side by side to help you understand|particular aspect.*interested in comparing)\b/i.test(
    text || ''
  );
}

/**
 * Drafting Agent
 * --------------
 * Turns the Knowledge Agent's approved talking points into customer-ready
 * language: a short plain-English explainer for live guidance, or a full
 * chat reply draft for human review. Uses the optional OpenAI layer when
 * enabled, and always has a deterministic, rule-engine-only fallback so a
 * missing API key or a network hiccup never blocks the rep.
 */

const AGENT_NAME = 'Drafting Agent';

/**
 * Plain-English explainer for live guidance (face-to-face / virtual call).
 * Always attempts an explainer when OpenAI is on — even with zero matched
 * talking points — so a question the knowledge base doesn't directly cover
 * (e.g. "what insurance do I have?") still gives the rep something useful,
 * grounded in the customer's own policies.
 * @param {{triggerText: string, productType: ?string, talkingPoints: Array, webResults?: Array, customerContext?: ?string}} input
 * @returns {Promise<?string>}
 */
async function enhanceGuidance({ triggerText, productType, talkingPoints, webResults = [], customerContext = null }) {
  if (!openaiService.isEnabled()) return null;
  const explainer = await openaiService.enhanceGuidance({ triggerText, productType, talkingPoints, webResults, customerContext });
  console.log(`[${AGENT_NAME}] ${explainer ? 'produced AI explainer' : 'AI explainer unavailable, using approved message only'}`);
  return explainer;
}

/**
 * Full chat reply draft for human review. Never deflects to "ask a
 * supervisor" or "check the product summary" - when there's genuinely
 * nothing to ground an answer in (no approved/learned talking points, no
 * web results), the fallback asks one clarifying question instead, so the
 * conversation keeps moving and the rep knows exactly what to pull up.
 * @returns {Promise<{draftReply: string, source: 'rule_engine'|'rule_engine+openai'}>}
 */
async function draftChatReply({
  customerMessage,
  productType,
  talkingPoints,
  webResults = [],
  policyContext = null,
  recentHistory = [],
  compareQuestion = false,
}) {
  const compareMode = compareQuestion || isComparisonQuery(customerMessage);
  const comparisonLearned = learnedComparisonPoints(talkingPoints);

  let draftReply = null;
  let source = 'rule_engine';

  if (openaiService.isEnabled()) {
    draftReply = await openaiService.draftChatReply({
      customerMessage,
      productType,
      talkingPoints,
      webResults,
      policyContext,
      recentHistory,
      compareQuestion: compareMode,
    });
    if (draftReply) source = 'rule_engine+openai';
  }

  if (
    draftReply &&
    policyContext &&
    /\b(does not specify|doesn't specify|not specify any benefit|no benefits related to death|does not mention)\b/i.test(draftReply)
  ) {
    draftReply = null;
  }

  if (draftReply && compareMode && comparisonLearned.length > 0) {
    const namesPlans = extractPlanNames(comparisonLearned.map((p) => p.approvedMessage).join(' '));
    if ((isGenericCompareReply(draftReply) || (namesPlans.length >= 2 && !namesPlans.some((n) => draftReply.includes(n.split(' ')[0])))) ) {
      draftReply = null;
    }
  }

  if (!draftReply) {
    if (compareMode && comparisonLearned.length > 0) {
      draftReply = buildCompareReplyFromLearned(comparisonLearned);
    } else if (policyContext) {
      const doc = policyContext.filename || 'your uploaded policy';
      const benefit = policyContext.benefitMatches?.[0];
      const comp = policyContext.compensationMatches?.[0];
      const cov = policyContext.coverageHighlights?.[0];
      const excl = policyContext.exclusionsOrGaps?.[0];
      if (benefit) {
        draftReply = `Thanks for asking! Under "${doc}", the document states: ${benefit}${policyContext.benefitMatches.length > 1 ? ` Related details: ${policyContext.benefitMatches.slice(1, 3).join('; ')}.` : ''} Your representative can confirm how this applies to your enrolled plan tier.`;
      } else if (comp) {
        draftReply = `Thanks for asking! According to "${doc}", the policy states: ${comp}${policyContext.compensationMatches.length > 1 ? ` (also: ${policyContext.compensationMatches.slice(1).join('; ')})` : ''}. Let me know if you'd like to review any other benefit.`;
      } else if (policyContext.relevantChunks?.length) {
        const top = policyContext.relevantChunks[0];
        draftReply = `Thanks for asking! From "${doc}": ${top.content.length > 220 ? `${top.content.slice(0, 217)}...` : top.content} Let me know if you'd like to go through another section together.`;
      } else if (/die|death|beneficiar/.test(customerMessage.toLowerCase())) {
        const deathAnswer = getDeathBenefitAnswer(
          getPolicyTextForParsing(policyContext),
          policyContext.insuredPlanTier,
          policyContext.benefitTable
        );
        if (deathAnswer) {
          draftReply = `Thanks for asking! Under "${doc}": ${deathAnswer} Your representative can confirm how this applies to your specific situation.`;
        } else {
          draftReply = `Thanks for asking! Your policy document is on file — accidental death / beneficiary payouts are usually under Section 1 (Accidental death) and the sum insured in the Table of cover. The PDF text did not extract cleanly enough for me to quote the exact amount here, but your representative can read that section with you from the original document.`;
        }
      } else if (/rob|theft|stolen/.test(customerMessage.toLowerCase())) {
        draftReply = `Thanks for asking! Based on "${doc}", this appears to be a hospital/medical care policy — theft or robbery is typically not covered under hospitalisation plans unless explicitly listed. ${excl ? `The document notes: ${excl}` : ''} Could you confirm whether you're asking about this medical policy or a separate home/travel plan?`;
      } else if (cov) {
        draftReply = `Thanks for sharing "${doc}". From what I can see in the document: ${cov} ${excl ? `One limitation to note: ${excl}` : ''} Let me know which part you'd like to go through together.`;
      } else {
        draftReply = `Thanks for sharing "${doc}". ${policyContext.summary || "I have reviewed the document and can walk through the coverage details with you."} Which benefit would you like to clarify first?`;
      }
    } else if (talkingPoints.length > 0) {
      draftReply = `Thanks for asking! ${talkingPoints[0].plainEnglish} Let me know if you'd like me to go through the details together.`;
    } else if (webResults.length > 0) {
      const firstFact = webResults[0].snippet.split(/(?<=[.!?])\s/)[0];
      draftReply = `Thanks for asking! ${firstFact} Could you let me know which policy or plan you'd like this checked against, so I can pull up the exact details?`;
    } else {
      draftReply = `That's a great question. Could you tell me a bit more about which benefit, policy, or scenario you mean? I'll pull up the exact details for you.`;
    }
  }

  console.log(`[${AGENT_NAME}] drafted chat reply via ${source}${policyContext ? ' (policy-grounded)' : ''}`);
  return { draftReply, source };
}

module.exports = { enhanceGuidance, draftChatReply, AGENT_NAME };
