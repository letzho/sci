const { getPersona } = require('../data/simulatorPersonas');
const openaiService = require('../services/openaiService');

const FALLBACK_REPLIES = {
  skeptical_parent: [
    "I'm listening, but please don't give me a sales pitch.",
    "My spouse handles finances — I'd need to discuss any numbers with them.",
    "Okay, you've given me a lot to think about. What's the catch?",
  ],
  price_millennial: [
    "Can you just tell me the monthly cost upfront?",
    "I saw cheaper plans online — why is yours different?",
    "Fine, but I'm not signing anything today.",
  ],
};

async function getPersonaReply({ personaId, turn, agentMessage, productType }) {
  const persona = getPersona(personaId);
  const fallbacks = FALLBACK_REPLIES[persona.id] || FALLBACK_REPLIES.skeptical_parent;
  const fallbackText = fallbacks[Math.min(turn, fallbacks.length - 1)];

  if (openaiService.isEnabled() && agentMessage) {
    const reply = await replyWithLlm({ persona, turn, agentMessage, productType });
    if (reply) return { reply, persona: persona.label, turn: turn + 1, done: turn >= 2 };
  }

  return { reply: fallbackText, persona: persona.label, turn: turn + 1, done: turn >= 2 };
}

async function replyWithLlm({ persona, turn, agentMessage, productType }) {
  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content: `You are roleplaying as: ${persona.label}. ${persona.description}. Stay in character as a prospective insurance customer. Be realistic, slightly sceptical. 1-2 sentences. Product context: ${productType || 'life insurance'}. This is turn ${turn + 1} of 3.`,
        },
        { role: 'user', content: `The insurance representative just said: "${agentMessage}"` },
      ],
    });
    return completion?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function scoreSimulation({ personaId, transcript }) {
  const lines = transcript || [];
  const agentLines = lines.filter((l) => l.role === 'agent').map((l) => l.text).join(' ');
  const lower = agentLines.toLowerCase();

  let empathy = 72;
  let clarity = 70;
  let productKnowledge = 68;

  if (/understand|feel|hear you|fair|makes sense/i.test(agentLines)) empathy += 12;
  if (/premium|coverage|policy|term|benefit|cpf|illustration/i.test(lower)) productKnowledge += 14;
  if (agentLines.length > 40 && agentLines.length < 400) clarity += 10;
  if (/guarantee|best policy|you should buy|trust me/i.test(lower)) {
    empathy -= 5;
    clarity -= 8;
    productKnowledge -= 10;
  }
  if (/question|clarify|walk through|compare|objective/i.test(lower)) clarity += 8;

  empathy = Math.min(98, Math.max(55, empathy + Math.floor(Math.random() * 6)));
  clarity = Math.min(98, Math.max(55, clarity + Math.floor(Math.random() * 6)));
  productKnowledge = Math.min(98, Math.max(55, productKnowledge + Math.floor(Math.random() * 6)));

  const overall = Math.round((empathy + clarity + productKnowledge) / 3);

  let aiSummary = null;
  if (openaiService.isEnabled()) {
    aiSummary = await summarizeWithLlm({ personaId, transcript, scores: { empathy, clarity, productKnowledge } });
  }

  return {
    scores: { empathy, clarity, productKnowledge, overall },
    summary: aiSummary || 'Solid practice run. You stayed conversational — tighten product facts on the next attempt and ask one more clarifying question early.',
    xpAward: 50,
    persona: getPersona(personaId).label,
  };
}

async function summarizeWithLlm({ personaId, transcript, scores }) {
  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 100,
      messages: [
        { role: 'system', content: 'Give one sentence of constructive coaching feedback for an insurance rep after a practice call.' },
        {
          role: 'user',
          content: `Persona: ${personaId}\nTranscript: ${JSON.stringify(transcript)}\nScores: ${JSON.stringify(scores)}`,
        },
      ],
    });
    return completion?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

module.exports = { getPersonaReply, scoreSimulation };
