import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, PhoneOff, User, Volume2 } from 'lucide-react';
import api from '../../api/client';
import GuidancePanel from '../../components/GuidancePanel.jsx';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.js';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis.js';
import { Badge, Button, Card, LoadingSpinner, ProductSelect, productLabel } from '../../components/ui.jsx';
import PersonAvatar from '../../components/PersonAvatar.jsx';
import styles from './FaceToFace.module.css';

/**
 * Face-to-face channel: the rep's own laptop, sitting across the table from
 * the customer. One shared microphone picks up the live conversation; every
 * finalised line is sent to /guidance/live and the response renders as a
 * non-intrusive, stacked feed the rep can glance at without breaking eye
 * contact with the customer for long.
 */
export default function FaceToFace() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { speak } = useSpeechSynthesis();

  const [conversation, setConversation] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [productType, setProductType] = useState('');
  const [speaker, setSpeaker] = useState('customer');
  const [history, setHistory] = useState([]);
  const [transcriptLog, setTranscriptLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    async function load() {
      const convoRes = await api.get(`/conversations/${conversationId}`);
      const convo = convoRes.data.conversation;
      setConversation(convo);
      setProductType(convo.productContext || '');
      const custRes = await api.get(`/customers/${convo.customerId}`);
      setCustomer(custRes.data.customer);
      setLoading(false);
    }
    load();
  }, [conversationId]);

  async function handleFinalResult(text) {
    setTranscriptLog((log) => [...log, { text, speaker, at: new Date().toISOString() }]);
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await api.post('/guidance/live', { conversationId, text, productType: productType || null, speaker });
      setHistory((h) => [...h, res.data.guidance]);
    } catch (err) {
      console.error('Live guidance failed:', err);
    } finally {
      busyRef.current = false;
    }
  }

  const { isSupported, isListening, interimText, start, stop } = useSpeechRecognition({
    onFinalResult: handleFinalResult,
  });

  async function endSession() {
    setEnding(true);
    stop();
    await api.post(`/conversations/${conversationId}/end`);
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
    <div className="grid lg:grid-cols-[1fr_360px] gap-5">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <PersonAvatar name={customer?.name} emoji={customer?.avatarEmoji || <User size={18} />} className="h-10 w-10 bg-brand-50 text-lg" />
              <div>
                <div className="font-semibold text-slate-800 text-sm">{customer?.name}</div>
                <div className="text-xs text-slate-400">Face-to-face session</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ProductSelect value={productType} onChange={setProductType} includeAll />
              <Button variant="danger" size="sm" onClick={endSession} disabled={ending}>
                <PhoneOff size={14} /> End
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Live conversation mic</h2>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 text-xs">
              <button
                onClick={() => setSpeaker('customer')}
                className={`px-2.5 py-1 rounded-md font-medium ${styles.speakerToggle} ${
                  speaker === 'customer' ? `bg-white shadow-sm text-brand-700 ${styles.speakerToggleActive}` : 'text-slate-500'
                }`}
              >
                Customer speaking
              </button>
              <button
                onClick={() => setSpeaker('agent')}
                className={`px-2.5 py-1 rounded-md font-medium ${styles.speakerToggle} ${
                  speaker === 'agent' ? `bg-white shadow-sm text-brand-700 ${styles.speakerToggleActive}` : 'text-slate-500'
                }`}
              >
                I'm speaking
              </button>
            </div>
          </div>

          {!isSupported ? (
            <p className="text-xs text-rose-600">
              Speech recognition isn't supported in this browser. Try the latest Chrome on desktop.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant={isListening ? 'danger' : 'primary'} onClick={isListening ? stop : start} className={styles.listenBtn}>
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                {isListening ? 'Stop listening' : 'Start listening'}
              </Button>
              {isListening && <span className={`text-xs text-emerald-600 animate-pulse-soft ${styles.liveDot}`}>● Listening…</span>}
            </div>
          )}

          {interimText && <p className="mt-3 text-sm text-slate-400 italic">"{interimText}"</p>}

          <div className="mt-4 max-h-56 overflow-y-auto space-y-1.5 border-t border-slate-100 pt-3">
            {transcriptLog.length === 0 && <p className="text-xs text-slate-400">Transcript will appear here as you talk.</p>}
            {transcriptLog
              .slice()
              .reverse()
              .map((line, idx) => (
                <div key={idx} className={`text-xs ${styles.transcriptLine}`}>
                  <Badge tone={line.speaker === 'agent' ? 'brand' : 'neutral'} className="mr-1.5">
                    {line.speaker === 'agent' ? 'You' : 'Customer'}
                  </Badge>
                  <span className="text-slate-600">{line.text}</span>
                </div>
              ))}
          </div>
        </Card>

        {customer && (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Customer's policies</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {customer.policies.map((p) => (
                <div key={p.id} className={`rounded-xl border border-slate-100 p-3 ${styles.policyTile}`}>
                  <div className="text-xs font-semibold text-slate-700">{productLabel(p.productType)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{p.policyNumber}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="lg:sticky lg:top-20 self-start">
        <Card className="p-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">AI guidance feed</h2>
            <Volume2 size={14} className="text-slate-300" />
          </div>
          <GuidancePanel history={history} onSpeak={(text) => speak(text)} />
        </Card>
      </div>
    </div>
  );
}
