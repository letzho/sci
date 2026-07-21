import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, MonitorSmartphone, Video, ChevronRight, RefreshCw, Trophy, Coffee, Plane, ClipboardList, FileSearch, RotateCcw, UserPlus, Pencil } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import { mergeGamification, useGamificationBonus } from '../../context/GamificationBonusContext.jsx';
import FlightSimulatorModal from '../../components/FlightSimulatorModal.jsx';
import ClientBriefModal from '../../components/ClientBriefModal.jsx';
import ClientFormModal from '../../components/ClientFormModal.jsx';
import FirstRunTour from '../../components/FirstRunTour.jsx';
import { Badge, Button, Card, LoadingSpinner, productLabel } from '../../components/ui.jsx';
import BadgeGallery from '../../components/BadgeGallery.jsx';
import PersonAvatar from '../../components/PersonAvatar.jsx';
import AppointmentCalendar from '../../components/AppointmentCalendar.jsx';
import styles from './Dashboard.module.css';

const CHANNEL_ROUTE = { face_to_face: 'face-to-face', virtual_call: 'virtual-call', chat: 'chat' };

const CHANNELS = [
  { key: 'face_to_face', label: 'Face-to-face', icon: MonitorSmartphone, hint: 'In-person laptop prompts' },
  { key: 'virtual_call', label: 'Virtual call', icon: Video, hint: 'Live video + on-screen guidance' },
  { key: 'chat', label: 'Chat', icon: MessageSquare, hint: 'AI-drafted replies for review' },
];

export default function Dashboard() {
  const { agent, logout } = useAuth();
  const { bonusXp } = useGamificationBonus();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [activeConvos, setActiveConvos] = useState([]);
  const [gamification, setGamification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startingKey, setStartingKey] = useState(null);
  const [meetingTemplates, setMeetingTemplates] = useState([]);
  const [simulatorCustomer, setSimulatorCustomer] = useState(null);
  const [briefCustomer, setBriefCustomer] = useState(null);
  const [formCustomer, setFormCustomer] = useState(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    api.get('/tools/meeting-templates').then((res) => setMeetingTemplates(res.data.templates)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [customersRes, convosRes, metricsRes] = await Promise.all([
      api.get('/customers'),
      agent ? api.get('/conversations', { params: { agentId: agent.id, status: 'active' } }) : Promise.resolve({ data: { conversations: [] } }),
      api.get('/metrics').catch(() => ({ data: {} })),
    ]);
    setCustomers(customersRes.data.customers);
    setActiveConvos(convosRes.data.conversations);
    setGamification(mergeGamification(metricsRes.data.gamification, bonusXp));
    setLoading(false);
  }, [agent, bonusXp]);

  useEffect(() => {
    load();
  }, [load]);

  const [resetting, setResetting] = useState(false);
  async function resetDemoData() {
    if (!window.confirm('Reset your demo sessions? This clears your conversations and chat history (customers and policies stay). Other testers are not affected.')) return;
    setResetting(true);
    try {
      await api.post('/conversations/reset');
      await load();
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setResetting(false);
    }
  }

  async function startSession(customer, channelKey) {
    if (!agent) return;
    setStartingKey(`${customer.id}-${channelKey}`);
    setSessionError('');
    try {
      const productType = customer.policies?.[0]?.productType || null;
      const res = await api.post('/conversations/start', {
        agentId: agent.id,
        customerId: customer.id,
        channel: channelKey,
        productType,
      });
      navigate(`/agent/session/${res.data.conversation.id}/${CHANNEL_ROUTE[channelKey]}`);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/agent/login', { state: { message: 'Your session expired (this can happen after re-seeding the database). Please sign in again.' } });
      } else if (err.response?.status === 403) {
        setSessionError(
          err.response?.data?.error ||
            'Cannot start a session with this client. Try signing out and back in, or delete and re-add the client under your account.'
        );
      } else {
        setSessionError('Could not start session. Check your connection and try again.');
      }
    } finally {
      setStartingKey(null);
    }
  }

  function resumeConvo(convo) {
    navigate(`/agent/session/${convo.id}/${CHANNEL_ROUTE[convo.channel]}`);
  }

  if (loading) {
    return (
      <div className="py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <PersonAvatar name={agent?.name} emoji={agent?.avatarEmoji} className="h-8 w-8 bg-brand-50 text-base" />
            Welcome back, {agent?.name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Pick a customer and channel to start a guided session.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetDemoData}
            disabled={resetting}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 disabled:opacity-50"
            title="Reset your demo sessions"
          >
            <RotateCcw size={13} /> {resetting ? 'Resetting…' : 'Reset demo'}
          </button>
          <button onClick={load} className={`text-slate-400 hover:text-slate-600 ${styles.refreshBtn}`} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <FirstRunTour />

      {gamification && (
        <Card className={`p-5 overflow-hidden relative ${styles.progressCard}`}>
          <div className={styles.progressGlow} />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-amber-700">
                <Trophy size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Your progress</span>
              </div>
              <div className="text-lg font-bold text-slate-800 mt-1">
                Level {gamification.level} &middot; {gamification.levelTitle}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {gamification.xpForNextLevel
                  ? `${gamification.xpIntoLevel}/${gamification.xpForNextLevel} XP to ${gamification.nextTitle}`
                  : 'Max level reached'}
              </div>
              <div className={`h-2 w-48 rounded-full bg-amber-100 mt-2 overflow-hidden ${styles.progressTrack}`}>
                <div className={styles.progressFill} style={{ width: `${gamification.progressPct}%` }} />
              </div>
            </div>
            <BadgeGallery badges={gamification.badges} compact />
          </div>
        </Card>
      )}

      {activeConvos.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Resume active sessions</h2>
          <div className="space-y-2">
            {activeConvos.map((c) => (
              <button
                key={c.id}
                onClick={() => resumeConvo(c)}
                className={`w-full flex items-center justify-between rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/50 px-3 py-2.5 text-left transition-colors ${styles.resumeRow}`}
              >
                <div className="flex items-center gap-2">
                  <Badge tone="brand">{c.channel.replace('_', ' ')}</Badge>
                  <span className="text-xs text-slate-500">{productLabel(c.productContext)}</span>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 border-brand-100 bg-brand-50/30">
        <div className="grid lg:grid-cols-[1fr_280px] gap-4 items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Coffee size={16} className="text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-700">First meet-up & prospect outreach</h2>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Start a virtual call with a warm invite, icebreakers, and a 2-question quiz — ideal for coffee chats or first-time prospects.
            </p>
            <div className="grid sm:grid-cols-2 gap-2 mb-3">
              {meetingTemplates.slice(0, 4).map((t) => (
                <div key={t.id} className="rounded-xl bg-white border border-slate-100 px-3 py-2 text-[11px]">
                  <span className="mr-1">{t.icon}</span>
                  <span className="font-medium text-slate-700">{t.label}</span>
                  <p className="text-slate-400 mt-0.5 line-clamp-1">{t.subject}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {customers.slice(0, 2).map((customer) => (
                <div key={customer.id} className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="primary" onClick={() => setSimulatorCustomer(customer)}>
                    <Plane size={14} /> Practice with {customer.name.split(' ')[0]}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={startingKey === `${customer.id}-virtual_call`}
                    onClick={() => startSession(customer, 'virtual_call')}
                  >
                    <Video size={14} /> Go live
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              <strong>Practice</strong> opens the Flight Simulator (3-turn roleplay + XP). <strong>Go live</strong> starts the real virtual call.
            </p>
          </div>

          {agent && (
            <AppointmentCalendar agentId={agent.id} customers={customers} onRefresh={load} />
          )}
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <h2 className="text-sm font-semibold text-slate-700">Customers</h2>
          <Button size="sm" variant="primary" onClick={() => setShowAddClient(true)}>
            <UserPlus size={14} /> Add client
          </Button>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          Demo clients (Alex, Mary, Daniel, Priya) are shared. Use <strong className="font-medium text-slate-500">Add client</strong> for your own current clients or prospects.
        </p>
        {sessionError && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">{sessionError}</p>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {customers.map((customer) => (
            <Card key={customer.id} className={`p-4 ${styles.customerCard}`}>
              <div className="flex items-start gap-3">
                <PersonAvatar
                  name={customer.name}
                  emoji={customer.avatarEmoji || '🙂'}
                  photoUrl={customer.photoUrl}
                  className={`h-10 w-10 bg-brand-50 text-lg shrink-0 ${styles.avatar}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 text-sm truncate">{customer.name}</div>
                      <div className="text-xs text-slate-400 truncate">{customer.email || 'No email on file'}</div>
                    </div>
                    {!customer.isDemo && (
                      <button
                        type="button"
                        onClick={() => setFormCustomer(customer)}
                        className="text-slate-400 hover:text-brand-600 p-1 shrink-0"
                        title="Edit client"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {customer.isDemo && <Badge tone="brand">Demo</Badge>}
                    <Badge tone={customer.clientStatus === 'prospect' ? 'warning' : 'success'}>
                      {customer.clientStatus === 'prospect' ? 'Prospect' : 'Current'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {customer.policies.map((p) => (
                  <Badge key={p.id} tone="neutral">
                    {productLabel(p.productType)}
                  </Badge>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {CHANNELS.map((ch) => (
                  <Button
                    key={ch.key}
                    variant="outline"
                    size="sm"
                    className={`flex-col h-auto py-2 gap-1 ${styles.channelBtn}`}
                    disabled={startingKey === `${customer.id}-${ch.key}`}
                    onClick={() => startSession(customer, ch.key)}
                    title={ch.hint}
                  >
                    <ch.icon size={15} />
                    <span className="text-[11px]">{ch.label}</span>
                  </Button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="primary" size="sm" onClick={() => setBriefCustomer(customer)} title="Pre-call background study">
                  <FileSearch size={14} /> Brief
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/agent/customers/${customer.id}/plan`)}
                >
                  <ClipboardList size={14} /> Plan
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {(showAddClient || formCustomer) && (
        <ClientFormModal
          customer={formCustomer}
          onClose={() => {
            setShowAddClient(false);
            setFormCustomer(null);
          }}
          onSaved={() => load()}
        />
      )}

      {briefCustomer && (
        <ClientBriefModal
          customerId={briefCustomer.id}
          customerName={briefCustomer.name}
          clientStatus={briefCustomer.clientStatus}
          onClose={() => setBriefCustomer(null)}
        />
      )}

      {simulatorCustomer && (
        <FlightSimulatorModal
          customer={simulatorCustomer}
          productType={simulatorCustomer.policies?.[0]?.productType}
          onClose={() => setSimulatorCustomer(null)}
          onStartLiveCall={(c) => {
            setSimulatorCustomer(null);
            startSession(c, 'virtual_call');
          }}
        />
      )}
    </div>
  );
}
