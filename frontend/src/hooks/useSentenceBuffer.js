import { useCallback, useEffect, useRef } from 'react';
import { createSentenceBuffer } from '../utils/sentenceBuffer.js';

/**
 * React wrapper around createSentenceBuffer. Returns a stable `push(fragment)`
 * to feed raw transcription finals into, and only calls `onSentence` when a
 * complete spoken sentence has formed. Flushes any trailing text on unmount.
 *
 * `onSentence` can change freely (it often closes over fresh state) — the
 * latest version is always used via a ref, so the buffer itself stays stable.
 */
export function useSentenceBuffer(onSentence, options = {}) {
  const onSentenceRef = useRef(onSentence);
  useEffect(() => {
    onSentenceRef.current = onSentence;
  }, [onSentence]);

  const bufferRef = useRef(null);
  if (!bufferRef.current) {
    bufferRef.current = createSentenceBuffer({
      onSentence: (sentence) => onSentenceRef.current?.(sentence),
      ...options,
    });
  }

  useEffect(() => {
    const buffer = bufferRef.current;
    return () => buffer.flush();
  }, []);

  const push = useCallback((fragment) => bufferRef.current.push(fragment), []);
  const flush = useCallback(() => bufferRef.current.flush(), []);
  const reset = useCallback(() => bufferRef.current.reset(), []);

  return { push, flush, reset };
}
