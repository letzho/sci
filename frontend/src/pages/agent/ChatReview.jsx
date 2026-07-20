import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, FileSearch, FileText, MessageSquareText, PhoneOff, Send, Sparkles, User } from 'lucide-react';
import AppointmentScheduler from '../../components/AppointmentScheduler.jsx';
import api from '../../api/client';
import { getSocket } from '../../socket.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge, Button, Card, LoadingSpinner, productLabel } from '../../components/ui.jsx';
import PersonAvatar from '../../components/PersonAvatar.jsx';
import ComplianceGuardTextarea from '../../components/ComplianceGuardTextarea.jsx';
import ActivityMessageBubble from '../../components/ActivityMessageBubble.jsx';
import GameSurveyPanel from '../../components/gameSurvey/GameSurveyPanel.jsx';
import ProductSignalNudge from '../../components/ProductSignalNudge.jsx';
import UnderstandingNudge from '../../components/UnderstandingNudge.jsx';
import ClarityRecapModal from '../../components/ClarityRecapModal.jsx';
import { mapConversationMessages, parseActivityPayload } from '../../utils/chatMessageFormat.js';
import { isInformationalReply } from '../../utils/messageClassifier.js';
import styles from './ChatReview.module.css';

// Colour per suggested-reply tone so the rep can tell them apart at a glance.
const TONE_STYLES = {
  'Warm & reassuring': 'bg-rose-50 text-rose-600',
  'Clear & factual': 'bg-sky-50 text-sky-600',
  Consultative: 'bg-violet-50 text-violet-600',
  'Suggested reply': 'bg-slate-100 text-slate-500',
};

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
 * Chat channel: the rep never sends raw customer-facing text straight from
 * the AI. Every inbound customer message produces a draft reply that lands
 * here for review/edit before it's actually sent - "AI drafts, human sends".
 * If the customer shares a policy PDF, the Interpreter Agent's analysis of
 * it surfaces here too, in its own panel alongside the chat thread.
 */
export default function ChatReview() {
  const { conversationId } = useParams();
  const { agent } = useAuth();
  const navigate = useNavigate();

  const [conversation, setConversation] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(null);
  const [composeText, setComposeText] = useState('');
  const [selectedTone, setSelectedTone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [policyAnalysis, setPolicyAnalysis] = useState(null);
  const [socket, setSocket] = useState(null);
  const [surveyResult, setSurveyResult] = useState(null);
  const [productSignal, setProductSignal] = useState(null);
  const [confusion, setConfusion] = useState(null);
  const [clarityAck, setClarityAck] = useState(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    async function load() {
      const convoRes = await api.get(`/conversations/${conversationId}`);
      const convo = convoRes.data.conversation;
      setConversation(convo);
      const loadedMessages = mapConversationMessages(
        convoRes.data.messages.filter((m) => m.kind !== 'draft' && m.kind !== 'transcript')
      ).map(parsePolicyMessage);
      setMessages(loadedMessages);
      const lastSurvey = [...loadedMessages].reverse().find((m) => {
        const p = parseActivityPayload(m);
        return m.kind === 'game_survey' && p?.action === 'completed';
      });
      if (lastSurvey) {
        const p = parseActivityPayload(lastSurvey);
        setSurveyResult({ gameChoice: p.gameChoice, cardsViewed: p.cardsViewed || 0 });
      }
      const lastPolicy = loadedMessages
        .slice()
        .reverse()
        .find((m) => m.kind === 'policy_document' && m.policy?.status === 'analyzed' && m.policy?.analysis);
      if (lastPolicy) setPolicyAnalysis({ filename: lastPolicy.policy.filename, ...lastPolicy.policy.analysis });
      const custRes = await api.get(`/customers/${convo.customerId}`);
      setCustomer(custRes.data.customer);
      setLoading(false);
    }
    load();
  }, [conversationId]);

  useEffect(() => {
    const sock = getSocket();
    socketRef.current = sock;
    setSocket(sock);
    sock.emit('join-room', { conversationId, role: 'agent', displayName: agent?.name });

    const handleChatMessage = ({ sender, text, at }) => {
      setMessages((prev) => [...prev, { id: `${at}-${Math.random()}`, sender, kind: 'text', content: text, createdAt: at }]);
    };
    const handleChatDraft = ({ draft: incomingDraft }) => {
      setDraft(incomingDraft);
      const first = incomingDraft.draftOptions?.[0];
      setComposeText(first?.text || incomingDraft.draftReply || '');
      setSelectedTone(first?.tone || null);
    };
    const handlePolicyShared = ({ message }) => {
      const parsed = parsePolicyMessage(message);
      setMessages((prev) => [...prev, parsed]);
      if (parsed.policy?.status === 'analyzed' && parsed.policy?.analysis) {
        setPolicyAnalysis({ filename: parsed.policy.filename, ...parsed.policy.analysis });
      }
    };

    const handleGameSurveyResult = ({ result }) => {
      setSurveyResult(result);
      const activityMsg = {
        id: `survey-live-${Date.now()}`,
        sender: 'customer',
        kind: 'game_survey',
        content: JSON.stringify({
          action: 'completed',
          gameChoice: result.gameChoice,
          cardsViewed: result.cardsViewed,
        }),
        createdAt: new Date().toISOString(),
      };
      const enriched = mapConversationMessages([activityMsg])[0];
      setMessages((prev) => {
        if (prev.some((m) => m.kind === 'game_survey' && m.activity?.title === 'Game completed')) return prev;
        return [...prev, enriched];
      });
    };

    const handleProductSignal = ({ signal }) => setProductSignal(signal);
    const handleUnderstanding = ({ confusion: c }) => setConfusion(c);
    const handleClarityFeedback = ({ feedback, text }) => {
      if (feedback === 'got_it') {
        setClarityAck({ text });
        setTimeout(() => setClarityAck(null), 4000);
      } else {
        // 'unclear' or 'simpler' — surface as a confusion nudge with the customer's actual ask.
        setConfusion({ text, strength: 'high', feedback });
      }
    };

    sock.on('chat-message', handleChatMessage);
    sock.on('chat-draft', handleChatDraft);
    sock.on('policy-shared', handlePolicyShared);
    sock.on('game-survey-result', handleGameSurveyResult);
    sock.on('product-signal', handleProductSignal);
    sock.on('understanding-signal', handleUnderstanding);
    sock.on('clarity-feedback', handleClarityFeedback);

    return () => {
      sock.emit('leave-room', { conversationId });
      sock.off('chat-message', handleChatMessage);
      sock.off('chat-draft', handleChatDraft);
      sock.off('policy-shared', handlePolicyShared);
      sock.off('game-survey-result', handleGameSurveyResult);
      sock.off('product-signal', handleProductSignal);
      sock.off('understanding-signal', handleUnderstanding);
      sock.off('clarity-feedback', handleClarityFeedback);
    };
  }, [conversationId, agent]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendApproved() {
    const text = composeText.trim();
    if (!text) return;
    // Only substantive explanations get a source chip + "did you understand?"
    // check on the customer's side — a quick "sure" or a question back isn't
    // an explanation, and asking for acknowledgement on every message is noisy
    // and undermines the point of the check.
    const informational = isInformationalReply(text);
    socketRef.current.emit('agent-send-approved', {
      conversationId,
      text,
      informational,
      sources: informational ? draft?.basedOn?.slice(0, 3) || [] : [],
    });
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, sender: 'agent', kind: 'approved', content: text, createdAt: new Date().toISOString() },
    ]);
    setComposeText('');
    setDraft(null);
    setSelectedTone(null);
  }

  async function endSession() {
    socketRef.current?.emit('end-call', { conversationId });
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
    <div className="grid lg:grid-cols-[1fr_340px] gap-5">
      <Card className="p-0 flex flex-col h-[82vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <PersonAvatar name={customer?.name} emoji={customer?.avatarEmoji || <User size={16} />} className="h-9 w-9 bg-brand-50 text-base" />
            <div>
              <div className="font-semibold text-slate-800 text-sm">{customer?.name}</div>
              <div className="text-xs text-slate-400">{productLabel(conversation?.productContext)}</div>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={endSession}>
            <PhoneOff size={14} /> End
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
              {m.kind === 'policy_document' ? (
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm flex items-center gap-2 bg-slate-100 text-slate-700 ${styles.bubbleCustomer}`}>
                  <FileText size={16} className="text-brand-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.policy?.filename || 'Policy document'}</div>
                    <div className="text-[11px] text-slate-400">
                      {m.policy?.status === 'failed' ? 'Could not read this PDF' : 'Shared by the customer · analyzed below'}
                    </div>
                  </div>
                </div>
              ) : m.activity ? (
                <ActivityMessageBubble activity={m.activity} sender={m.sender} />
              ) : (
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.sender === 'agent' ? `bg-brand-600 text-white ${styles.bubbleAgent}` : `bg-slate-100 text-slate-700 ${styles.bubbleCustomer}`
                  }`}
                >
                  {m.content}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-100 p-3">
          {draft?.complianceFlags?.length > 0 && (
            <div className={`mb-2 flex items-start gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-2 ${styles.complianceBanner}`}>
              <AlertTriangle size={13} className="text-rose-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-rose-700">
                The customer's message touched a flagged phrase - double check your reply avoids: {draft.complianceFlags.map((f) => `"${f.phrase}"`).join(', ')}
              </p>
            </div>
          )}
          {draft && (
            <div className={`mb-2 flex items-center justify-between gap-1.5 text-[11px] text-accent-600 ${styles.draftBadge}`}>
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} />
                {selectedTone ? `Editing the "${selectedTone}" option` : 'AI draft ready'} — pick an option on the right, then edit and send.
              </span>
              {composeText && (
                <button type="button" onClick={() => setComposeText('')} className="text-slate-400 hover:text-slate-600 shrink-0">
                  Clear
                </button>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            <ComplianceGuardTextarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendApproved();
                }
              }}
              productType={conversation?.productContext}
              placeholder="Type your reply, or pick one of the suggested replies on the right and edit it here before sending…"
              rows={5}
              className={styles.composer}
            />
            <Button onClick={sendApproved} disabled={!composeText.trim()}>
              <Send size={15} />
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-4 self-start">
        {recapOpen && <ClarityRecapModal conversationId={conversationId} onClose={() => setRecapOpen(false)} />}

        {/* Guided reply options — the rep picks the most sensible tone, then
            edits it in the composer on the left. All grounded in approved
            messaging; every option is trust-building, never a hard sell. */}
        {draft?.draftOptions?.length > 0 && (
          <Card className="p-4 border-brand-100">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquareText size={15} className="text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-700">Suggested replies</h2>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Pick the tone that fits — it loads into the editor to review and send.</p>
            <div className="space-y-2">
              {draft.draftOptions.map((opt, i) => {
                const active = selectedTone === opt.tone && composeText === opt.text;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setComposeText(opt.text);
                      setSelectedTone(opt.tone);
                    }}
                    className={`w-full text-left rounded-xl border p-2.5 transition-colors ${
                      active ? 'border-brand-400 bg-brand-50/70 ring-1 ring-brand-200' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${TONE_STYLES[opt.tone] || 'bg-slate-100 text-slate-500'}`}>
                        {opt.tone}
                      </span>
                      {active && <span className="text-[9px] font-semibold text-brand-600">✓ In editor</span>}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{opt.text}</p>
                  </button>
                );
              })}
            </div>
            {draft.basedOn?.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
                Grounded in: {draft.basedOn.slice(0, 3).join(', ')}{draft.basedOn.length > 3 ? '…' : ''}
              </p>
            )}
          </Card>
        )}

        <Button variant="secondary" size="sm" className="w-full" onClick={() => setRecapOpen(true)}>
          <FileText size={14} /> Clarity Recap
        </Button>
        {clarityAck && (
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 animate-fade-in">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <p className="text-[11px] text-emerald-800">Client tapped <span className="font-semibold">"Got it"</span> — they understood your last message.</p>
          </div>
        )}
        {confusion && <UnderstandingNudge confusion={confusion} onDismiss={() => setConfusion(null)} />}
        {productSignal && (
          <ProductSignalNudge signal={productSignal} onDismiss={() => setProductSignal(null)} />
        )}
        {policyAnalysis && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileSearch size={16} className="text-accent-500" />
              <h2 className="text-sm font-semibold text-slate-700">Interpreter Agent</h2>
            </div>
            <p className="text-[11px] text-slate-400 mb-3 truncate" title={policyAnalysis.filename}>
              Analysis of "{policyAnalysis.filename}"
              {policyAnalysis.insuredPlanTier && (
                <span className="ml-1 text-brand-600 font-medium">
                  · {policyAnalysis.insuredPlanTier.charAt(0).toUpperCase() + policyAnalysis.insuredPlanTier.slice(1)} plan
                </span>
              )}
            </p>
            {policyAnalysis.extractionQuality?.warning && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mb-3">
                {policyAnalysis.extractionQuality.warning}
              </p>
            )}
            {policyAnalysis.documentChunkCount != null && (
              <p className="text-[11px] text-brand-600 mb-2">
                {policyAnalysis.documentChunkCount} section{policyAnalysis.documentChunkCount === 1 ? '' : 's'} indexed from the full document
              </p>
            )}
            <p className="text-xs text-slate-600 mb-3">{policyAnalysis.summary}</p>

            {policyAnalysis.documentSections?.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Document sections</div>
                <ul className="space-y-1.5">
                  {policyAnalysis.documentSections.map((s, i) => (
                    <li key={i} className="text-xs text-slate-600">
                      <span className="font-medium text-slate-700">{s.topic}</span>
                      <p className="text-slate-500 mt-0.5">{s.preview}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {policyAnalysis.coverageHighlights?.length > 0 && !policyAnalysis.documentSections?.length && (
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Coverage highlights</div>
                <ul className="space-y-1">
                  {policyAnalysis.coverageHighlights.map((h, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" /> {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {policyAnalysis.exclusionsOrGaps?.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Exclusions / gaps to check</div>
                <ul className="space-y-1">
                  {policyAnalysis.exclusionsOrGaps.map((h, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" /> {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {policyAnalysis.suggestedQuestions?.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Questions you could ask</div>
                <ul className="space-y-1">
                  {policyAnalysis.suggestedQuestions.map((q, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <MessageSquareText size={12} className="text-brand-500 mt-0.5 shrink-0" /> {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
              AI-generated from the document text only - not advice. Verify before discussing with the customer.
            </p>
          </Card>
        )}

        <Card className={`p-4 ${styles.sideNote}`}>
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays size={15} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-700">Schedule follow-up</h2>
          </div>
          {agent?.id && customer?.id ? (
            <AppointmentScheduler
              agentId={agent.id}
              customerId={customer.id}
              customerName={customer.name}
              compact
            />
          ) : (
            <p className="text-[11px] text-slate-400">Loading…</p>
          )}
        </Card>

        <Card className={`p-4 ${styles.sideNote}`}>
          <GameSurveyPanel
            conversationId={conversationId}
            productType={conversation?.productContext}
            customerName={customer?.name}
            socket={socket}
            initialResult={surveyResult}
            compact
          />
        </Card>
      </div>
    </div>
  );
}
