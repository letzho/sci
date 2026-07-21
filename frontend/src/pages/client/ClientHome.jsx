import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MessageSquare, PieChart, RefreshCcw, ShieldCheck, Video, Check, User } from 'lucide-react';
import api from '../../api/client';
import PhoneFrame from '../../components/PhoneFrame.jsx';
import Logo from '../../components/Logo.jsx';
import PersonAvatar from '../../components/PersonAvatar.jsx';
import { Badge, Button, Card, LoadingSpinner, productLabel } from '../../components/ui.jsx';
import { fetchClientAgent, getChosenAgentId, setChosenAgentId } from '../../utils/clientAgent.js';
import styles from './ClientHome.module.css';

const STORAGE_KEY = 'sci_client_customer_id';

/**
 * Client Portal home: pick representative + profile (no customer login).
 * Demo clients are shared; custom clients appear for the selected rep only.
 */
export default function ClientHome() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [agent, setAgent] = useState(null);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [allAgents, setAllAgents] = useState([]);
  const [repPickerOpen, setRepPickerOpen] = useState(false);

  const loadCustomersForAgent = useCallback(async (agentId) => {
    const res = await api.get('/customers', { params: agentId ? { agentId } : {} });
    setCustomers(res.data.customers);
    return res.data.customers;
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const chosenAgentId = getChosenAgentId();
      const [agentRes, agentsRes] = await Promise.all([fetchClientAgent(), api.get('/agents').catch(() => ({ data: { agents: [] } }))]);
      const rep = agentRes.data.agent;
      const agents = agentsRes.data.agents || [];
      setAgent(rep);
      setAllAgents(agents);

      const effectiveAgentId = chosenAgentId || rep?.id;
      if (effectiveAgentId && !chosenAgentId) setChosenAgentId(effectiveAgentId);

      const list = await loadCustomersForAgent(effectiveAgentId);
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId && !list.some((c) => c.id === storedId)) {
        localStorage.removeItem(STORAGE_KEY);
        setSelectedId('');
      }
    } catch (err) {
      console.error('Client home load failed:', err);
      setLoadError('Could not reach the server. Check that the backend is running and VITE_API_URL points to it.');
    } finally {
      setLoading(false);
    }
  }, [loadCustomersForAgent]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  async function chooseRep(a) {
    setChosenAgentId(a.id);
    setAgent(a);
    setRepPickerOpen(false);
    try {
      const list = await loadCustomersForAgent(a.id);
      if (selectedId && !list.some((c) => c.id === selectedId)) {
        localStorage.removeItem(STORAGE_KEY);
        setSelectedId('');
      }
    } catch (err) {
      console.error('Could not load clients for rep:', err);
    }
  }

  function chooseProfile(id) {
    localStorage.setItem(STORAGE_KEY, id);
    setSelectedId(id);
    window.dispatchEvent(new Event('sci-customer-changed'));
  }

  function switchProfile() {
    localStorage.removeItem(STORAGE_KEY);
    setSelectedId('');
  }

  async function startChannel(channel) {
    if (!agent || !customer) return;
    setStarting(true);
    try {
      const res = await api.post('/conversations/start', {
        agentId: agent.id,
        customerId: customer.id,
        channel,
        productType: customer.policies?.[0]?.productType || null,
      });
      navigate(channel === 'virtual_call' ? `/client/call/${res.data.conversation.id}` : `/client/chat/${res.data.conversation.id}`);
    } finally {
      setStarting(false);
    }
  }

  const customer = customers.find((c) => c.id === selectedId);

  function RepPicker({ compact = false }) {
    return (
      <div className={`rounded-xl border border-slate-100 bg-slate-50/80 ${compact ? 'p-2.5 mb-4' : 'p-3 mb-5'}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck size={14} className="text-brand-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Your representative</div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 truncate">
                <PersonAvatar name={agent?.name} emoji={agent?.avatarEmoji} className="h-5 w-5 bg-brand-50 text-[10px] shrink-0" />
                {agent?.name || 'Select rep'}
              </div>
            </div>
          </div>
          {allAgents.length > 0 && (
            <button
              type="button"
              onClick={() => setRepPickerOpen((v) => !v)}
              className="text-[11px] font-medium text-brand-700 shrink-0"
            >
              {repPickerOpen ? 'Close' : 'Change'}
            </button>
          )}
        </div>
        {repPickerOpen && (
          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
            <p className="text-[10px] text-slate-400 px-1">Pick the rep who added you — custom clients only show under their account.</p>
            {allAgents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => chooseRep(a)}
                className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-white"
              >
                <span className="flex items-center gap-2 text-xs text-slate-700">
                  <PersonAvatar name={a.name} emoji={a.avatarEmoji} className="h-6 w-6 bg-brand-50 text-xs" />
                  {a.name}
                </span>
                {a.id === agent?.id && <Check size={13} className="text-brand-600" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
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

  if (loadError) {
    return (
      <PhoneFrame>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-rose-600 mb-2">{loadError}</p>
          <Button size="sm" className="mt-4" onClick={() => bootstrap()}>
            Retry
          </Button>
        </div>
      </PhoneFrame>
    );
  }

  if (!customer) {
    const customClients = customers.filter((c) => !c.isDemo);
    return (
      <PhoneFrame>
        <div className="px-5 py-4">
          <div className="flex justify-center mb-5">
            <Logo size={32} />
          </div>
          <h1 className="text-base font-bold text-slate-800 text-center">Who's checking in?</h1>
          <p className="text-xs text-slate-400 text-center mt-1 mb-4">
            Choose your representative, then select your profile. Demo clients are shared; your rep's own clients appear below.
          </p>

          <RepPicker />

          {customClients.length === 0 && customers.length > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              No custom clients for <strong>{agent?.name}</strong> yet. On the rep dashboard use <strong>Add client</strong>, or tap <strong>Change</strong> above if your rep is someone else.
            </p>
          )}

          <div className="space-y-2">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => chooseProfile(c.id)}
                className={`w-full flex items-center gap-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/50 px-3 py-3 text-left transition-colors ${styles.profileRow}`}
              >
                <PersonAvatar
                  name={c.name}
                  emoji={c.avatarEmoji || '🙂'}
                  photoUrl={c.isDemo ? null : c.photoUrl}
                  photoScopeAgentId={c.isDemo ? null : agent?.id}
                  className={`h-10 w-10 bg-brand-50 text-lg shrink-0 ${styles.avatar}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{c.name}</span>
                    {c.isDemo ? (
                      <Badge tone="neutral">Demo</Badge>
                    ) : (
                      <Badge tone="brand">Your rep's client</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {c.policies.length
                      ? `${c.policies.length} polic${c.policies.length === 1 ? 'y' : 'ies'}`
                      : 'No policies yet — calls and chat still work'}
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 shrink-0" />
              </button>
            ))}
          </div>

          {customers.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              <User size={28} className="mx-auto mb-2 opacity-40" />
              No profiles available. Ask your rep to add you on their dashboard.
            </div>
          )}
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className="px-5 py-4 flex-1">
        <div className="flex items-center justify-between mb-5">
          <Logo size={28} />
          <button onClick={switchProfile} className="text-[11px] text-slate-400 flex items-center gap-1">
            <RefreshCcw size={11} /> Switch
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <PersonAvatar
            name={customer.name}
            emoji={customer.avatarEmoji}
            photoUrl={customer.isDemo ? null : customer.photoUrl}
            photoScopeAgentId={customer.isDemo ? null : agent?.id}
            className="h-12 w-12 bg-brand-50 text-xl"
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800">{customer.name}</div>
            <div className="text-xs text-slate-400">Welcome back</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/client/profile')}
            className="flex items-center gap-1 rounded-xl border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[11px] font-medium text-brand-700"
          >
            <PieChart size={13} /> Profile
          </button>
        </div>

        <Card className={`p-4 mb-5 brand-gradient text-white border-none ${styles.repCard}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} />
              <span className="text-xs font-semibold">Your representative</span>
            </div>
            {allAgents.length > 1 && (
              <button type="button" onClick={() => setRepPickerOpen((v) => !v)} className="text-[10px] text-white/80 underline">
                {repPickerOpen ? 'Close' : 'Change'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <PersonAvatar name={agent?.name} emoji={agent?.avatarEmoji} className="h-6 w-6 bg-white/20 text-sm" />
            {agent?.name}
          </div>

          {repPickerOpen && (
            <div className="mt-3 space-y-1 bg-white/10 rounded-xl p-2">
              <p className="text-[10px] text-white/70 px-1 pb-1">Pair with the rep you signed up as:</p>
              {allAgents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => chooseRep(a)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/15"
                >
                  <span className="flex items-center gap-2 text-xs">
                    <PersonAvatar name={a.name} emoji={a.avatarEmoji} className="h-5 w-5 bg-white/20 text-[11px]" />
                    {a.name}
                  </span>
                  {a.id === agent?.id && <Check size={13} />}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" className={`bg-white/15 hover:bg-white/25 ${styles.actionBtn}`} disabled={starting} onClick={() => startChannel('virtual_call')}>
              <Video size={14} /> Video call
            </Button>
            <Button size="sm" className={`bg-white/15 hover:bg-white/25 ${styles.actionBtn}`} disabled={starting} onClick={() => startChannel('chat')}>
              <MessageSquare size={14} /> Chat
            </Button>
          </div>
        </Card>

        <h2 className="text-sm font-semibold text-slate-700 mb-2">Your policies</h2>
        {customer.policies.length === 0 ? (
          <p className="text-xs text-slate-400 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center">
            No policies on file yet. You can still video call or chat with your rep.
          </p>
        ) : (
          <div className="space-y-2">
            {customer.policies.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/client/policy/${p.id}`)}
                className={`w-full flex items-center justify-between rounded-xl border border-slate-100 hover:border-brand-200 px-3 py-3 text-left ${styles.policyRow}`}
              >
                <div>
                  <div className="text-sm font-semibold text-slate-800">{productLabel(p.productType)}</div>
                  <div className="text-[11px] text-slate-400">{p.policyNumber}</div>
                </div>
                <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>{p.status}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
