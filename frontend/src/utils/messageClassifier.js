/**
 * Distinguishes a substantive, informational reply (an explanation the
 * customer should confirm they understood) from a simple acknowledgement or
 * a question the rep is asking back ("what matters most to you?", "sure",
 * "hi"). Asking for "Got it / Still unclear" feedback on every single rep
 * message is noisy and undermines the point of the understanding check — it
 * should only appear on messages that actually explain something.
 */

const SIMPLE_PHRASES = new Set([
  'hi', 'hello', 'hey', 'thanks', 'thank you', 'sure', 'ok', 'okay', 'yes', 'no',
  'sounds good', 'no problem', 'of course', 'welcome', "you're welcome", 'got it',
  'noted', 'alright', 'great', 'perfect', 'sure thing', 'will do', 'np',
]);

const MIN_INFORMATIONAL_WORDS = 12;

export function isInformationalReply(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase().replace(/[!.]+$/, '');
  if (SIMPLE_PHRASES.has(lower)) return false;

  // A rep asking the customer something back is not an explanation.
  if (trimmed.endsWith('?')) return false;

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount >= MIN_INFORMATIONAL_WORDS;
}
