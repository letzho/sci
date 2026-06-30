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

function browserSpeechAvailable() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function supportedMimeTypes() {
  if (!canUseMediaRecorder()) return [];
  return RECORDER_MIME_TYPES.filter((mime) => !mime || MediaRecorder.isTypeSupported(mime));
}

/** Try to create and start a recorder; returns null if unsupported for this stream. */
function createStartedRecorder(stream, onChunk) {
  if (!stream?.getAudioTracks?.().length) return null;

  const mimeTypes = supportedMimeTypes();
  const candidates = mimeTypes.length ? mimeTypes : [''];

  for (const mimeType of candidates) {
    try {
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data?.size) onChunk(e.data);
      };
      recorder.start(250);
      return recorder;
    } catch {
      /* try next mime / stream */
    }
  }
  return null;
}

/** Quick check — WebRTC streams often fail MediaRecorder on Safari/Chrome mobile. */
function canRecordStream(stream) {
  const recorder = createStartedRecorder(stream, () => {});
  if (!recorder) return false;
  try {
    recorder.stop();
  } catch {
    /* noop */
  }
  return true;
}

async function openDedicatedMic(streamRef, ownedStreamRef) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  });
  streamRef.current = stream;
  ownedStreamRef.current = true;
  return stream;
}

function useWebRtcMic(mediaStreamRef, streamRef, ownedStreamRef) {
  const webrtc = mediaStreamRef.current;
  if (!webrtc?.getAudioTracks?.().length) return null;
  streamRef.current = webrtc;
  ownedStreamRef.current = false;
  return webrtc;
}

function cloneWebRtcAudio(mediaStreamRef, streamRef, ownedStreamRef) {
  const track = mediaStreamRef.current?.getAudioTracks?.()[0];
  if (!track) return null;
  const cloned = track.clone();
  streamRef.current = new MediaStream([cloned]);
  ownedStreamRef.current = true;
  return streamRef.current;
}

/** Pick a stream MediaRecorder can actually record (dedicated mic preferred). */
async function resolveRecordableStream(mediaStreamRef, streamRef, ownedStreamRef) {
  try {
    const dedicated = await openDedicatedMic(streamRef, ownedStreamRef);
    if (canRecordStream(dedicated)) return dedicated;
    dedicated.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ownedStreamRef.current = false;
  } catch {
    /* mic may already be held by WebRTC */
  }

  const webrtc = useWebRtcMic(mediaStreamRef, streamRef, ownedStreamRef);
  if (webrtc && canRecordStream(webrtc)) return webrtc;

  const cloned = cloneWebRtcAudio(mediaStreamRef, streamRef, ownedStreamRef);
  if (cloned && canRecordStream(cloned)) return cloned;
  if (cloned) {
    cloned.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ownedStreamRef.current = false;
  }

  return null;
}

function blobFilename(mimeType) {
  if (mimeType?.includes('mp4') || mimeType?.includes('aac')) return 'utterance.m4a';
  if (mimeType?.includes('ogg')) return 'utterance.ogg';
  return 'utterance.webm';
}

function preferWhisperMode() {
  return import.meta.env.VITE_USE_WHISPER === 'true';
}

/**
 * Speech-to-text for virtual calls.
 * Default: browser Web Speech API (Chrome/Edge on localhost — reliable for local demos).
 * Optional: set VITE_USE_WHISPER=true to use OpenAI Whisper via MediaRecorder instead.
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
  const fallbackLoggedRef = useRef(false);

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

    // Default: browser speech (no Whisper / MediaRecorder) — best for local PC demos.
    if (!preferWhisperMode() && browserSpeechAvailable()) {
      setMode('browser');
      return undefined;
    }

    let cancelled = false;
    api
      .get('/guidance/transcribe/status')
      .then((res) => {
        if (cancelled || whisperUnavailableRef.current) return;
        if (preferWhisperMode() && res.data?.whisper && canUseMediaRecorder()) setMode('whisper');
        else if (browserSpeechAvailable()) setMode('browser');
        else setMode('unsupported');
      })
      .catch(() => {
        if (cancelled) return;
        if (browserSpeechAvailable()) setMode('browser');
        else setMode('unsupported');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const browser = useSpeechRecognition({
    onFinalResult: (text) => {
      const useBrowser = modeRef.current === 'browser' || whisperUnavailableRef.current;
      if (useBrowser && onFinalResultRef.current) onFinalResultRef.current(text);
    },
    lang,
    continuous: true,
  });

  const switchToBrowserMode = useCallback(() => {
    cleanupWhisperRef.current?.();
    whisperUnavailableRef.current = true;

    if (!browserSpeechAvailable()) {
      console.warn('[useWhisperRecognition] Whisper unavailable and browser speech not supported on this device');
      setMode('unsupported');
      wantsListeningRef.current = false;
      setIsListening(false);
      setIsSupported(false);
      return;
    }

    if (!fallbackLoggedRef.current) {
      console.info('[useWhisperRecognition] Falling back to browser speech-to-text');
      fallbackLoggedRef.current = true;
    }

    setMode('browser');
    wantsListeningRef.current = true;
    setIsListening(true);
    setIsSupported(true);
    browser.start();
  }, [browser]);

  const cleanupWhisperRef = useRef(null);

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

  cleanupWhisperRef.current = cleanupWhisper;

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
      console.warn('[useWhisperRecognition] Whisper transcribe failed:', err.message);
      switchToBrowserMode();
    } finally {
      setInterimText('');
      busyRef.current = false;
    }
  }, [switchToBrowserMode, transcribeBlob]);

  const startRecorder = useCallback(() => {
    if (busyRef.current || recorderRef.current || isSpeakingRef.current) return;
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const recorder = createStartedRecorder(stream, (data) => chunksRef.current.push(data));
    if (!recorder) {
      switchToBrowserMode();
      return;
    }

    recorderRef.current = recorder;
    speechStartRef.current = Date.now();
    silenceStartRef.current = null;
    isSpeakingRef.current = true;
    setInterimText('Listening…');
  }, [switchToBrowserMode]);

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
      const stream = await resolveRecordableStream(mediaStreamRef, streamRef, ownedStreamRef);
      if (!stream) {
        switchToBrowserMode();
        return;
      }

      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      pollTimerRef.current = setInterval(pollVolume, POLL_MS);
    } catch (err) {
      console.warn('[useWhisperRecognition] Whisper mic setup failed:', err.message);
      switchToBrowserMode();
    }
  }, [pollVolume, switchToBrowserMode]);

  const stopWhisper = useCallback(() => {
    wantsListeningRef.current = false;
    setIsListening(false);
    if (isSpeakingRef.current && recorderRef.current) finalizeRecording();
    cleanupWhisper();
  }, [cleanupWhisper, finalizeRecording]);

  useEffect(() => () => cleanupWhisper(), [cleanupWhisper]);

  const start = useCallback(() => {
    if (mode === 'checking') return;
    if (mode === 'unsupported') return;
    if (mode === 'browser' || whisperUnavailableRef.current) {
      if (!browserSpeechAvailable()) {
        setIsSupported(false);
        return;
      }
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

  const usingBrowser = mode === 'browser' || whisperUnavailableRef.current;
  const listening = usingBrowser ? browser.isListening : isListening;
  const interim = usingBrowser ? browser.interimText : interimText;
  const supported =
    mode === 'unsupported' ? false : usingBrowser ? browser.isSupported || browserSpeechAvailable() : isSupported;

  return {
    isSupported: supported && mode !== 'checking',
    isListening: listening,
    interimText: interim,
    mode: mode === 'unsupported' ? 'unsupported' : usingBrowser ? 'browser' : mode,
    ready: mode !== 'checking',
    start,
    stop,
  };
}
