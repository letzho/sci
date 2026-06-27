import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wraps the browser-native Web Speech API (SpeechRecognition) for continuous,
 * real-time speech-to-text. Free, no API key, no network round-trip - this
 * is the "Browser-native Web Speech API" option (best support in Chrome).
 */
export function useSpeechRecognition({ onFinalResult, lang = 'en-SG', continuous = true } = {}) {
  const recognitionRef = useRef(null);
  const wantsListeningRef = useRef(false);
  const onFinalResultRef = useRef(onFinalResult);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

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
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          const trimmed = text.trim();
          if (trimmed && onFinalResultRef.current) onFinalResultRef.current(trimmed);
        } else {
          interim += text;
        }
      }
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
      // 'aborted' and 'no-speech' are transient — onend will auto-restart
    };

    recognition.onend = () => {
      if (wantsListeningRef.current) {
        // Small delay avoids the "already starting" race that causes aborted errors
        // when StrictMode or rapid stop/start cycles happen
        setTimeout(() => {
          if (wantsListeningRef.current) {
            try {
              recognition.start();
            } catch (_) {
              /* already restarting */
            }
          }
        }, 100);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      wantsListeningRef.current = false;
      try {
        recognition.stop();
      } catch (_) {
        /* noop */
      }
    };
  }, [lang, continuous]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    wantsListeningRef.current = true;
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (_) {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    wantsListeningRef.current = false;
    setIsListening(false);
    try {
      recognitionRef.current && recognitionRef.current.stop();
    } catch (_) {
      /* noop */
    }
  }, []);

  return { isSupported, isListening, interimText, start, stop };
}
