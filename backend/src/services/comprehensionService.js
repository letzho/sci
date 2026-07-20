/**
 * Comprehension Service
 * ---------------------
 * "Did the customer actually understand?" — the differentiator several rival
 * teams pitched but few build. Two parts:
 *   1. detectConfusion(): lightweight, deterministic scan of what the customer
 *      just said for confusion signals, so the rep can be nudged to re-explain
 *      BEFORE the conversation moves on.
 *   2. buildRecapContext(): assembles the topics covered + confusion moments
 *      for the end-of-session Clarity Recap (see openaiService.generateClarityRecap).
 *
 * Compliance boundary: this only measures/supports understanding — it never
 * advises or recommends. The rep stays the decision-maker.
 */

// Phrases that signal the customer hasn't understood. Kept explicit and
// deterministic so it never mislabels a normal question as confusion.
const CONFUSION_PHRASES = [
  "i don't understand", 'i dont understand', "don't understand", 'dont understand',
  "don't get it", 'dont get it', "i'm confused", 'im confused', 'confused', 'confusing',
  'what do you mean', 'what does that mean', 'what is that', "what's that mean", 'whats that mean',
  'not sure what', 'not sure i', 'no idea', 'lost me', 'you lost me', 'too complicated', 'too complex',
  'can you explain', 'explain again', 'explain that again', 'say that again', 'come again',
  'repeat that', 'not clear', 'unclear', 'hard to follow', 'over my head', 'sorry what',
  'huh', 'wait what', "i don't follow", 'dont follow', 'makes no sense', "doesn't make sense",
  'what is a', "what's a", 'what is an', 'is that the same as', 'never heard of',
];

// Softer "vague agreement" — treated as weak signals; only flag when combined
// with a question mark or another weak signal to avoid false positives.
const WEAK_SIGNALS = ['i guess', 'i think so', 'maybe', 'i suppose', 'ok i think', 'okay i think', 'sort of', 'kind of'];

/**
 * Guards against firing guidance (and a web-search round trip) on filler like
 * "Sure is." / "Okay." / "Yes." A short but genuine question still counts.
 * Mirrors the client-side sentence buffer — defence in depth.
 * @param {string} text
 * @returns {boolean}
 */
function isMeaningfulUtterance(text) {
  if (!text || !text.trim()) return false;
  const trimmed = text.trim();
  if (/\?\s*$/.test(trimmed)) return true;
  return trimmed.split(/\s+/).filter(Boolean).length >= 3;
}

// Phrases that refer BACK to the rep's previous message ("clarify what you just
// said") — as opposed to a genuine new question like "what is an ILP?". These
// switch the drafter into "re-explain your last message simpler" mode.
const CLARIFY_BACK_REFERENCES = [
  'what do you mean', 'what does that mean', "what's that mean", 'whats that mean',
  'explain that again', 'explain again', 'explain that', 'say that again', 'come again', 'repeat that',
  'you lost me', 'lost me', 'in simpler terms', 'explain simpler', 'simpler terms', 'more simply',
  'plain english', 'wait what', 'sorry what', 'makes no sense', "doesn't make sense", 'not clear', 'unclear',
];

/**
 * True when the customer is asking the rep to clarify their PREVIOUS message
 * (not asking a new, self-contained question). Used to switch the chat drafter
 * into re-explanation mode so the reply actually addresses their confusion.
 * @param {string} text
 * @returns {boolean}
 */
function isClarifyRequest(text) {
  if (!text || !text.trim()) return false;
  const t = ` ${text.toLowerCase().trim()} `;
  if (CLARIFY_BACK_REFERENCES.some((p) => t.includes(p))) return true;
  // Short generic confusion with no named concept to explain ("huh", "I'm confused").
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 5 && /\b(huh|confused|confusing|understand|lost|repeat)\b/.test(t)) return true;
  return false;
}

/**
 * @param {string} text  the customer's latest utterance / message
 * @returns {{confused: boolean, strength: 'high'|'low', matched: string[]}}
 */
function detectConfusion(text) {
  if (!text || !text.trim()) return { confused: false, strength: 'low', matched: [] };
  const lower = ` ${text.toLowerCase()} `;

  const strong = CONFUSION_PHRASES.filter((p) => lower.includes(p));
  if (strong.length) return { confused: true, strength: 'high', matched: strong };

  const weak = WEAK_SIGNALS.filter((p) => lower.includes(p));
  if (weak.length && text.includes('?')) return { confused: true, strength: 'low', matched: weak };

  return { confused: false, strength: 'low', matched: [] };
}

/**
 * Assembles the raw material for a Clarity Recap from a conversation's stored
 * messages and guidance events. Returns plain data; the LLM turns it into the
 * customer-facing recap (with a deterministic fallback in the route).
 */
async function buildRecapContext(db, conversationId) {
  const messages = await db
    .prepare(
      `SELECT sender, kind, content FROM messages
       WHERE conversation_id = ? ORDER BY created_at ASC`
    )
    .all(conversationId);

  const guidance = await db
    .prepare(
      `SELECT DISTINCT title FROM guidance_events
       WHERE conversation_id = ? AND guidance_type = 'talking_point' AND title IS NOT NULL
       ORDER BY title`
    )
    .all(conversationId);

  const sources = await db
    .prepare(
      `SELECT DISTINCT source FROM guidance_events
       WHERE conversation_id = ? AND source IS NOT NULL`
    )
    .all(conversationId);

  const customerLines = messages
    .filter((m) => m.sender === 'customer')
    .map((m) => m.content);

  // Topics the customer showed confusion about (best-effort, deterministic).
  const confusedTopics = [];
  for (const line of customerLines) {
    if (detectConfusion(line).confused) confusedTopics.push(line);
  }

  return {
    topicsCovered: guidance.map((g) => g.title),
    sources: sources.map((s) => s.source),
    messageCount: messages.length,
    customerUtterances: customerLines,
    confusedMoments: confusedTopics,
    transcript: messages
      .map((m) => `${m.sender === 'customer' ? 'Customer' : m.sender === 'agent' ? 'Rep' : m.sender}: ${m.content}`)
      .join('\n'),
  };
}

module.exports = { detectConfusion, isMeaningfulUtterance, isClarifyRequest, buildRecapContext, CONFUSION_PHRASES };
