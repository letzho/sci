import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useSpeechRecognition } from './useSpeechRecognition';

const SILENCE_MS = 1200;
const MIN_SPEECH_MS = 500;
const MAX_UTTERANCE_MS = 25000;
const POLL_MS = 80;
const SPEECH_THRESHOLD = 0.012;

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

/**
 * Speech-to-text via OpenAI Whisper (full utterances after a pause), with
 * automatic fallback to the browser Web Speech API when OPENAI_API_KEY is
 * not configured on the backend.
 */
export function useWhisperRecognition({ onFinalResult, mediaStream, lang = 'en-SG', enabled = true } = {}) {
  const onFinalResultRef = useRef(onFinalResult);
  const [mode, setMode] = useState('checking');
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported, setIsSupported] = useState(true);

  const streamRef = useRef(null);
  const ownedStreamRef = useRef(false);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const pollTimerRef = useRef(null);
  const speechStartRef = useRef(null);
  const silenceStartRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const wantsListeningRef = useRef(false);
  const busyRef = useRef(false);
  const mediaStreamRef = useRef(mediaStream);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    mediaStreamRef.current = mediaStream;
  }, [mediaStream]);

  useEffect(() => {
    if (!enabled) {
      setMode('browser');
      return undefined;
    }
    let cancelled = false;
    api
      .get('/guidance/transcribe/status')
      .then((res) => {
        if (!cancelled) setMode(res.data?.whisper ? 'whisper' : 'browser');
      })
      .catch(() => {
        if (!cancelled) setMode('browser');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const browser = useSpeechRecognition({
    onFinalResult: (text) => {
      if (mode === 'browser' && onFinalResultRef.current) onFinalResultRef.current(text);
    },
    lang,
    continuous: true,
  });

  const cleanupWhisper = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (recorderRef.current?.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    isSpeakingRef.current = false;
    speechStartRef.current = null;
    silenceStartRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (ownedStreamRef.current && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    ownedStreamRef.current = false;
  }, []);

  const transcribeBlob = useCallback(async (blob) => {
    const form = new FormData();
    form.append('audio', blob, 'utterance.webm');
    const res = await api.post('/guidance/transcribe', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.text?.trim() || null;
  }, []);

  const finalizeRecording = useCallback(async () => {
    if (busyRef.current) return;
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    busyRef.current = true;
    setInterimText('Transcribing…');

    await new Promise((resolve) => {
      recorder.onstop = resolve;
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
    chunksRef.current = [];
    recorderRef.current = null;
    isSpeakingRef.current = false;
    speechStartRef.current = null;
    silenceStartRef.current = null;

    try {
      if (blob.size > 0) {
        const text = await transcribeBlob(blob);
        if (text && onFinalResultRef.current) onFinalResultRef.current(text);
      }
    } catch (err) {
      console.warn('[useWhisperRecognition] transcribe failed:', err.message);
    } finally {
      setInterimText('');
      busyRef.current = false;
    }
  }, [transcribeBlob]);

  const startRecorder = useCallback(() => {
    const stream = streamRef.current;
    const mimeType = pickMimeType();
    if (!stream || !mimeType || busyRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data?.size) chunksRef.current.push(e.data);
    };
    recorder.start(250);
    recorderRef.current = recorder;
    speechStartRef.current = Date.now();
    silenceStartRef.current = null;
    isSpeakingRef.current = true;
    setInterimText('Listening…');
  }, []);

  const pollVolume = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !wantsListeningRef.current) return;

    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    const now = Date.now();

    if (rms >= SPEECH_THRESHOLD) {
      silenceStartRef.current = null;
      if (!isSpeakingRef.current) startRecorder();
    } else if (isSpeakingRef.current && recorderRef.current) {
      if (!silenceStartRef.current) silenceStartRef.current = now;
      const spokeMs = speechStartRef.current ? now - speechStartRef.current : 0;
      const silentMs = now - silenceStartRef.current;
      const tooLong = speechStartRef.current && now - speechStartRef.current > MAX_UTTERANCE_MS;
      if ((silentMs >= SILENCE_MS && spokeMs >= MIN_SPEECH_MS) || tooLong) {
        finalizeRecording();
      }
    }
  }, [finalizeRecording, startRecorder]);

  const startWhisper = useCallback(async () => {
    wantsListeningRef.current = true;
    setIsListening(true);
    try {
      const extStream = mediaStreamRef.current;
      if (extStream?.getAudioTracks?.().length) {
        streamRef.current = extStream;
        ownedStreamRef.current = false;
      } else {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        ownedStreamRef.current = true;
      }
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(streamRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      pollTimerRef.current = setInterval(pollVolume, POLL_MS);
    } catch (err) {
      console.warn('[useWhisperRecognition] mic setup failed:', err.message);
      wantsListeningRef.current = false;
      setIsListening(false);
      setIsSupported(false);
    }
  }, [pollVolume]);

  const stopWhisper = useCallback(() => {
    wantsListeningRef.current = false;
    setIsListening(false);
    if (isSpeakingRef.current && recorderRef.current) finalizeRecording();
    cleanupWhisper();
  }, [cleanupWhisper, finalizeRecording]);

  useEffect(() => () => cleanupWhisper(), [cleanupWhisper]);

  const start = useCallback(() => {
    if (mode === 'checking') return;
    if (mode === 'browser') {
      if (!browser.isSupported) setIsSupported(false);
      browser.start();
      setIsListening(true);
      return;
    }
    startWhisper();
  }, [browser, mode, startWhisper]);

  const stop = useCallback(() => {
    if (mode === 'browser') {
      browser.stop();
      setIsListening(false);
      return;
    }
    stopWhisper();
  }, [browser, mode, stopWhisper]);

  const listening = mode === 'browser' ? browser.isListening : isListening;
  const interim = mode === 'browser' ? browser.interimText : interimText;
  const supported = mode === 'browser' ? browser.isSupported : isSupported;

  return {
    isSupported: supported && mode !== 'checking',
    isListening: listening,
    interimText: interim,
    mode,
    ready: mode !== 'checking',
    start,
    stop,
  };
}
