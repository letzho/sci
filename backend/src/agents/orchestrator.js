const nluAgent = require('./nluAgent');
const knowledgeAgent = require('./knowledgeAgent');
const complianceAgent = require('./complianceAgent');
const draftingAgent = require('./draftingAgent');
const researchAgent = require('./researchAgent');
const { loadPolicyContext, policyToTalkingPoints, enrichPolicyContextForQuestion } = require('../services/policyContext');
const { loadRecentChatHistory } = require('../db/repo');
const { isComparisonQuery, inferCompareProductType } = require('../services/comparisonQuery');
const { isClarifyRequest } = require('../services/comprehensionService');

/**
 * Orchestrator
 * ------------
 * Coordinates the agent pipeline for the two AI-driven flows in the app:
 *
 *   Live guidance (face-to-face / virtual call):
 *     NLU Agent -> Knowledge Agent -> Research Agent -> Compliance Agent -> Drafting Agent
 *
 *   Chat draft (chat channel):
 *     NLU Agent -> Knowledge Agent -> Research Agent -> Compliance Agent -> Drafting Agent
 *
 * The Research Agent only ever contributes when the Knowledge Agent's
 * grounding came back thin (see researchAgent.isGroundingThin) - it's a
 * fallback for "the customer asked something broader than our knowledge
 * base/uploaded material covers", not a replacement for approved messaging.
 *
 * (The Admin Agent is invoked separately by the routes/sockets layer once it
 * has the result, so persistence stays out of the AI pipeline itself.)
 *
 * Public contract is intentionally unchanged from the previous single-file
 * aiOrchestrator.js: getLiveGuidance({text, productType}) and
 * getChatDraft({customerMessage, productType}) return the exact same shape
 * the frontend (GuidancePanel, ChatReview) and routes already expect, with
 * additive fields (`intent`, `webResults`) layered on top.
 */

const AGENT_NAME = 'Orchestrator';

/** Short deterministic cue for the rep when the AI layer is off and nothing matched. */
function buildFallbackExplainer({ text, customerContext, productType }) {
  const t = (text || '').toLowerCase();
  if (customerContext && /\b(what|which).*(insurance|cover|policy|policies|plan|have|got)\b/.test(t)) {
    return `The customer is asking about their own cover. On file they have: ${customerContext}. Walk them through what each of these policies covers.`;
  }
  if (/\b(issue|problem|gap|missing|enough|cover enough|covered)\b/.test(t)) {
    return `They're asking whether their cover has gaps. Review what they hold${customerContext ? ` (${customerContext})` : ''} and note which common areas — life, hospital/Shield, critical illness, retirement — aren't covered yet, as neutral discussion points.`;
  }
  const label = productType ? productType.replace(/_/g, ' ') : 'this topic';
  return `No approved talking point matched exactly. Answer from what you know about ${label}, or ask one clarifying question to pull up the right detail — keep the conversation moving.`;
}

async function getLiveGuidance({ text, productType, customerContext = null, agentId }) {
  const compareQuestion = isComparisonQuery(text);
  const nlu = await nluAgent.analyze({
    text,
    productType: compareQuestion ? inferCompareProductType(text, productType) : productType,
  });
  const talkingPoints = await knowledgeAgent.findTalkingPoints({
    text: nlu.text,
    productType: nlu.productType,
    preferLearned: compareQuestion,
    limit: compareQuestion ? 8 : 5,
    agentId,
  });
  const complianceFlags = await complianceAgent.checkCompliance({ text: nlu.text, productType: nlu.productType });
  const webResults = await researchAgent.supplement({ text: nlu.text, productType: nlu.productType, talkingPoints });

  // Always try for an explainer — even when nothing matched — so the rep is
  // never left with a bare "Heard: …" and no help. Grounded in the customer's
  // own policies when the question is about what they have.
  let aiExplainer = await draftingAgent.enhanceGuidance({
    triggerText: nlu.text,
    productType: nlu.productType,
    talkingPoints,
    webResults,
    customerContext,
  });

  // Deterministic fallback (OpenAI off, or the call failed) so there is always
  // a useful cue on screen.
  if (!aiExplainer && talkingPoints.length === 0) {
    aiExplainer = buildFallbackExplainer({ text: nlu.text, customerContext, productType: nlu.productType });
  }

  console.log(
    `[${AGENT_NAME}] live guidance pipeline complete - ${talkingPoints.length} talking point(s), ${webResults.length} web result(s), ${complianceFlags.length} flag(s), explainer=${Boolean(aiExplainer)}`
  );

  return {
    triggerText: text,
    productType: nlu.productType || null,
    intent: nlu.intent,
    talkingPoints,
    webResults,
    complianceFlags,
    aiExplainer,
    source: aiExplainer ? 'rule_engine+openai' : 'rule_engine',
    generatedAt: new Date().toISOString(),
  };
}

async function getChatDraft({ customerMessage, productType, conversationId, agentId }) {
  const rawPolicyContext = conversationId ? await loadPolicyContext(conversationId) : null;
  const hasPolicyDoc = Boolean(rawPolicyContext);
  const recentHistory = conversationId ? await loadRecentChatHistory(conversationId, 6) : [];
  const policyContext = hasPolicyDoc
    ? await enrichPolicyContextForQuestion(rawPolicyContext, customerMessage, recentHistory)
    : null;

  const compareQuestion = isComparisonQuery(customerMessage);

  // Once a customer policy PDF is uploaded, keep grounding on it — except for
  // explicit product-comparison questions (e.g. CI plan table from Knowledge Library URL).
  const effectiveProductType = compareQuestion
    ? inferCompareProductType(customerMessage, productType)
    : hasPolicyDoc && rawPolicyContext?.documentProductType
      ? rawPolicyContext.documentProductType
      : productType;

  const nlu = await nluAgent.analyze({ text: customerMessage, productType: effectiveProductType });

  let talkingPoints = await knowledgeAgent.findTalkingPoints({
    text: nlu.text,
    productType: nlu.productType,
    preferLearned: hasPolicyDoc || compareQuestion,
    limit: compareQuestion ? 8 : 6,
    agentId,
  });

  if (hasPolicyDoc && !compareQuestion) {
    const policyPoints = policyToTalkingPoints(policyContext);
    talkingPoints = [...policyPoints, ...talkingPoints].slice(0, 8);
  }

  const complianceFlags = await complianceAgent.checkCompliance({ text: nlu.text, productType: nlu.productType });

  let webResults = [];
  if (!hasPolicyDoc || compareQuestion || talkingPoints.length < 2) {
    webResults = await researchAgent.supplement({ text: nlu.text, productType: nlu.productType, talkingPoints });
  }

  // "Clarify mode": the customer asked what the rep meant, not a new question.
  // Re-explain the rep's LAST message simpler, instead of retrieving fresh
  // talking points that don't address their confusion.
  const lastRepTurn = [...recentHistory].reverse().find((m) => m.sender === 'agent');
  const clarifyMode = Boolean(isClarifyRequest(customerMessage) && lastRepTurn);
  const messageToSimplify = clarifyMode ? lastRepTurn.content : null;

  const draftArgs = {
    customerMessage: nlu.text,
    productType: nlu.productType,
    talkingPoints,
    webResults,
    policyContext: hasPolicyDoc && !compareQuestion ? policyContext : null,
    recentHistory,
    compareQuestion,
    clarifyMode,
    messageToSimplify,
  };

  const { draftReply, source } = await draftingAgent.draftChatReply(draftArgs);

  // Offer the rep 2-3 tonal variations to choose from (trust-building), with
  // the single deterministic draft as the guaranteed fallback / first option.
  const openaiService = require('../services/openaiService');
  const aiOptions = await openaiService.draftReplyOptions(draftArgs);
  const draftOptions =
    aiOptions && aiOptions.length
      ? aiOptions
      : [{ tone: 'Suggested reply', text: draftReply }];

  const basedOn = [...new Set([
    ...(hasPolicyDoc && policyContext
      ? [`${policyContext.filename} (customer uploaded policy — Interpreter Agent)`]
      : []),
    ...talkingPoints.map((t) => {
      if (t.source !== 'learned') return t.topic;
      const src = t.sourceType === 'url' && t.sourceUrl ? t.sourceUrl : t.sourceDocument || 'uploaded document';
      return `${t.topic} (from ${src})`;
    }),
    ...webResults.map((r) => `${r.title || r.url} (from the web)`),
  ])];

  console.log(
    `[${AGENT_NAME}] chat-draft pipeline complete (source=${source}, policyGrounded=${hasPolicyDoc}, compareMode=${compareQuestion}, historyTurns=${recentHistory.length}, ${webResults.length} web result(s))`
  );

  return {
    customerMessage,
    productType: nlu.productType || null,
    intent: nlu.intent,
    draftReply,
    draftOptions,
    basedOn,
    webResults,
    complianceFlags,
    policyGrounded: hasPolicyDoc,
    source,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getLiveGuidance, getChatDraft, AGENT_NAME };
