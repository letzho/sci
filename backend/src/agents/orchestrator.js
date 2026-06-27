const nluAgent = require('./nluAgent');
const knowledgeAgent = require('./knowledgeAgent');
const complianceAgent = require('./complianceAgent');
const draftingAgent = require('./draftingAgent');
const researchAgent = require('./researchAgent');
const { loadPolicyContext, messageAboutUploadedPolicy, policyToTalkingPoints } = require('../services/policyContext');

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

async function getLiveGuidance({ text, productType }) {
  const nlu = await nluAgent.analyze({ text, productType });
  const talkingPoints = await knowledgeAgent.findTalkingPoints({ text: nlu.text, productType: nlu.productType });
  const complianceFlags = await complianceAgent.checkCompliance({ text: nlu.text, productType: nlu.productType });
  const webResults = await researchAgent.supplement({ text: nlu.text, productType: nlu.productType, talkingPoints });

  let aiExplainer = null;
  if (talkingPoints.length > 0 || webResults.length > 0) {
    aiExplainer = await draftingAgent.enhanceGuidance({
      triggerText: nlu.text,
      productType: nlu.productType,
      talkingPoints,
      webResults,
    });
  }

  console.log(
    `[${AGENT_NAME}] live guidance pipeline complete - ${talkingPoints.length} talking point(s), ${webResults.length} web result(s), ${complianceFlags.length} flag(s)`
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

async function getChatDraft({ customerMessage, productType, conversationId }) {
  const policyContext = conversationId ? await loadPolicyContext(conversationId) : null;
  const aboutUploadedDoc = policyContext && messageAboutUploadedPolicy(customerMessage);

  // When the customer shared a policy PDF and is asking about it, ground the draft
  // in that document — not the conversation's default product (e.g. life insurance).
  const effectiveProductType =
    aboutUploadedDoc && policyContext.documentProductType
      ? policyContext.documentProductType
      : productType;

  const nlu = await nluAgent.analyze({ text: customerMessage, productType: effectiveProductType });

  let talkingPoints = await knowledgeAgent.findTalkingPoints({ text: nlu.text, productType: nlu.productType });

  if (aboutUploadedDoc) {
    const policyPoints = policyToTalkingPoints(policyContext);
    talkingPoints = [...policyPoints, ...talkingPoints].slice(0, 5);
  }

  const complianceFlags = await complianceAgent.checkCompliance({ text: nlu.text, productType: nlu.productType });

  // Skip generic web search when we have solid grounding from the uploaded policy —
  // otherwise Tavily returns irrelevant life-insurance pages for hospital questions.
  let webResults = [];
  if (!aboutUploadedDoc || talkingPoints.length < 2) {
    webResults = await researchAgent.supplement({ text: nlu.text, productType: nlu.productType, talkingPoints });
  }

  const { draftReply, source } = await draftingAgent.draftChatReply({
    customerMessage: nlu.text,
    productType: nlu.productType,
    talkingPoints,
    webResults,
    policyContext: aboutUploadedDoc ? policyContext : null,
  });

  const basedOn = [...new Set([
    ...(aboutUploadedDoc && policyContext
      ? [`${policyContext.filename} (customer uploaded policy — Interpreter Agent)`]
      : []),
    ...talkingPoints.map((t) =>
      t.source === 'learned' ? `${t.topic} (from ${t.sourceDocument || 'uploaded document'})` : t.topic
    ),
    ...webResults.map((r) => `${r.title || r.url} (from the web)`),
  ])];

  console.log(
    `[${AGENT_NAME}] chat-draft pipeline complete (source=${source}, policyGrounded=${Boolean(aboutUploadedDoc)}, ${webResults.length} web result(s))`
  );

  return {
    customerMessage,
    productType: nlu.productType || null,
    intent: nlu.intent,
    draftReply,
    basedOn,
    webResults,
    complianceFlags,
    policyGrounded: Boolean(aboutUploadedDoc),
    source,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getLiveGuidance, getChatDraft, AGENT_NAME };
