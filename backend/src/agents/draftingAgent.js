const openaiService = require('../services/openaiService');

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
 * @param {{triggerText: string, productType: ?string, talkingPoints: Array, webResults?: Array}} input
 * @returns {Promise<?string>}
 */
async function enhanceGuidance({ triggerText, productType, talkingPoints, webResults = [] }) {
  if (!openaiService.isEnabled() || (talkingPoints.length === 0 && webResults.length === 0)) return null;
  const explainer = await openaiService.enhanceGuidance({ triggerText, productType, talkingPoints, webResults });
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
async function draftChatReply({ customerMessage, productType, talkingPoints, webResults = [], policyContext = null }) {
  let draftReply = null;
  let source = 'rule_engine';

  if (openaiService.isEnabled()) {
    draftReply = await openaiService.draftChatReply({
      customerMessage,
      productType,
      talkingPoints,
      webResults,
      policyContext,
    });
    if (draftReply) source = 'rule_engine+openai';
  }

  if (!draftReply) {
    if (policyContext) {
      const doc = policyContext.filename || 'your uploaded policy';
      const cov = policyContext.coverageHighlights?.[0];
      const excl = policyContext.exclusionsOrGaps?.[0];
      if (/rob|theft|stolen/.test(customerMessage.toLowerCase())) {
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
