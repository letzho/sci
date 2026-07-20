import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FileText, Loader2, Paperclip, Send, ShieldCheck, BookOpen } from 'lucide-react';
import api from '../../api/client';
import { getSocket } from '../../socket.js';
import GameSurveyOverlay from '../../components/gameSurvey/GameSurveyOverlay.jsx';
import PhoneFrame from '../../components/PhoneFrame.jsx';
import PersonAvatar from '../../components/PersonAvatar.jsx';
import { LoadingSpinner } from '../../components/ui.jsx';
import { mapConversationMessages } from '../../utils/chatMessageFormat.js';
import { fetchClientAgent } from '../../utils/clientAgent.js';
import styles from './ClientChat.module.css';

// 'policy_document' messages carry a JSON-encoded payload in `content`
// (see backend/src/routes/policyUploads.routes.js) rather than plain text -
// this unpacks it once so rendering can stay simple.
function parsePolicyMessage(m) {
  if (m.kind !== 'policy_document') return m;
  let policy = {};
  try {
    policy = JSON.parse(m.content);
  } catch {
    policy = {};
  }
  return { ...m, policy };
}

/**
 * Customer-facing chat: a plain messaging thread. AI drafting and review
 * happen entirely on the representative's side - the customer only ever
 * sees the final, human-approved reply. The one exception is sharing a
 * policy PDF: the customer can attach their own policy document so their
 * representative's Interpreter Agent can analyze it ahead of the
 * conversation (backend/src/agents/interpreterAgent.js).
 */
export default function ClientChat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [activeGameSurvey, setActiveGameSurvey] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState({}); // messageId -> feedback
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      const convoRes = await api.get(`/conversations/${conversationId}`);
      setMessages(
        mapConversationMessages(
          convoRes.data.messages.filter((m) => m.kind !== 'draft' && m.kind !== 'transcript'),
          { forClient: true }
        ).map(parsePolicyMessage)
      );
      const agentRes = await fetchClientAgent();
      setAgent(agentRes.data.agent);
      const custRes = await api.get(`/customers/${convoRes.data.conversation.customerId}`);
      setCustomerProfile(custRes.data.customer);
      setLoading(false);
    }
    load();
  }, [conversationId]);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    socket.emit('join-room', { conversationId, role: 'client' });

    const handleChatMessage = ({ sender, text: msgText, at, sources, informational }) => {
      setMessages((prev) => [
        ...prev,
        { id: `${at}-${Math.random()}`, sender, content: msgText, createdAt: at, sources: sources || [], informational: Boolean(informational) },
      ]);
    };
    const handlePolicyShared = ({ message }) => {
      setMessages((prev) => [...prev, parsePolicyMessage(message)]);
    };
    const handleGameSurveyStart = ({ deck }) => setActiveGameSurvey(deck);
    socket.on('chat-message', handleChatMessage);
    socket.on('policy-shared', handlePolicyShared);
    socket.on('game-survey-start', handleGameSurveyStart);
    return () => {
      socket.emit('leave-room', { conversationId });
      socket.off('chat-message', handleChatMessage);
      socket.off('policy-shared', handlePolicyShared);
      socket.off('game-survey-start', handleGameSurveyStart);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage() {
    if (!text.trim()) return;
    socketRef.current.emit('chat-message', { conversationId, sender: 'customer', text: text.trim() });
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, sender: 'customer', content: text.trim(), createdAt: new Date().toISOString() }]);
    setText('');
  }

  // One-tap clarity response under a rep message. Tells the rep whether the
  // customer understood (or wants it simpler) — engaging, and it builds trust
  // because the customer is heard, not just talked at. For "unclear"/"simpler"
  // the backend notifies the rep AND prepares simpler re-explanation drafts.
  function sendClarityFeedback(msg, feedback) {
    socketRef.current?.emit('clarity-feedback', { conversationId, feedback, text: msg.content });
    setFeedbackGiven((prev) => ({ ...prev, [msg.id]: feedback }));
  }

  async function handlePolicyUpload(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setUploadError('Please choose a PDF file.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('conversationId', conversationId);
      await api.post('/policy-uploads', formData);
      // The new message (with its analysis) arrives via the 'policy-shared'
      // socket event above, the same way an incoming chat message would.
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed - please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleGameSurveySubmit(gameChoice, cardsViewed) {
    socketRef.current?.emit('game-survey-submit', {
      conversationId,
      gameChoice,
      cardsViewed,
      customerName: customerProfile?.name || 'Customer',
    });
  }

  if (loading) {
    return (
      <PhoneFrame>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </PhoneFrame>
    );
  }

  return (
    <>
      {activeGameSurvey && (
        <GameSurveyOverlay
          deck={activeGameSurvey}
          customerName={customerProfile?.name}
          onSubmit={handleGameSurveySubmit}
          onDismiss={() => setActiveGameSurvey(null)}
        />
      )}
      <PhoneFrame
      footer={
        <div className="p-3">
          {uploadError && (
            <div className="flex items-center gap-1.5 text-[11px] text-rose-600 mb-1.5">
              <AlertTriangle size={12} /> {uploadError}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Share your policy PDF"
              className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                handlePolicyUpload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message…"
              className={`flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 ${styles.composerInput}`}
            />
            <button onClick={sendMessage} className={`h-9 w-9 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 ${styles.sendBtn}`}>
              <Send size={15} />
            </button>
          </div>
        </div>
      }
    >
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 ${styles.header}`}>
        <button onClick={() => navigate('/client')} className="text-slate-400">
          <ArrowLeft size={18} />
        </button>
        <PersonAvatar name={agent?.name} emoji={agent?.avatarEmoji} className={`h-9 w-9 bg-brand-50 text-base ${styles.avatar}`} />
        <div className="font-semibold text-sm text-slate-800">{agent?.name}</div>
      </div>

      {/* Trust & transparency banner — sets an honest frame from the first second. */}
      <div className="flex items-start gap-1.5 px-4 py-2 bg-emerald-50/70 border-b border-emerald-100">
        <ShieldCheck size={13} className="text-emerald-600 mt-0.5 shrink-0" />
        <p className="text-[10px] text-emerald-800 leading-snug">
          {agent?.name?.split(' ')[0] || 'Your representative'} reviews every reply personally. Answers use only approved information, shown with their source — and nothing is ever sold to you automatically.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && <p className="text-xs text-slate-400 text-center mt-6">Say hello to start the conversation.</p>}
        {(() => {
          // Only the latest INFORMATIONAL reply gets the feedback prompt — a
          // simple "sure" or a question sent after an explanation shouldn't
          // bump the prompt onto itself, and shouldn't suppress it either.
          const lastInformationalId = [...messages]
            .reverse()
            .find((m) => m.sender === 'agent' && m.kind !== 'policy_document' && m.informational)?.id;
          return messages.map((m) => {
            const isRepText = m.sender === 'agent' && m.kind !== 'policy_document';
            return (
              <div key={m.id} className={`flex ${m.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                {m.kind === 'policy_document' ? (
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm flex items-center gap-2 ${
                      m.sender === 'customer' ? `bg-brand-600 text-white ${styles.bubbleMine}` : `bg-slate-100 text-slate-700 ${styles.bubbleTheirs}`
                    }`}
                  >
                    <FileText size={16} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.policy?.filename || 'Policy document'}</div>
                      <div className={`text-[11px] ${m.sender === 'customer' ? 'text-white/70' : 'text-slate-400'}`}>
                        {m.policy?.status === 'failed' ? 'Could not read this PDF' : 'Shared with your representative'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`max-w-[80%] ${m.sender === 'customer' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-sm ${
                        m.sender === 'customer' ? `bg-brand-600 text-white ${styles.bubbleMine}` : `bg-slate-100 text-slate-700 ${styles.bubbleTheirs}`
                      }`}
                    >
                      {m.content}
                    </div>

                    {/* Source chip — the customer sees WHERE the answer came from.
                        Only on informational replies; a quick "sure" has no source. */}
                    {isRepText && m.informational && m.sources?.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <BookOpen size={10} className="shrink-0" />
                        <span className="truncate max-w-[220px]">Based on: {m.sources[0]}</span>
                      </div>
                    )}

                    {/* One-tap clarity feedback — only under the latest INFORMATIONAL
                        reply. A simple acknowledgement or a question back from the
                        rep never needs "did you understand?" confirmation. */}
                    {isRepText && m.informational && m.id === lastInformationalId && (
                      feedbackGiven[m.id] ? (
                        <div className="mt-1.5 text-[10px] text-emerald-600 font-medium">
                          {feedbackGiven[m.id] === 'got_it' ? '✓ Thanks — glad that was clear!' : "✓ Noted — I'll explain that more clearly"}
                        </div>
                      ) : (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <button type="button" onClick={() => sendClarityFeedback(m, 'got_it')} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                            👍 Got it
                          </button>
                          <button type="button" onClick={() => sendClarityFeedback(m, 'unclear')} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                            🤔 Still unclear
                          </button>
                          <button type="button" onClick={() => sendClarityFeedback(m, 'simpler')} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200">
                            Explain simpler
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          });
        })()}
        <div ref={bottomRef} />
      </div>
    </PhoneFrame>
    </>
  );
}
