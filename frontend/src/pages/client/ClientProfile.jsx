import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HeartPulse, Sparkles, User } from 'lucide-react';
import api from '../../api/client';
import PhoneFrame from '../../components/PhoneFrame.jsx';
import PortfolioPieChart from '../../components/PortfolioPieChart.jsx';
import PersonAvatar from '../../components/PersonAvatar.jsx';
import { Badge, Button, Card, LoadingSpinner, productLabel } from '../../components/ui.jsx';

const STORAGE_KEY = 'sci_client_customer_id';

export default function ClientProfile() {
  const navigate = useNavigate();
  const customerId = localStorage.getItem(STORAGE_KEY);
  const [customer, setCustomer] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [summary, setSummary] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    if (!customerId) {
      navigate('/client');
      return;
    }
    api
      .get(`/customers/${customerId}/profile`)
      .then((res) => {
        setCustomer(res.data.customer);
        setPortfolio(res.data.portfolio);
      })
      .catch(() => navigate('/client'))
      .finally(() => setLoading(false));
  }, [customerId, navigate]);

  async function loadRecommendations() {
    if (!customerId) return;
    setLoadingRecs(true);
    try {
      const res = await api.post(`/customers/${customerId}/recommendations`);
      setRecommendations(res.data.recommendations || []);
      setSummary(res.data.summary || '');
      setDisclaimer(res.data.disclaimer || '');
    } finally {
      setLoadingRecs(false);
    }
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

  if (!customer || !portfolio) return null;

  const priorityTone = { high: 'danger', medium: 'warning', low: 'neutral' };

  return (
    <PhoneFrame>
      <div className="px-5 py-4 flex-1 overflow-y-auto">
        <button type="button" onClick={() => navigate('/client')} className="flex items-center gap-1 text-[11px] text-slate-400 mb-4">
          <ArrowLeft size={12} /> Back
        </button>

        <div className="flex items-center gap-3 mb-4">
          <PersonAvatar name={customer.name} emoji={customer.avatarEmoji} className="h-12 w-12 bg-brand-50 text-xl" />
          <div>
            <div className="font-bold text-slate-800">{customer.name}</div>
            <div className="text-xs text-slate-400">Insurance profile</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] mb-1">
              <User size={11} /> Age
            </div>
            <div className="text-lg font-bold text-slate-800">{portfolio.age ?? '—'}</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] mb-1">
              <HeartPulse size={11} /> Health
            </div>
            <div className="text-[11px] font-medium text-slate-700 leading-snug">
              {portfolio.healthCondition || 'Not recorded'}
            </div>
          </Card>
        </div>

        <Card className="p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Portfolio mix</h2>
          <PortfolioPieChart slices={portfolio.pieChart?.slices || []} size={150} />
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">Policies</span>
              <div className="font-semibold text-slate-800">{portfolio.policyCount}</div>
            </div>
            <div>
              <span className="text-slate-400">Annual premium</span>
              <div className="font-semibold text-slate-800">
                {portfolio.totalAnnualPremium > 0 ? `S$${portfolio.totalAnnualPremium.toLocaleString('en-SG')}` : '—'}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Coverage overview</h2>
          <div className="flex flex-wrap gap-1.5">
            {(portfolio.coreProducts || []).map((p) => (
              <Badge key={p.productType} tone={p.held ? 'success' : 'neutral'}>
                {p.held ? '✓' : '○'} {p.label}
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Your policies</h2>
          <div className="space-y-2">
            {customer.policies.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/client/policy/${p.id}`)}
                className="w-full text-left rounded-lg border border-slate-100 px-3 py-2 hover:border-brand-200"
              >
                <div className="text-xs font-semibold text-slate-800">{productLabel(p.productType)}</div>
                <div className="text-[10px] text-slate-400">{p.policyNumber}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles size={14} className="text-brand-600" /> AI suggestions
            </h2>
            <Button size="sm" variant="secondary" disabled={loadingRecs} onClick={loadRecommendations}>
              {loadingRecs ? 'Analysing…' : recommendations.length ? 'Refresh' : 'Get suggestions'}
            </Button>
          </div>
          {summary && <p className="text-xs text-slate-600 mb-3">{summary}</p>}
          {recommendations.length === 0 && !loadingRecs && (
            <p className="text-[11px] text-slate-400">
              Tap &quot;Get suggestions&quot; to see what protection areas are often reviewed at your age — Life, Critical Illness, Shield, and Retirement plans.
            </p>
          )}
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div key={`${rec.productType}-${rec.reason?.slice(0, 20)}`} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-slate-800">{rec.label}</span>
                  <Badge tone={priorityTone[rec.priority] || 'neutral'}>{rec.priority}</Badge>
                  {rec.action === 'enhance' && <Badge tone="accent">Enhance</Badge>}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{rec.reason}</p>
              </div>
            ))}
          </div>
          {disclaimer && recommendations.length > 0 && (
            <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">{disclaimer}</p>
          )}
        </Card>
      </div>
    </PhoneFrame>
  );
}
