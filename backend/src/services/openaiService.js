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
      let label = 'approved';
      if (t.source === 'learned') {
        if (t.sourceType === 'url') {
          label = `from URL "${t.sourceDocument || 'reference'}"${t.sourceUrl ? ` (${t.sourceUrl})` : ''}`;
        } else {
          label = `from uploaded document "${t.sourceDocument || 'reference'}"`;
        }
      }
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

function formatRecentHistoryForPrompt(recentHistory, currentMessage) {
  if (!recentHistory || recentHistory.length === 0) return '(no prior turns in this chat)';
  const prior = recentHistory.filter(
    (m) => !(m.sender === 'customer' && m.content.trim() === (currentMessage || '').trim())
  );
  if (prior.length === 0) return '(no prior turns in this chat)';
  return prior
    .map((m) => {
      const role = m.sender === 'customer' ? 'Customer' : m.sender === 'agent' ? 'Representative' : m.sender;
      return `${role}: "${m.content}"`;
    })
    .join('\n');
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
  if (policyContext.benefitTable?.accidental_death) {
    lines.push('Table of cover — accidental death amounts extracted from document:');
    const death = policyContext.benefitTable.accidental_death;
    for (const [tier, amount] of Object.entries(death)) {
      if (amount) lines.push(`  - ${tier}: S$${Number(amount).toLocaleString('en-SG')}`);
    }
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
  if (policyContext.benefitMatches?.length) {
    lines.push('Benefit details from the policy matching this question (use these first):');
    policyContext.benefitMatches.forEach((h) => lines.push(`  - ${h}`));
  }
  if (policyContext.compensationMatches?.length) {
    lines.push('Rows from Scale of compensation matching this question:');
    policyContext.compensationMatches.forEach((h) => lines.push(`  - ${h}`));
  }
  if (policyContext.relevantChunks?.length) {
    lines.push('Passages from the full policy document matching this question:');
    policyContext.relevantChunks.forEach((c) => {
      lines.push(`  - [${c.topic || 'section'}] ${c.content}`);
    });
  } else if (policyContext.relevantExcerpts?.length) {
    lines.push('Relevant excerpts from the full policy document:');
    policyContext.relevantExcerpts.forEach((h) => lines.push(`  - ${h}`));
  }
  lines.push(
    'IMPORTANT: The customer shared THIS document. Answer using ONLY facts stated in the passages above.',
    'For death or beneficiary questions: personal accident policies often label this "Accidental death" (Section 1) with a sum insured amount — quote that if present. Do NOT say the document "does not specify" death benefits when accidental death or sum insured appears above.',
    'If only partial text was extracted from the PDF, share what IS present and note the rep can verify the exact figure in the original document — never invent amounts.'
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
- When the customer asks to compare products or plans and talking points labelled "from URL" contain specific plan names, you MUST name those plans and describe concrete differences from that material (coverage types, term, riders, etc.). Do NOT reply with only generic comparison factors (premium, sum assured, policy term) without citing the named plans from the reference.
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
async function draftChatReply({
  customerMessage,
  productType,
  talkingPoints,
  webResults,
  policyContext = null,
  recentHistory = [],
  compareQuestion = false,
}) {
  if (!isEnabled()) return null;
  try {
    const openai = getClient();
    const approved = formatTalkingPointsForPrompt(talkingPoints);
    const web = formatWebResultsForPrompt(webResults);
    const policyDoc = formatPolicyContextForPrompt(policyContext);
    const history = formatRecentHistoryForPrompt(recentHistory, customerMessage);

    const compareNote = compareQuestion
      ? '\nIMPORTANT: This is a product-comparison question. Prioritize talking points marked [from URL] or comparison-table excerpts. Name specific plans (e.g. PRUActive Protect, PRUCancer 360) and their differences — never give only a generic "factors to compare" answer.\n'
      : '';

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        max_tokens: compareQuestion ? 280 : 200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Product context: ${productType || 'general'}
Recent conversation (use for continuity — do not re-ask what was already answered):
${history}
Customer uploaded policy document (PRIMARY grounding when present):
${policyDoc}
Customer's latest chat message: "${customerMessage}"
${compareNote}Talking points available:
${approved}
Web search results available:
${web}

Draft a short, warm chat reply the rep can review, edit and send. When a policy document is present, ground answers in that document for the whole conversation — not only when the latest message mentions "policy". Use recent conversation context so follow-up questions (e.g. death benefit after discussing hospital cover) stay on the same document. This is a DRAFT for human review only - do not address the customer as if this is final.`,
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
- Respond with ONLY a JSON object (no markdown fences, no commentary) with exactly these keys: "summary" (string, 2-3 sentences describing the whole document), "coverageHighlights" (array of short strings — pull facts from ANY section: benefits, tables, percentages, limits, premiums, exclusions), "exclusionsOrGaps" (array of short strings), "suggestedQuestions" (array of 3-5 short clarifying questions the rep could ask the customer - never instructing what to buy). Read the ENTIRE document text provided — do not limit yourself to one section.
- Personal accident policies often include a "Scale of compensation" table listing disabilities and percentages of sum insured (e.g. "Losing one limb: 50%", "Losing two limbs: 100%"). You MUST include every such row you find in coverageHighlights as "Label: X% of sum insured".
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

const BENEFIT_TABLE_PROMPT = `You extract insurance "Table of cover" benefit amounts from PDF text that may be messy or out of order.
Return ONLY a JSON object with key "benefitTable" whose values are objects mapping tier names (basic, classic, superior, premium, prestige) to integer dollar amounts (no currency symbols).
Include only rows you can find evidence for, e.g. accidental_death, family_support, permanent_disability, medical_expenses.
Example: {"benefitTable":{"accidental_death":{"basic":100000,"classic":200000,"superior":300000,"premium":500000,"prestige":1000000}}}
If no table amounts found, return {"benefitTable":{}}.`;

/**
 * LLM fallback to pull structured tier amounts when pdf-parse text is messy.
 */
async function extractPolicyBenefitTable(text) {
  if (!isEnabled() || !text?.trim()) return null;
  try {
    const openai = getClient();
    const truncated = text.length > 14000 ? `${text.slice(0, 14000)}\n...[truncated]` : text;
    const completion = await withTimeout(
      openai.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 700,
        messages: [
          { role: 'system', content: BENEFIT_TABLE_PROMPT },
          { role: 'user', content: `PDF text:\n"""\n${truncated}\n"""` },
        ],
      }),
      TIMEOUT_MS
    );
    const raw = completion?.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const jsonText = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(jsonText);
    return parsed?.benefitTable && typeof parsed.benefitTable === 'object' ? parsed.benefitTable : null;
  } catch (err) {
    console.warn('[openaiService] extractPolicyBenefitTable failed:', err.message);
    return null;
  }
}

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const WHISPER_MODEL = process.env.OPENAI_WHISPER_MODEL || 'whisper-1';
const TRANSCRIBE_TIMEOUT_MS = 15000;

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

/**
 * Transcribes short audio via OpenAI Whisper. Used by virtual call / face-to-face
 * channels instead of the browser's fragmented Web Speech API finals.
 * @param {Buffer} audioBuffer
 * @param {string} [filename]
 * @returns {Promise<?string>}
 */
async function transcribeAudio(audioBuffer, filename = 'audio.webm') {
  if (!isEnabled() || !audioBuffer || audioBuffer.length === 0) return null;
  try {
    const openai = getClient();
    const { toFile } = require('openai/uploads');
    const file = await toFile(audioBuffer, filename);
    const result = await withTimeout(
      openai.audio.transcriptions.create({
        model: WHISPER_MODEL,
        file,
        language: 'en',
        response_format: 'text',
      }),
      TRANSCRIBE_TIMEOUT_MS
    );
    const text = typeof result === 'string' ? result : result?.text;
    return text?.trim() || null;
  } catch (err) {
    console.warn('[openaiService] transcribeAudio failed:', err.message);
    return null;
  }
}

const CLIENT_BRIEF_SYSTEM_PROMPT = `You prepare a short pre-call briefing that helps an insurance representative walk into a conversation well-informed and personable. You are NOT a financial adviser.
Rules you must always follow:
- Only use the customer facts, portfolio summary, and past-conversation notes provided. Never invent details.
- Never recommend, advise, or say what the customer should buy, drop, or do. Frame coverage gaps as neutral "areas the rep may want to discuss", never "products to sell".
- Icebreakers and questions must be warm, human, and appropriate — based on the customer's real profile/history, never pushy.
- Keep everything concise and scannable for a rep glancing at it 30 seconds before a call.
- Respond with ONLY a JSON object (no markdown fences) with exactly these keys:
  {
    "summary": "2-3 sentence neutral snapshot of who this customer is and where things stand",
    "talkingPoints": ["short neutral discussion topics grounded in their portfolio/history"],
    "icebreakers": ["2-3 warm, personal conversation openers"],
    "suggestedQuestions": ["3-4 open questions the rep could ask to understand needs — never leading toward a sale"],
    "watchOuts": ["optional short notes, e.g. a health condition to be sensitive about, or a topic already covered"]
  }`;

/**
 * Compiles a compliance-safe pre-call brief for the representative from the
 * customer's profile, portfolio, and prior-conversation context. Returns null
 * on failure so the caller can fall back to a deterministic brief.
 */
async function generateClientBrief({ profileText }) {
  if (!isEnabled() || !profileText) return null;
  try {
    const openai = getClient();
    const completion = await withTimeout(
      openai.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 650,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CLIENT_BRIEF_SYSTEM_PROMPT },
          { role: 'user', content: `Prepare the pre-call brief from this context:\n\n${profileText}` },
        ],
      }),
      15000 // pre-call prep, not in the live loop — allow more time than live guidance
    );
    const raw = completion?.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const arr = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []);
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : null,
      talkingPoints: arr(parsed.talkingPoints),
      icebreakers: arr(parsed.icebreakers),
      suggestedQuestions: arr(parsed.suggestedQuestions),
      watchOuts: arr(parsed.watchOuts),
    };
  } catch (err) {
    console.warn('[openaiService] generateClientBrief failed, using deterministic brief:', err.message);
    return null;
  }
}

const COMPARISON_SYSTEM_PROMPT = `You compare insurance policy documents for a representative, side by side, so they can walk a customer through the objective differences.
Rules you must always follow:
- Only state facts present in the document text provided. Never invent figures, benefits, or terms. If a document does not state something, use null for that cell.
- Never say or imply which policy is "better", "best", "recommended", or "right" for anyone. You lay out objective facts only — the representative and customer decide together.
- Normalize the rows so the same attribute lines up across every policy (e.g. "Annual premium", "Sum assured / cover", "Policy term", "Critical illnesses covered", "Guaranteed cash value", "Key exclusions", "Riders available"). Pick the 6-12 attributes that best let a customer compare THESE documents.
- Keep every cell short (a figure, a short phrase, or a brief clause) so it fits in a comparison table.
- Respond with ONLY a JSON object (no markdown fences) with this exact shape:
  {
    "policies": [ { "name": "<plan name or filename>", "insurer": "<insurer or null>", "productType": "<e.g. Term life, ILP, Critical illness, or null>" } ],
    "attributes": [ { "label": "<row label>", "values": [ "<cell for policy 1>", "<cell for policy 2>", ... ] } ],
    "summary": "<2-3 sentence neutral, factual summary of how the documents differ>"
  }
- Every attribute's "values" array MUST have exactly one entry per policy, in the same order as "policies". Use null for a missing value.`;

/**
 * Reads several policy documents' extracted text and returns a normalized,
 * compliance-safe comparison table (objective facts only, no recommendation).
 * @param {Array<{ name: string, text: string }>} documents
 * @returns {Promise<?object>} { policies, attributes, summary } or null on failure
 */
async function comparePolicyDocuments(documents) {
  if (!isEnabled() || !Array.isArray(documents) || documents.length < 1) return null;
  try {
    const openai = getClient();
    const perDocBudget = Math.floor(32000 / documents.length);
    const blocks = documents
      .map((d, i) => {
        const body = (d.text || '').slice(0, perDocBudget);
        return `=== DOCUMENT ${i + 1}: ${d.name || `Policy ${i + 1}`} ===\n${body}`;
      })
      .join('\n\n');

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 2200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: COMPARISON_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Compare the following ${documents.length} policy document(s). Return the JSON comparison object.\n\n${blocks}`,
          },
        ],
      }),
      20000
    );

    const raw = completion?.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.policies) || !Array.isArray(parsed.attributes)) return null;

    // Guarantee every row aligns with the policy count so the table never skews.
    const count = parsed.policies.length;
    parsed.attributes = parsed.attributes
      .filter((a) => a && typeof a.label === 'string')
      .map((a) => {
        const values = Array.isArray(a.values) ? a.values.slice(0, count) : [];
        while (values.length < count) values.push(null);
        return { label: a.label, values };
      });
    return parsed;
  } catch (err) {
    console.warn('[openaiService] comparePolicyDocuments failed:', err.message);
    return null;
  }
}

const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'tts-1';
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'alloy';

/**
 * Text-to-speech via OpenAI, for reading approved phrasing aloud in a natural
 * voice (Whisper is speech-to-text only — this is the spoken-output side).
 * Returns an MP3 Buffer, or null when disabled / on failure so the caller can
 * fall back to the browser's built-in SpeechSynthesis.
 * @param {string} text
 * @returns {Promise<?Buffer>}
 */
async function synthesizeSpeech(text) {
  if (!isEnabled() || !text || !text.trim()) return null;
  try {
    const openai = getClient();
    const clipped = text.length > 4000 ? text.slice(0, 4000) : text;
    const response = await withTimeout(
      openai.audio.speech.create({ model: TTS_MODEL, voice: TTS_VOICE, input: clipped, format: 'mp3' }),
      TRANSCRIBE_TIMEOUT_MS
    );
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.warn('[openaiService] synthesizeSpeech failed, caller falls back to browser TTS:', err.message);
    return null;
  }
}

async function generatePortfolioRecommendations({ customer, policies, portfolio, ruleRecommendations }) {
  const openai = getClient();
  if (!openai) return null;

  const policySummary = (policies || [])
    .map((p) => `${p.productType}: premium ${p.premium}/${p.premiumFreq}, sum assured ${p.coverage?.sumAssured || 'n/a'}`)
    .join('; ');

  const prompt = `You help explain insurance portfolio gaps in plain English for Singapore clients. NEVER recommend buying a specific product or insurer. Use educational language only.

Customer: ${customer.name}, age ${portfolio.age ?? 'unknown'}, health: ${portfolio.healthCondition || 'not specified'}
Current policies: ${policySummary || 'none'}
Coverage gaps detected: ${(portfolio.coverageGaps || []).map((g) => g.label).join(', ') || 'none'}
Rule-based suggestions: ${JSON.stringify(ruleRecommendations || [])}

Return JSON:
{
  "summary": "1-2 sentence overview of their portfolio at this life stage",
  "recommendations": [
    {"productType":"life_insurance|critical_illness|integrated_shield_plan|retirement_cpf|ilp","label":"...","priority":"high|medium|low","reason":"plain English why this category is often reviewed at their age","action":"add|enhance"}
  ]
}
Max 5 recommendations. Only use the 5 product types listed.`;

  try {
    const completion = await withTimeout(
      openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 700,
      }),
      TIMEOUT_MS
    );
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (!Array.isArray(parsed.recommendations)) return null;
    return parsed;
  } catch (err) {
    console.warn('[openaiService] generatePortfolioRecommendations failed:', err.message);
    return null;
  }
}

module.exports = { isEnabled, enhanceGuidance, draftChatReply, interpretPolicy, extractPolicyBenefitTable, comparePolicyDocuments, generateClientBrief, embedText, transcribeAudio, synthesizeSpeech, generatePortfolioRecommendations };
