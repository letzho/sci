/**
 * Sentence buffer for live transcription.
 *
 * Speech-to-text (both the browser Web Speech API and Whisper VAD chunks)
 * emits partial fragments — "what does", "this plan", "cover for cancer".
 * Firing guidance on each fragment is noisy and makes the copilot feel jumpy.
 *
 * This buffer stitches consecutive fragments into a complete thought and only
 * emits when the utterance actually looks finished:
 *   - it ends on sentence punctuation (. ? !) and has enough substance, OR
 *   - it has grown past `maxWords` (a long run-on — flush so we don't lag), OR
 *   - the speaker has paused for `pauseMs` (a natural end of a spoken sentence).
 *
 * The result: the rep gets guidance on whole sentences the customer finished
 * saying, not on the first two words they started with.
 */

const SENTENCE_END = /[.!?。！？]+["')\]]?\s*$/;

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * @param {object} opts
 * @param {(sentence: string) => void} opts.onSentence  called with each completed sentence
 * @param {number} [opts.pauseMs=1400]   silence after a fragment that counts as "done speaking"
 * @param {number} [opts.maxWords=45]    hard flush length for run-on speech with no punctuation
 * @param {number} [opts.minWords=3]     minimum words before an on-punctuation flush (avoids "Yes." spam)
 */
export function createSentenceBuffer({ onSentence, pauseMs = 1400, maxWords = 45, minWords = 3 } = {}) {
  let buffer = '';
  let timer = null;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function flush() {
    clearTimer();
    const text = buffer.trim();
    buffer = '';
    if (text) onSentence?.(text);
  }

  function push(fragment) {
    const frag = (fragment || '').trim();
    if (!frag) return;
    buffer = buffer ? `${buffer} ${frag}` : frag;
    clearTimer();

    // A finished sentence with real content — emit immediately.
    if (SENTENCE_END.test(buffer) && wordCount(buffer) >= minWords) {
      flush();
      return;
    }
    // Run-on with no punctuation — don't hold the rep up.
    if (wordCount(buffer) >= maxWords) {
      flush();
      return;
    }
    // Otherwise wait for a natural pause; more fragments may still be coming.
    timer = setTimeout(flush, pauseMs);
  }

  function reset() {
    clearTimer();
    buffer = '';
  }

  return { push, flush, reset };
}
