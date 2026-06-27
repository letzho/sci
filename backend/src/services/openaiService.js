require('dotenv').config();

/**
 * Optional enhancement layer on top of the rule engine.
 *
 * Only activates when OPENAI_API_KEY is set in backend/.env. If it is not
 * set, every exported function resolves to `null` immediately so the
 * caller (the Drafting Agent, backend/src/agents/draftingAgent.js) always
 * has a safe, deterministic fallback to the rule engine's own
 * approved_message / plain_english text.
 *
 * Design constraint: the model is explicitly instructed to ground its
 * answer ONLY in the approved talking points it is given, and to never
 * recommend, advise, or guarantee anything - matching the hackathon
 * brief's "no robo-adviser" boundary.
 */

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const TIMEOUT_MS = 6000;

let client = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) {
    // Lazy-require so a missing/optional dependency never breaks the
    // rule-engine-only path.
    const OpenAI = require('openai');
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

function isEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('openai_timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Labels each talking point with its provenance so the model (and the
// SYSTEM_PROMPT's instruction to treat both kinds purely as factual
// grounding) can tell pre-approved messaging apart from agent-uploaded
// reference material.
function formatTalkingPointsForPrompt(talkingPoints) {
  if (!talkingPoints || talkingPoints.length === 0) return '(none matched)';
  return talkingPoints
    .map((t) => {
      const label = t.source === 'learned' ? `from uploaded document "${t.sourceDocument || 'reference'}"` : 'approved';
      return `- [${label}] (${t.topic}) ${t.approvedMessage}`;
    })
    .join('\n');
}

// Web results are a third, clearly-weaker grounding tier (see
// backend/src/agents/researchAgent.js): public search snippets fetched only
// when the approved/learned tiers are thin. Always labelled "from the web"
// in the prompt so the model never confuses them with pre-approved wording.
function formatWebResultsForPrompt(webResults) {
  if (!webResults || webResults.length === 0) return '(none)';
  return webResults.map((r) => `- [from the web: ${r.url}] ${r.title ? `${r.title} - ` : ''}${r.snippet}`).join('\n');
}

function formatPolicyContextForPrompt(policyContext) {
  if (!policyContext) return '(none — customer has not shared a policy document in this chat)';
  const lines = [
    `Document filename: "${policyContext.filename || 'uploaded policy'}"`,
  ];
  if (policyContext.insuredPlanTier) {
    lines.push(
      `Customer's enrolled plan tier (from document): ${policyContext.insuredPlanTier.charAt(0).toUpperCase()}${policyContext.insuredPlanTier.slice(1)} — quote ONLY benefits for this tier, not other columns in the benefit table.`
    );
  }
  lines.push(`Document summary: ${policyContext.summary || '(no summary)'}`);
  if (policyContext.coverageHighlights?.length) {
    lines.push('Coverage highlights from this document:');
    policyContext.coverageHighlights.forEach((h) => lines.push(`  - ${h}`));
  }
  if (policyContext.exclusionsOrGaps?.length) {
    lines.push('Exclusions / limitations from this document:');
    policyContext.exclusionsOrGaps.forEach((h) => lines.push(`  - ${h}`));
  }
  lines.push(
    'IMPORTANT: The customer shared THIS document and is asking about it. Answer using ONLY what this document covers. Do NOT describe life insurance, death benefits, or unrelated products unless this document is clearly a life policy.'
  );
  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are a compliance-bounded writing assistant for an insurance representative.
Rules you must always follow:
- Only use facts present in the "approved talking points" or "web search results" you are given. Never invent coverage details, numbers, or guarantees.
- Some talking points are pre-approved compliance messaging; others are excerpts from a document the agent uploaded (reference material, labelled "from uploaded document"). Web search results are public information fetched live, labelled "from the web" - the weakest tier, useful for general definitions or comparing publicly known facts, never for anything specific to this customer's policy. Treat all of these purely as factual grounding - never as license to give a personalized recommendation.
- Never recommend, advise, or tell the customer what to buy or do. You are not a financial adviser.
- Never promise guaranteed returns or guaranteed outcomes unless the approved text itself says it is guaranteed.
- If the customer asks you to compare this product against another insurer's product, you may lay out objective, publicly available facts for each side using the web search results (e.g. what a term means, how a feature is typically structured) - but never say or imply which option is "better" or "right for them". Remind them their representative will help them weigh the decision.
- Write in short, clear, plain English a customer can understand in a live conversation.
- If none of the talking points or web search results clearly answer the question, do NOT deflect the customer to "check with a supervisor" or "look at the product summary" - that is not an acceptable answer. Instead, briefly share whatever related fact you do have (if any), then ask ONE specific clarifying question that would let the rep pull up exactly what's needed (e.g. which benefit, which policy, which scenario). Keep the conversation moving forward.
- Keep responses to 2-3 sentences.`;

/**
 * Produces a short, plain-English explainer grounded in the matched
 * knowledge base entries, for live conversation guidance (face-to-face /
 * virtual call channels).
 */
async function enhanceGuidance({ triggerText, productType, talkingPoints, webResults }) {
  if (!isEnabled()) return null;
  try {
    const openai = getClient();
    const approved = formatTalkingPointsForPrompt(talkingPoints);
    const web = formatWebResultsForPrompt(webResults);

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 160,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Product context: ${productType || 'general'}\nWhat the customer / rep just said: "${triggerText}"\nTalking points available:\n${approved}\nWeb search results available:\n${web}\n\nWrite the plain-English explainer the rep could say next.`,
          },
        ],
      }),
      TIMEOUT_MS
    );

    return completion?.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.warn('[openaiService] enhanceGuidance fallback to rule engine only:', err.message);
    return null;
  }
}

/**
 * Drafts a customer-facing chat reply for human review, grounded in the
 * matched knowledge base entries.
 */
async function draftChatReply({ customerMessage, productType, talkingPoints, webResults, policyContext = null }) {
  if (!isEnabled()) return null;
  try {
    const openai = getClient();
    const approved = formatTalkingPointsForPrompt(talkingPoints);
    const web = formatWebResultsForPrompt(webResults);
    const policyDoc = formatPolicyContextForPrompt(policyContext);

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 160,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Product context: ${productType || 'general'}
Customer uploaded policy document (PRIMARY grounding when present):
${policyDoc}
Customer's chat message: "${customerMessage}"
Talking points available:
${approved}
Web search results available:
${web}

Draft a short, warm chat reply the rep can review, edit and send. When a policy document is present, the reply MUST address that document — not generic product-category information. This is a DRAFT for human review only - do not address the customer as if this is final.`,
          },
        ],
      }),
      TIMEOUT_MS
    );

    return completion?.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.warn('[openaiService] draftChatReply fallback to rule engine only:', err.message);
    return null;
  }
}

// Separate system prompt for policy-document analysis: same no-advice
// boundary as SYSTEM_PROMPT above, but scoped to "summarize what's in this
// document" rather than "respond to what was just said", and asks for a
// strict JSON shape so the Interpreter Agent (backend/src/agents/
// interpreterAgent.js) can blend it with its own deterministic extraction.
const POLICY_SYSTEM_PROMPT = `You are a compliance-bounded document-analysis assistant helping an insurance representative quickly understand a policy document a customer has shared, before they discuss it together.
Rules you must always follow:
- Only state facts that are present in the document text you are given. Never invent coverage details, numbers, or terms that are not in the text.
- Never recommend, advise, evaluate, or tell the rep or customer whether this policy is good, bad, sufficient, or what to do about it. You are not a financial adviser.
- Never promise or imply a guaranteed outcome unless the document text itself says so verbatim.
- Write for the representative preparing for a conversation, not for the end customer.
- Respond with ONLY a JSON object (no markdown fences, no commentary) with exactly these keys: "summary" (string, 2-3 sentences), "coverageHighlights" (array of short strings), "exclusionsOrGaps" (array of short strings), "suggestedQuestions" (array of 3-5 short clarifying questions the rep could ask the customer - never instructing what to buy). Omit a section as an empty array rather than guessing if it is not clearly present in the text.
- Many personal-accident policies include a multi-column "Table of cover" with tiers Basic, Classic, Superior, Premium, Prestige. The customer's enrolled tier is stated in the "Interest insured" / Plan column (e.g. "Superior with Infectious Disease Coverage"). ONLY quote benefit amounts from THAT tier's column — never the highest (Prestige) column by mistake.`;

/**
 * Analyzes a customer-uploaded policy document's extracted text and returns
 * a structured, JSON-shaped summary for the representative's Interpreter
 * Agent panel. Always has a null-returning fallback so a missing API key or
 * a parsing hiccup never blocks the deterministic rule-based analysis in
 * interpreterAgent.js.
 */
async function interpretPolicy({ text, productType, insuredPlanTier = null }) {
  if (!isEnabled() || !text || !text.trim()) return null;
  try {
    const openai = getClient();
    const truncated = text.length > 12000 ? `${text.slice(0, 12000)}\n...[truncated]` : text;
    const tierNote = insuredPlanTier
      ? `Customer's enrolled plan tier (from Interest insured / Plan column): ${insuredPlanTier}. Quote ONLY benefits for this tier from any multi-column table.`
      : 'Plan tier not detected — if a multi-column Table of cover exists, find the Plan column under Interest insured before quoting any dollar amounts.';

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 550,
        messages: [
          { role: 'system', content: POLICY_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Product context (if known): ${productType || 'unknown'}\n${tierNote}\nDocument text:\n"""\n${truncated}\n"""\n\nReturn the JSON object described in the system prompt.`,
          },
        ],
      }),
      TIMEOUT_MS
    );

    const raw = completion?.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const jsonText = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(jsonText);

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : null,
      coverageHighlights: Array.isArray(parsed.coverageHighlights) ? parsed.coverageHighlights.filter((s) => typeof s === 'string') : [],
      exclusionsOrGaps: Array.isArray(parsed.exclusionsOrGaps) ? parsed.exclusionsOrGaps.filter((s) => typeof s === 'string') : [],
      suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.filter((s) => typeof s === 'string') : [],
    };
  } catch (err) {
    console.warn('[openaiService] interpretPolicy fallback to rule engine only:', err.message);
    return null;
  }
}

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

/**
 * Embeds a piece of text into a float vector for semantic search
 * (backend/src/services/vectorStore.js). Returns null when disabled or on
 * any failure, so callers always have a safe "no embedding available" path
 * back to the deterministic keyword-overlap matcher in ruleEngine.js.
 */
async function embedText(text) {
  if (!isEnabled() || !text || !text.trim()) return null;
  try {
    const openai = getClient();
    const truncated = text.length > 8000 ? text.slice(0, 8000) : text;
    const res = await withTimeout(
      openai.embeddings.create({ model: EMBEDDING_MODEL, input: truncated }),
      TIMEOUT_MS
    );
    return res?.data?.[0]?.embedding || null;
  } catch (err) {
    console.warn('[openaiService] embedText failed, semantic search will fall back to keyword matching:', err.message);
    return null;
  }
}

module.exports = { isEnabled, enhanceGuidance, draftChatReply, interpretPolicy, embedText };
