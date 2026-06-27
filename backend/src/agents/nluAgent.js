const ruleEngine = require('../services/ruleEngine');

/**
 * NLU Agent
 * ---------
 * First stage of the pipeline. Looks at a raw chunk of text (speech
 * transcript or chat message) and works out two things before any other
 * agent runs:
 *
 *  1. intent  - a light classification (question / objection / acknowledgement
 *               / statement) used for logging and downstream phrasing cues.
 *  2. productType - if the caller didn't already know which product is being
 *               discussed (e.g. conversation has no product context yet),
 *               infer the best guess from keyword overlap against the
 *               knowledge base, via the rule engine's own scoring.
 *
 * This agent never talks to the network and never persists anything - it is
 * a pure, synchronous text-understanding step.
 */

const AGENT_NAME = 'NLU Agent';

const QUESTION_STARTERS = /^(what|how|when|why|where|who|which|is|are|can|could|does|do|did|will|would|should)\b/i;
const OBJECTION_PATTERNS = /(too expensive|can't afford|cannot afford|premium is high|not sure about|hesitant|worried|too risky|sounds risky)/i;
const ACK_PATTERNS = /(thank|thanks|appreciate|got it|understood|i see|makes sense)/i;

function detectIntent(text) {
  const trimmed = text.trim();
  if (!trimmed) return 'statement';
  if (trimmed.endsWith('?') || QUESTION_STARTERS.test(trimmed)) return 'question';
  if (OBJECTION_PATTERNS.test(trimmed)) return 'objection';
  if (ACK_PATTERNS.test(trimmed)) return 'acknowledgement';
  return 'statement';
}

/**
 * Best-effort product inference: reuse the rule engine's unscoped talking
 * point search (it already scores knowledge base entries by keyword overlap
 * across ALL products when no productType is given) and take the top hit's
 * product type. Only used as a fallback when the caller has no product
 * context at all, so it can never override an explicit selection.
 */
async function inferProductType(text) {
  const matches = await ruleEngine.findTalkingPoints(text, null, 1);
  return matches.length > 0 ? matches[0].productType : null;
}

/**
 * @param {{text: string, productType: ?string}} input
 * @returns {Promise<{text: string, intent: string, productType: ?string, inferred: boolean}>}
 */
async function analyze({ text, productType }) {
  const cleaned = (text || '').trim();
  const intent = detectIntent(cleaned);
  let resolvedProductType = productType || null;
  let inferred = false;

  if (!resolvedProductType && cleaned) {
    resolvedProductType = await inferProductType(cleaned);
    inferred = Boolean(resolvedProductType);
  }

  console.log(
    `[${AGENT_NAME}] intent="${intent}" productType=${resolvedProductType || 'unscoped'}${inferred ? ' (inferred)' : ''} text="${cleaned.slice(0, 80)}"`
  );

  return { text: cleaned, intent, productType: resolvedProductType, inferred };
}

module.exports = { analyze, AGENT_NAME };
