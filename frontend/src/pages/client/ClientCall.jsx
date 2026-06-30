import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import api from '../../api/client';
import { getSocket } from '../../socket.js';
import { useWebRTC } from '../../hooks/useWebRTC.js';
import { useWhisperRecognition } from '../../hooks/useWhisperRecognition.js';
import ClientQuizOverlay from '../../components/ClientQuizOverlay.jsx';
import GameSurveyOverlay from '../../components/gameSurvey/GameSurveyOverlay.jsx';
import ClientCoffeeChatOverlay from '../../components/ClientCoffeeChatOverlay.jsx';
import ClientCalculatorOverlay from '../../components/ClientCalculatorOverlay.jsx';
import Logo from '../../components/Logo.jsx';
import PersonAvatar from '../../components/PersonAvatar.jsx';
import { Button, Card, LoadingSpinner } from '../../components/ui.jsx';
import { attachVideoStream } from '../../utils/videoStream.js';
import styles from './ClientCall.module.css';

const STATUS_LABEL = {
  idle: 'Calling…',
  connecting: 'Connecting…',
  connected: 'Connected',
  failed: 'Connection failed',
  ended: 'Call ended',
  disconnected: 'Disconnected',
};

/**
 * Customer-facing call screen: a clean, consumer-grade video call. No
 * compliance internals or AI guidance are ever shown here - that backstage
 * tooling is for the representative only. The customer's speech is
 * transcribed locally only to drive the rep's guidance server-side.
 */
export default function ClientCall() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversation, setConversation] = useState(null);
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [socket] = useState(() => getSocket());
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [activeGameSurvey, setActiveGameSurvey] = useState(null);
  const [coffeeInvite, setCoffeeInvite] = useState(null);
  const [calculatorResult, setCalculatorResult] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const conversationRef = useRef(null);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    async function load() {
      const convoRes = await api.get(`/conversations/${conversationId}`);
      setConversation(convoRes.data.conversation);
      const [agentsRes, custRes] = await Promise.all([
        api.get('/agents/primary'),
        api.get(`/customers/${convoRes.data.conversation.customerId}`),
      ]);
      setAgent(agentsRes.data.agent);
      setCustomerProfile(custRes.data.customer);
      setLoading(false);
    }
    load();
  }, [conversationId]);

  const { localStream, remoteStream, connectionState, mediaError, roomStatus, iceDebug, toggleTrack, endCall, reconnectVideo, startLocalMedia } = useWebRTC({
    socket,
    conversationId,
    role: 'client',
  });

  useEffect(() => {
    attachVideoStream(localVideoRef.current, localStream);
  }, [localStream]);

  useEffect(() => {
    attachVideoStream(remoteVideoRef.current, remoteStream);
  }, [remoteStream]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleCallEnded = () => navigate('/client');
    const handleQuizStart = ({ quiz }) => setActiveQuiz(quiz);
    const handleGameSurveyStart = ({ survey }) => {
      setActiveQuiz(null);
      setActiveGameSurvey(survey);
    };
    const handleCoffeeInvite = (payload) => setCoffeeInvite(payload);
    const handleCalculator = ({ result }) => setCalculatorResult(result);

    socket.on('call-ended', handleCallEnded);
    socket.on('quiz-start', handleQuizStart);
    socket.on('game-survey-start', handleGameSurveyStart);
    socket.on('coffee-chat-invite', handleCoffeeInvite);
    socket.on('calculator-shared', handleCalculator);

    return () => {
      socket.off('call-ended', handleCallEnded);
      socket.off('quiz-start', handleQuizStart);
      socket.off('game-survey-start', handleGameSurveyStart);
      socket.off('coffee-chat-invite', handleCoffeeInvite);
      socket.off('calculator-shared', handleCalculator);
    };
  }, [navigate, socket]);

  function handleGameSurveySubmit(answers, gameChoice) {
    socket.emit('game-survey-submit', {
      conversationId,
      productType: conversation?.productContext,
      answers,
      gameChoice,
      customerName: customerProfile?.name || 'Customer',
    });
  }

  function handleQuizSubmit(answers, onGraded) {
    socket.emit('quiz-submit', {
      conversationId,
      productType: conversation?.productContext,
      answers,
      customerName: customerProfile?.name || 'Customer',
    });
    socket.once('quiz-result', ({ grade }) => onGraded(grade));
  }

  function handleFinal(text) {
    const conv = conversationRef.current;
    socket.emit('customer-speech', {
      conversationId,
      text,
      productType: conv?.productContext,
    });
  }

  const { start: startListening, stop: stopListening, ready } = useWhisperRecognition({
    onFinalResult: handleFinal,
    mediaStream: localStream,
  });

  useEffect(() => {
    if (!localStream || !conversation || !ready) return undefined;
    startListening();
    return () => stopListening();
  }, [localStream, conversation, ready, startListening, stopListening]);

  function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    toggleTrack('audio', next);
  }

  function toggleCam() {
    const next = !camOn;
    setCamOn(next);
    toggleTrack('video', next);
  }

  async function handleEndCall() {
    stopListening();
    endCall();
    navigate('/client');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-900 flex flex-col ${styles.screen}`}>
      {activeGameSurvey && (
        <GameSurveyOverlay
          survey={activeGameSurvey}
          customerName={customerProfile?.name}
          onSubmit={handleGameSurveySubmit}
          onDismiss={() => setActiveGameSurvey(null)}
        />
      )}
      {activeQuiz && !activeGameSurvey && (
        <ClientQuizOverlay
          quiz={activeQuiz}
          onSubmit={handleQuizSubmit}
          onDismiss={() => setActiveQuiz(null)}
        />
      )}
      {coffeeInvite && (
        <ClientCoffeeChatOverlay
          invite={coffeeInvite}
          agentName={coffeeInvite.agentName || agent?.name}
          onAccept={() => setCoffeeInvite(null)}
          onDismiss={() => setCoffeeInvite(null)}
        />
      )}
      {calculatorResult && !activeQuiz && (
        <ClientCalculatorOverlay result={calculatorResult} onDismiss={() => setCalculatorResult(null)} />
      )}
      <div className="flex items-center justify-between px-5 py-4">
        <Logo size={28} light />
        <span className="text-xs text-white/60">{STATUS_LABEL[connectionState] || connectionState}</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className={`relative w-full max-w-3xl aspect-video bg-slate-800 rounded-2xl overflow-hidden ${styles.stage}`}>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

          {!roomStatus.agentPresent && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
              <PersonAvatar
                name={agent?.name}
                emoji={agent?.avatarEmoji || '🧑‍💼'}
                className={`h-16 w-16 bg-brand-600 text-2xl mb-3 ${styles.waitingAvatar}`}
              />
              <p className="text-sm">Waiting for {agent?.name || 'your representative'} to join…</p>
            </div>
          )}

          <div className={`absolute bottom-4 right-4 w-28 aspect-video rounded-xl overflow-hidden border-2 border-white/20 bg-slate-700 ${styles.pip}`}>
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {mediaError && (
        <div className="px-5 pb-2">
          <Card className="p-3 border-rose-200 bg-rose-50 max-w-3xl mx-auto space-y-2">
            <p className="text-xs text-rose-700">{mediaError}</p>
            <button type="button" onClick={() => startLocalMedia()} className="text-xs font-semibold text-rose-800 underline">
              Enable camera &amp; microphone
            </button>
          </Card>
        </div>
      )}

      {!localStream && !mediaError && (
        <div className="px-5 pb-2 text-center">
          <button type="button" onClick={() => startLocalMedia()} className="text-xs text-white/80 underline">
            Tap to enable your camera
          </button>
        </div>
      )}

      {connectionState !== 'connected' && roomStatus.agentPresent && (
        <div className="px-5 pb-2 text-center text-[11px] text-white/50">
          {connectionState === 'connecting' ? 'Connecting video…' : 'Waiting for video link…'}
          {iceDebug ? ` (${iceDebug})` : ''}
        </div>
      )}

      {(connectionState === 'failed' || connectionState === 'disconnected') && roomStatus.agentPresent && (
        <div className="px-5 pb-2">
          <Card className="p-3 border-amber-200 bg-amber-50 max-w-3xl mx-auto space-y-2">
            <p className="text-xs text-amber-800">Video link failed — tap retry to connect through a relay.</p>
            {iceDebug && <p className="text-[10px] text-amber-700">{iceDebug}</p>}
            <button
              type="button"
              onClick={reconnectVideo}
              className="text-xs font-semibold text-amber-900 underline"
            >
              Retry video connection
            </button>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 py-6">
        <button
          onClick={toggleMic}
          className={`h-12 w-12 rounded-full flex items-center justify-center ${styles.controlBtn} ${micOn ? 'bg-white/15 text-white' : 'bg-rose-600 text-white'}`}
        >
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button
          onClick={toggleCam}
          className={`h-12 w-12 rounded-full flex items-center justify-center ${styles.controlBtn} ${camOn ? 'bg-white/15 text-white' : 'bg-rose-600 text-white'}`}
        >
          {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
        <button onClick={handleEndCall} className={`h-12 w-12 rounded-full bg-rose-600 text-white flex items-center justify-center ${styles.endBtn}`}>
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
