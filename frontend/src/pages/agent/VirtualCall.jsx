import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, PhoneOff, Shield, Video, VideoOff } from 'lucide-react';
import api from '../../api/client';
import { getSocket } from '../../socket.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWebRTC } from '../../hooks/useWebRTC.js';
import { useWhisperRecognition } from '../../hooks/useWhisperRecognition.js';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis.js';
import AgentToolsPanel from '../../components/AgentToolsPanel.jsx';
import ObjectionBusterPanel from '../../components/ObjectionBusterPanel.jsx';
import { Badge, Button, Card, LoadingSpinner, productLabel } from '../../components/ui.jsx';
import { attachVideoStream } from '../../utils/videoStream.js';
import styles from './VirtualCall.module.css';

const STATUS_LABEL = {
  idle: 'Waiting to connect…',
  connecting: 'Connecting…',
  connected: 'Connected',
  failed: 'Connection failed',
  ended: 'Call ended',
  disconnected: 'Disconnected',
};

/**
 * The flagship channel: a real two-way webcam call between the rep and the
 * customer, with smart, non-intrusive guidance appearing on the rep's screen
 * only - driven both by what the customer says (relayed via socket) and by
 * the rep's own speech (compliance self-check), never visible to the customer.
 */
export default function VirtualCall() {
  const { conversationId } = useParams();
  const { agent } = useAuth();
  const navigate = useNavigate();
  const { speak } = useSpeechSynthesis();

  const [conversation, setConversation] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [customerCaption, setCustomerCaption] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [callStatus, setCallStatus] = useState(null); // 'ringing' | 'no-presence' | 'declined' | null
  const [guidanceError, setGuidanceError] = useState(null);
  const [objectionOpen, setObjectionOpen] = useState(false);
  const [socket] = useState(() => getSocket());

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const conversationRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    async function load() {
      const convoRes = await api.get(`/conversations/${conversationId}`);
      setConversation(convoRes.data.conversation);
      const custRes = await api.get(`/customers/${convoRes.data.conversation.customerId}`);
      setCustomer(custRes.data.customer);
      setLoading(false);
    }
    load();
  }, [conversationId]);

  const { localStream, remoteStream, connectionState, mediaError, roomStatus, iceDebug, toggleTrack, endCall, reconnectVideo, startLocalMedia } = useWebRTC({
    socket,
    conversationId,
    role: 'agent',
    displayName: agent?.name,
  });

  useEffect(() => {
    attachVideoStream(localVideoRef.current, localStream);
  }, [localStream]);

  useEffect(() => {
    attachVideoStream(remoteVideoRef.current, remoteStream);
  }, [remoteStream]);

  // Guidance driven by the customer's speech (server relays this to the agent only).
  useEffect(() => {
    if (!socket) return undefined;

    const handleTranscript = ({ text }) => setCustomerCaption(text);
    const handleGuidance = ({ guidance }) => {
      console.log('[VirtualCall] guidance-update received:', guidance);
      setGuidanceError(null);
      setHistory((h) => [...h, guidance]);
    };
    const handleCallEnded = () => navigate('/agent');
    const handleCallRinging = ({ reached }) => setCallStatus(reached ? 'ringing' : 'no-presence');
    const handleCallDeclined = () => setCallStatus('declined');

    console.log('[VirtualCall] registering socket listeners, socket.id=', socket.id);
    socket.on('transcript-update', handleTranscript);
    socket.on('guidance-update', handleGuidance);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-ringing', handleCallRinging);
    socket.on('call-declined', handleCallDeclined);

    return () => {
      socket.off('transcript-update', handleTranscript);
      socket.off('guidance-update', handleGuidance);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-ringing', handleCallRinging);
      socket.off('call-declined', handleCallDeclined);
    };
  }, [navigate, socket]);

  // Clear any stale ringing/declined hint once the customer actually joins.
  useEffect(() => {
    if (roomStatus.clientPresent) setCallStatus(null);
  }, [roomStatus.clientPresent]);

  // Self-compliance check: the rep's own mic is also screened live.
  async function handleAgentFinal(text) {
    const conv = conversationRef.current;
    if (busyRef.current || !conv) return;
    busyRef.current = true;
    try {
      const res = await api.post('/guidance/live', {
        conversationId,
        text,
        productType: conv.productContext,
        speaker: 'agent',
      });
      setGuidanceError(null);
      setHistory((h) => [...h, res.data.guidance]);
    } catch (err) {
      console.error('Agent self-check guidance failed:', err);
      setGuidanceError(err.response?.data?.error || 'Could not fetch live guidance. Check that the backend is running.');
    } finally {
      busyRef.current = false;
    }
  }

  const { isListening, isSupported, start: startListening, stop: stopListening, ready } = useWhisperRecognition({
    onFinalResult: handleAgentFinal,
    mediaStream: localStream,
  });

  // Start speech recognition after WebRTC has the mic, so it doesn't race getUserMedia.
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
    await api.post(`/conversations/${conversationId}/end`).catch(() => {});
    navigate('/agent');
  }

  if (loading) {
    return (
      <div className="py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="relative">
      {objectionOpen && (
        <>
          <button type="button" className="fixed inset-0 bg-black/30 z-40" onClick={() => setObjectionOpen(false)} aria-label="Close objections" />
          <ObjectionBusterPanel
            productType={conversation?.productContext}
            customerName={customer?.name}
            onClose={() => setObjectionOpen(false)}
          />
        </>
      )}

    <div className="grid lg:grid-cols-[1fr_340px] gap-5">
      <div className="space-y-3">
        <div className={`relative bg-slate-900 rounded-2xl overflow-hidden aspect-video ${styles.stage}`}>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

          {!roomStatus.clientPresent && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center text-white/80 bg-slate-900/70 ${styles.waitingOverlay}`}>
              <Video size={28} className="mb-2 opacity-60" />
              <p className="text-sm">Waiting for {customer?.name || 'the customer'} to join the call…</p>
              {callStatus === 'ringing' && <p className="text-xs text-emerald-300 mt-1">Ringing their Client Portal…</p>}
              {callStatus === 'no-presence' && (
                <p className="text-xs text-amber-300 mt-1 max-w-xs text-center">
                  They're not online right now - ask them to open the Client Portal.
                </p>
              )}
              {callStatus === 'declined' && <p className="text-xs text-rose-300 mt-1">Call declined.</p>}
            </div>
          )}

          {customerCaption && roomStatus.clientPresent && (
            <div className={`absolute bottom-4 left-4 right-28 bg-black/60 text-white text-xs rounded-lg px-3 py-2 ${styles.captionBubble}`}>
              "{customerCaption}"
            </div>
          )}

          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-black/45 text-white ${styles.statusPill}`}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${styles.statusDot} ${
                  connectionState === 'connected' ? `bg-emerald-400 ${styles.statusDotLive}` : 'bg-slate-300'
                }`}
              />
              {STATUS_LABEL[connectionState] || connectionState}
            </span>
            {conversation && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium bg-black/45 text-white ${styles.statusPill}`}>
                {productLabel(conversation.productContext)}
              </span>
            )}
          </div>

          <div className={`absolute bottom-4 right-4 w-32 aspect-video rounded-xl overflow-hidden border-2 border-white/20 bg-slate-800 ${styles.pip}`}>
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
        </div>

        {mediaError && (
          <Card className="p-3 border-rose-200 bg-rose-50 space-y-2">
            <p className="text-xs text-rose-700">Camera/microphone: {mediaError}</p>
            <Button size="sm" variant="outline" onClick={() => startLocalMedia()}>
              Enable camera
            </Button>
          </Card>
        )}

        {(connectionState === 'failed' || connectionState === 'disconnected') && roomStatus.clientPresent && (
          <Card className="p-3 border-amber-200 bg-amber-50 space-y-2">
            <p className="text-xs text-amber-800">
              Video could not connect across networks. Tap retry — we will route through a relay server (TURN).
            </p>
            {iceDebug && <p className="text-[10px] text-amber-700">{iceDebug}</p>}
            <Button size="sm" variant="outline" onClick={reconnectVideo}>
              Retry video connection
            </Button>
          </Card>
        )}

        <Card className={`p-3 flex items-center justify-center gap-3 flex-wrap ${styles.controlBar}`}>
          <Button variant={micOn ? 'outline' : 'danger'} size="sm" onClick={toggleMic}>
            {micOn ? <Mic size={15} /> : <MicOff size={15} />}
          </Button>
          <Button variant={camOn ? 'outline' : 'danger'} size="sm" onClick={toggleCam}>
            {camOn ? <Video size={15} /> : <VideoOff size={15} />}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setObjectionOpen(true)} title="Objection Buster — Feel-Felt-Found scripts">
            <Shield size={15} /> Objections
          </Button>
          <Button variant="danger" size="sm" onClick={handleEndCall}>
            <PhoneOff size={15} /> End call
          </Button>
          {isListening && <span className="text-[11px] text-emerald-600 ml-2">● Self-check listening</span>}
        </Card>

        {customer && (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">{customer.name}'s policies</h2>
            <div className="flex flex-wrap gap-1.5">
              {customer.policies.map((p) => (
                <Badge key={p.id} tone="neutral">
                  {productLabel(p.productType)}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="lg:sticky lg:top-20 self-start">
        <AgentToolsPanel
          conversationId={conversationId}
          productType={conversation?.productContext}
          customerName={customer?.name}
          customerId={customer?.id || conversation?.customerId}
          agentName={agent?.name}
          socket={socket}
          history={history}
          guidanceError={guidanceError}
          isSupported={isSupported}
          onSpeak={(text) => speak(text)}
        />
      </div>
    </div>
    </div>
  );
}
