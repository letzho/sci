import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useSpeechRecognition } from './useSpeechRecognition';

const SILENCE_MS = 1200;
const MIN_SPEECH_MS = 500;
const MAX_UTTERANCE_MS = 25000;
const POLL_MS = 80;
const SPEECH_THRESHOLD = 0.012;

const RECORDER_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
  '',
];

function canUseMediaRecorder() {
  return typeof MediaRecorder !== 'undefined';
}

/** Try to create and start a recorder; returns null if this browser/stream combo is unsupported. */
function createStartedRecorder(stream, onChunk) {
  if (!canUseMediaRecorder() || !stream?.getAudioTracks?.().length) return null;

  for (const mimeType of RECORDER_MIME_TYPES) {
    try {
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data?.size) onChunk(e.data);
      };
      recorder.start(250);
      return recorder;
    } catch (err) {
      console.warn('[useWhisperRecognition] MediaRecorder failed:', mimeType || 'default', err.message);
    }
  }
  return null;
}

function blobFilename(mimeType) {
  if (mimeType?.includes('mp4') || mimeType?.includes('aac')) return 'utterance.m4a';
  if (mimeType?.includes('ogg')) return 'utterance.ogg';
  return 'utterance.webm';
}

/**
 * Speech-to-text via OpenAI Whisper (utterances after a pause), with fallback
 * to the browser Web Speech API when Whisper is unavailable or MediaRecorder fails.
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
  const whisperUnavailableRef = useRef(false);
  const modeRef = useRef(mode);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    mediaStreamRef.current = mediaStream;
  }, [mediaStream]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (!enabled) {
      setMode('browser');
      return undefined;
    }
    let cancelled = false;
    api
      .get('/guidance/transcribe/status')
      .then((res) => {
        if (!cancelled && !whisperUnavailableRef.current) {
          setMode(res.data?.whisper ? 'whisper' : 'browser');
        }
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
      if (modeRef.current === 'browser' && onFinalResultRef.current) onFinalResultRef.current(text);
    },
    lang,
    continuous: true,
  });

  const switchToBrowserMode = useCallback(() => {
    whisperUnavailableRef.current = true;
    setMode('browser');
    wantsListeningRef.current = true;
    setIsListening(true);
    if (browser.isSupported) browser.start();
    else setIsSupported(false);
  }, [browser]);

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

  const transcribeBlob = useCallback(async (blob, mimeType) => {
    const form = new FormData();
    form.append('audio', blob, blobFilename(mimeType));
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
    const mimeType = recorder.mimeType || 'audio/webm';

    await new Promise((resolve) => {
      recorder.onstop = resolve;
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    recorderRef.current = null;
    isSpeakingRef.current = false;
    speechStartRef.current = null;
    silenceStartRef.current = null;

    try {
      if (blob.size > 0) {
        const text = await transcribeBlob(blob, mimeType);
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
    if (busyRef.current || recorderRef.current || isSpeakingRef.current) return;
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const recorder = createStartedRecorder(stream, (data) => chunksRef.current.push(data));
    if (!recorder) {
      console.warn('[useWhisperRecognition] MediaRecorder unsupported — using browser speech');
      cleanupWhisper();
      switchToBrowserMode();
      return;
    }

    recorderRef.current = recorder;
    speechStartRef.current = Date.now();
    silenceStartRef.current = null;
    isSpeakingRef.current = true;
    setInterimText('Listening…');
  }, [cleanupWhisper, switchToBrowserMode]);

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
      if (!isSpeakingRef.current && !busyRef.current) startRecorder();
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
    if (!canUseMediaRecorder()) {
      switchToBrowserMode();
      return;
    }

    wantsListeningRef.current = true;
    setIsListening(true);
    try {
      // Dedicated audio stream — recording from a WebRTC video stream breaks MediaRecorder on Safari/mobile.
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      ownedStreamRef.current = true;

      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
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
      if (browser.isSupported) switchToBrowserMode();
      else setIsSupported(false);
    }
  }, [browser.isSupported, pollVolume, switchToBrowserMode]);

  const stopWhisper = useCallback(() => {
    wantsListeningRef.current = false;
    setIsListening(false);
    if (isSpeakingRef.current && recorderRef.current) finalizeRecording();
    cleanupWhisper();
  }, [cleanupWhisper, finalizeRecording]);

  useEffect(() => () => cleanupWhisper(), [cleanupWhisper]);

  const start = useCallback(() => {
    if (mode === 'checking') return;
    if (mode === 'browser' || whisperUnavailableRef.current) {
      if (!browser.isSupported) setIsSupported(false);
      browser.start();
      setIsListening(true);
      return;
    }
    startWhisper();
  }, [browser, mode, startWhisper]);

  const stop = useCallback(() => {
    if (mode === 'browser' || whisperUnavailableRef.current) {
      browser.stop();
      setIsListening(false);
      return;
    }
    stopWhisper();
  }, [browser, mode, stopWhisper]);

  const listening = mode === 'browser' || whisperUnavailableRef.current ? browser.isListening : isListening;
  const interim = mode === 'browser' || whisperUnavailableRef.current ? browser.interimText : interimText;
  const supported = mode === 'browser' || whisperUnavailableRef.current ? browser.isSupported : isSupported;

  return {
    isSupported: supported && mode !== 'checking',
    isListening: listening,
    interimText: interim,
    mode: whisperUnavailableRef.current ? 'browser' : mode,
    ready: mode !== 'checking',
    start,
    stop,
  };
}
