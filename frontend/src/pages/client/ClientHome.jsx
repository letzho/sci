import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MessageSquare, RefreshCcw, ShieldCheck, Video } from 'lucide-react';
import api from '../../api/client';
import PhoneFrame from '../../components/PhoneFrame.jsx';
import Logo from '../../components/Logo.jsx';
import PersonAvatar from '../../components/PersonAvatar.jsx';
import { Badge, Button, Card, LoadingSpinner, productLabel } from '../../components/ui.jsx';
import styles from './ClientHome.module.css';

const STORAGE_KEY = 'sci_client_customer_id';

/**
 * Demo simplification: instead of a full customer login, the customer picks
 * which seeded profile they are. Everything downstream (calls, chat, policy
 * detail) resolves identity from the conversation/policy id in the URL, so
 * this choice only matters for this screen and for kicking off new sessions.
 */
export default function ClientHome() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [agent, setAgent] = useState(null);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [customersRes, agentRes] = await Promise.all([api.get('/customers'), api.get('/agents/primary')]);
        setCustomers(customersRes.data.customers);
        setAgent(agentRes.data.agent);
      } catch (err) {
        console.error('Client home load failed:', err);
        setLoadError('Could not reach the server. Make sure the backend is running on your PC and both devices are on the same Wi-Fi.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function chooseProfile(id) {
    localStorage.setItem(STORAGE_KEY, id);
    setSelectedId(id);
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
          <p className="text-xs text-slate-400">On your phone, open the Network URL shown in the Vite terminal (e.g. http://172.x.x.x:5173/client).</p>
          <Button size="sm" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </PhoneFrame>
    );
  }

  if (!customer) {
    return (
      <PhoneFrame>
        <div className="px-5 py-4">
          <div className="flex justify-center mb-5">
            <Logo size={32} />
          </div>
          <h1 className="text-base font-bold text-slate-800 text-center">Who's checking in?</h1>
          <p className="text-xs text-slate-400 text-center mt-1 mb-5">Demo profile picker - select a customer to continue.</p>
          <div className="space-y-2">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => chooseProfile(c.id)}
                className={`w-full flex items-center gap-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/50 px-3 py-3 text-left transition-colors ${styles.profileRow}`}
              >
                <PersonAvatar name={c.name} emoji={c.avatarEmoji || '🙂'} className={`h-10 w-10 bg-brand-50 text-lg ${styles.avatar}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 text-sm">{c.name}</div>
                  <div className="text-[11px] text-slate-400">{c.policies.length} polic{c.policies.length === 1 ? 'y' : 'ies'}</div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            ))}
          </div>
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
          <PersonAvatar name={customer.name} emoji={customer.avatarEmoji} className="h-12 w-12 bg-brand-50 text-xl" />
          <div>
            <div className="font-bold text-slate-800">{customer.name}</div>
            <div className="text-xs text-slate-400">Welcome back</div>
          </div>
        </div>

        <Card className={`p-4 mb-5 brand-gradient text-white border-none ${styles.repCard}`}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={15} />
            <span className="text-xs font-semibold">Your representative</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <PersonAvatar name={agent?.name} emoji={agent?.avatarEmoji} className="h-6 w-6 bg-white/20 text-sm" />
            {agent?.name}
          </div>
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
      </div>
    </PhoneFrame>
  );
}
