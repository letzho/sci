import { useCallback, useEffect, useState } from 'react';
import { FileDown, Save, Sparkles } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import PortfolioPieChart from './PortfolioPieChart.jsx';
import FinancialCalculator from './FinancialCalculator.jsx';
import { Badge, Button, Card, LoadingSpinner, productLabel } from './ui.jsx';
import { exportPlanToPdf } from '../utils/exportPlanPdf.js';

const GOAL_OPTIONS = [
  'Protect family income',
  'Hospitalisation cover',
  'Critical illness protection',
  'Retirement income',
  'Wealth accumulation',
  'Review existing policies',
];

const EMPTY_PLAN = {
  goals: [],
  notes: '',
  proposedProducts: [],
  coverageGap: null,
  retirementTarget: null,
  actionItems: [],
};

export default function CustomerPlanPanel({ customerId, embedded = false }) {
  const { agent } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await api.get(`/customers/${customerId}/plan`);
      setCustomer(res.data.customer);
      setPortfolio(res.data.portfolio);
      setPlan({ ...EMPTY_PLAN, ...res.data.plan });
    } catch (err) {
      console.error('Failed to load plan:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function savePlan() {
    setSaving(true);
    setSavedMsg('');
    try {
      const res = await api.put(`/customers/${customerId}/plan`, { plan });
      setPlan({ ...EMPTY_PLAN, ...res.data.plan });
      setSavedMsg('Plan saved.');
    } finally {
      setSaving(false);
    }
  }

  async function suggestProducts() {
    setSuggesting(true);
    try {
      const res = await api.post(`/customers/${customerId}/plan/suggest`);
      setPortfolio(res.data.portfolio);
      setPlan((prev) => ({
        ...prev,
        proposedProducts: res.data.proposedProducts || [],
      }));
    } finally {
      setSuggesting(false);
    }
  }

  function toggleGoal(goal) {
    setPlan((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal) ? prev.goals.filter((g) => g !== goal) : [...prev.goals, goal],
    }));
  }

  function toggleProduct(index) {
    setPlan((prev) => {
      const next = [...prev.proposedProducts];
      next[index] = { ...next[index], selected: !next[index].selected };
      return { ...prev, proposedProducts: next };
    });
  }

  function exportPdf() {
    exportPlanToPdf({ customer, portfolio, plan, agentName: agent?.name });
  }

  if (!customerId) {
    return <p className="text-xs text-slate-400">No customer selected.</p>;
  }

  if (loading) {
    return (
      <div className="py-8">
        <LoadingSpinner />
      </div>
    );
  }

  const priorityTone = { high: 'danger', medium: 'warning', low: 'neutral' };

  return (
    <div className={`space-y-4 ${embedded ? '' : 'max-w-4xl'}`}>
      {!embedded && customer && (
        <div>
          <h1 className="text-lg font-bold text-slate-800">Plan for {customer.name}</h1>
          <p className="text-xs text-slate-500">Build a client plan and export to PDF for your meeting.</p>
        </div>
      )}

      {customer && portfolio && (
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Client snapshot</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Age {portfolio.age ?? '—'} · {portfolio.healthCondition || 'Health not recorded'} · {portfolio.policyCount} policies
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={saving} onClick={savePlan}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" onClick={exportPdf}>
                <FileDown size={14} /> Export PDF
              </Button>
            </div>
          </div>
          <PortfolioPieChart slices={portfolio.pieChart?.slices || []} size={140} />
          {savedMsg && <p className="text-[11px] text-emerald-600 mt-2">{savedMsg}</p>}
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Meeting goals</h3>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGoal(g)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                plan.goals.includes(g)
                  ? 'bg-brand-100 border-brand-300 text-brand-800'
                  : 'border-slate-200 text-slate-500 hover:border-brand-200'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Proposed enhancements</h3>
          <Button size="sm" variant="secondary" disabled={suggesting} onClick={suggestProducts}>
            <Sparkles size={14} /> {suggesting ? 'Analysing…' : 'AI suggest'}
          </Button>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">Select items to include in the exported PDF.</p>
        <div className="space-y-2">
          {(plan.proposedProducts || []).map((p, i) => (
            <label
              key={`${p.productType}-${i}`}
              className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                p.selected ? 'border-brand-300 bg-brand-50/40' : 'border-slate-100'
              }`}
            >
              <input type="checkbox" checked={Boolean(p.selected)} onChange={() => toggleProduct(i)} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-800">{p.label}</span>
                  <Badge tone={priorityTone[p.priority] || 'neutral'}>{p.priority}</Badge>
                  {p.action === 'enhance' && <Badge tone="accent">Enhance</Badge>}
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">{p.reason}</p>
              </div>
            </label>
          ))}
          {!plan.proposedProducts?.length && (
            <p className="text-[11px] text-slate-400">Use AI suggest to populate recommendations based on age, health, and current cover.</p>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Coverage gap calculator</h3>
        <FinancialCalculator
          defaultMode="coverage_gap"
          onShare={(result) => {
            if (result?.mode === 'coverage_gap') {
              setPlan((prev) => ({ ...prev, coverageGap: result }));
            }
          }}
        />
        {plan.coverageGap && (
          <p className="text-[11px] text-brand-700 mt-2">
            Gap saved: S${Number(plan.coverageGap.coverageGap || 0).toLocaleString('en-SG')} — included in PDF export.
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Session notes</h3>
        <textarea
          value={plan.notes}
          onChange={(e) => setPlan((prev) => ({ ...prev, notes: e.target.value }))}
          rows={4}
          placeholder="Discussion points, client preferences, follow-up items…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </Card>

      {customer?.policies?.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Policies on file</h3>
          <div className="space-y-1.5">
            {customer.policies.map((p) => (
              <div key={p.id} className="flex justify-between text-[11px] border-b border-slate-50 pb-1.5">
                <span className="font-medium text-slate-700">{productLabel(p.productType)}</span>
                <span className="text-slate-400">{p.policyNumber}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
