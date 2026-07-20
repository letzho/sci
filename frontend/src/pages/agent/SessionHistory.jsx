import { useCallback, useEffect, useState } from 'react';
import { History, ChevronDown, MessageSquare, Video, MonitorSmartphone, Sparkles, FileText } from 'lucide-react';
import api from '../../api/client';
import PersonAvatar from '../../components/PersonAvatar.jsx';
import ClarityRecapModal from '../../components/ClarityRecapModal.jsx';
import { Badge, Card, LoadingSpinner, productLabel } from '../../components/ui.jsx';

const CHANNEL_META = {
  chat: { icon: MessageSquare, label: 'Chat' },
  virtual_call: { icon: Video, label: 'Virtual call' },
  face_to_face: { icon: MonitorSmartphone, label: 'Face-to-face' },
};

function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Past sessions. Ending a conversation only marks it ended — the full
 * transcript, the guidance served and any shared documents stay in the
 * database. This screen makes that retained record reviewable: an audit trail
 * of every conversation, not just the ones still open.
 */
export default function SessionHistory() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({}); // conversationId -> { messages, guidanceEvents }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [recapId, setRecapId] = useState(null);

  useEffect(() => {
    api
      .get('/conversations/history')
      .then((res) => setSessions(res.data.sessions || []))
      .catch(() => setError('Could not load your session history.'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = useCallback(
    async (id) => {
      if (openId === id) {
        setOpenId(null);
        return;
      }
      setOpenId(id);
      if (detail[id]) return;
      setLoadingDetail(true);
      try {
        const res = await api.get(`/conversations/${id}`);
        setDetail((prev) => ({ ...prev, [id]: { messages: res.data.messages || [], guidanceEvents: res.data.guidanceEvents || [] } }));
      } catch {
        setDetail((prev) => ({ ...prev, [id]: { messages: [], guidanceEvents: [], error: true } }));
      } finally {
        setLoadingDetail(false);
      }
    },
    [openId, detail]
  );

  if (loading) {
    return (
      <div className="py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {recapId && <ClarityRecapModal conversationId={recapId} onClose={() => setRecapId(null)} />}

      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History size={20} className="text-brand-600" />
          Past sessions
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Every conversation is retained — including ended ones. Open any session to review the full transcript and the guidance that was served.
        </p>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {!error && sessions.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm text-slate-500">No sessions yet. Start one from the Dashboard and it will appear here.</p>
        </Card>
      )}

      <div className="space-y-2">
        {sessions.map((s) => {
          const meta = CHANNEL_META[s.channel] || CHANNEL_META.chat;
          const Icon = meta.icon;
          const open = openId === s.id;
          const d = detail[s.id];

          return (
            <Card key={s.id} className="p-0 overflow-hidden">
              <button type="button" onClick={() => toggle(s.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <PersonAvatar name={s.customerName} emoji={s.customerEmoji || '🙂'} className="h-9 w-9 bg-brand-50 text-base shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{s.customerName || 'Customer'}</span>
                    <Badge tone={s.status === 'active' ? 'success' : 'neutral'}>{s.status}</Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Icon size={11} /> {meta.label}
                    </span>
                    {s.productContext && <span className="text-[11px] text-slate-400">· {productLabel(s.productContext)}</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {formatWhen(s.endedAt || s.startedAt)} · {s.messageCount} message{s.messageCount === 1 ? '' : 's'} · {s.guidanceCount} guidance
                  </div>
                </div>
                <ChevronDown size={16} className={`text-slate-300 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                  {loadingDetail && !d && <p className="text-[11px] text-slate-400">Loading transcript…</p>}

                  {d?.error && <p className="text-[11px] text-rose-600">Could not load this transcript.</p>}

                  {d && !d.error && (
                    <>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Transcript</div>
                        {d.messages.length === 0 ? (
                          <p className="text-[11px] text-slate-400">No messages were recorded in this session.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-72 overflow-y-auto">
                            {d.messages.map((m) => (
                              <div key={m.id} className={`flex ${m.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-[80%] rounded-xl px-2.5 py-1.5 text-[11px] ${
                                    m.sender === 'agent'
                                      ? 'bg-brand-600 text-white'
                                      : m.sender === 'ai'
                                        ? 'bg-violet-50 text-violet-700 border border-violet-100'
                                        : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {m.sender === 'ai' && <span className="block text-[9px] opacity-70 mb-0.5">AI draft (not sent)</span>}
                                  {m.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {d.guidanceEvents.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 mb-1.5">
                            <Sparkles size={11} className="text-brand-500" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Guidance served ({d.guidanceEvents.length})
                            </span>
                          </div>
                          <ul className="space-y-1 max-h-40 overflow-y-auto">
                            {d.guidanceEvents.slice(0, 12).map((g) => (
                              <li key={g.id} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                                <span className="text-slate-300">•</span>
                                <span>
                                  <span className="font-medium">{g.title || g.guidanceType}</span>
                                  {g.content ? ` — ${g.content.slice(0, 120)}` : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setRecapId(s.id)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-brand-600 hover:underline"
                      >
                        <FileText size={12} /> View Clarity Recap for this session
                      </button>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400">
        Sessions are retained for review and audit. Nothing is deleted when a conversation is ended.
      </p>
    </div>
  );
}
