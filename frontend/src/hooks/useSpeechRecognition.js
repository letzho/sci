import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_UTTERANCE_PAUSE_MS = 1800;
const DEFAULT_MAX_UTTERANCE_MS = 25000;

/**
 * Wraps the browser-native Web Speech API (SpeechRecognition) for continuous,
 * real-time speech-to-text. Final fragments are merged into full sentences
 * (flushed after a short pause) so guidance gets meaningful utterances.
 */
export function useSpeechRecognition({
  onFinalResult,
  lang = 'en-SG',
  continuous = true,
  utterancePauseMs = DEFAULT_UTTERANCE_PAUSE_MS,
  maxUtteranceMs = DEFAULT_MAX_UTTERANCE_MS,
} = {}) {
  const recognitionRef = useRef(null);
  const wantsListeningRef = useRef(false);
  const onFinalResultRef = useRef(onFinalResult);
  const bufferRef = useRef('');
  const flushTimerRef = useRef(null);
  const utteranceStartRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  const flushBuffer = useCallback((force = false) => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const text = bufferRef.current.trim();
    bufferRef.current = '';
    utteranceStartRef.current = null;
    if (text) {
      onFinalResultRef.current?.(text);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => flushBuffer(true), utterancePauseMs);

    const now = Date.now();
    if (!utteranceStartRef.current) utteranceStartRef.current = now;
    if (now - utteranceStartRef.current >= maxUtteranceMs) {
      flushBuffer(true);
    }
  }, [flushBuffer, maxUtteranceMs, utterancePauseMs]);

  const appendFinal = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      bufferRef.current = bufferRef.current ? `${bufferRef.current} ${trimmed}` : trimmed;
      scheduleFlush();
    },
    [scheduleFlush]
  );

  useEffect(() => {
    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      setIsSupported(false);
      return undefined;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let interim = '';
      let finalsInEvent = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          const trimmed = text.trim();
          if (trimmed) finalsInEvent = finalsInEvent ? `${finalsInEvent} ${trimmed}` : trimmed;
        } else {
          interim += text;
        }
      }

      if (finalsInEvent) appendFinal(finalsInEvent);
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        console.warn('[useSpeechRecognition] mic permission denied');
        wantsListeningRef.current = false;
        setIsListening(false);
      } else if (event.error === 'audio-capture') {
        console.warn('[useSpeechRecognition] microphone unavailable (may be in use by another app or WebRTC)');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn('[useSpeechRecognition] error:', event.error);
      }
    };

    recognition.onend = () => {
      if (wantsListeningRef.current) {
        setTimeout(() => {
          if (wantsListeningRef.current) {
            try {
              recognition.start();
            } catch {
              /* already restarting */
            }
          }
        }, 100);
      } else {
        flushBuffer(true);
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      wantsListeningRef.current = false;
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
    };
  }, [appendFinal, continuous, flushBuffer, lang]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    bufferRef.current = '';
    utteranceStartRef.current = null;
    wantsListeningRef.current = true;
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    wantsListeningRef.current = false;
    flushBuffer(true);
    setIsListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
  }, [flushBuffer]);

  return { isSupported, isListening, interimText, start, stop };
}
