import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';

/**
 * Text-to-speech for reading approved phrasing aloud.
 *
 * Two engines, in preference order:
 *   1. OpenAI TTS (natural voice) — opt in with VITE_USE_OPENAI_TTS=true.
 *      Audio is fetched from the backend /guidance/tts endpoint and played.
 *   2. Browser SpeechSynthesis — always-available, no API key, instant.
 *
 * Any failure in (1) falls straight back to (2), so speech never silently
 * breaks during a live conversation.
 */
function browserTtsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function preferOpenAiTts() {
  return import.meta.env.VITE_USE_OPENAI_TTS === 'true';
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    setIsSupported(browserTtsSupported() || preferOpenAiTts());
  }, []);

  const stopBrowser = useCallback(() => {
    if (browserTtsSupported()) window.speechSynthesis.cancel();
  }, []);

  const stopOpenAi = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);

  const speakBrowser = useCallback((text, { rate = 1, pitch = 1, lang = 'en-SG' } = {}) => {
    if (!browserTtsSupported() || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.lang = lang;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(
    async (text, opts = {}) => {
      if (!text) return;
      stopBrowser();
      stopOpenAi();

      if (!preferOpenAiTts()) {
        speakBrowser(text, opts);
        return;
      }

      // OpenAI natural voice with a hard fallback to the browser engine.
      try {
        setIsSpeaking(true);
        const res = await api.post('/guidance/tts', { text }, { responseType: 'blob' });
        const url = URL.createObjectURL(res.data);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          speakBrowser(text, opts);
        };
        await audio.play();
      } catch (err) {
        console.warn('[useSpeechSynthesis] OpenAI TTS failed, using browser voice:', err.message);
        setIsSpeaking(false);
        speakBrowser(text, opts);
      }
    },
    [speakBrowser, stopBrowser, stopOpenAi]
  );

  const stop = useCallback(() => {
    stopBrowser();
    stopOpenAi();
    setIsSpeaking(false);
  }, [stopBrowser, stopOpenAi]);

  return { speak, stop, isSpeaking, isSupported };
}
