import { useMemo, useState } from 'react';
import { Calculator, Share2, TrendingUp } from 'lucide-react';
import api from '../api/client';
import { Button, Card } from './ui.jsx';

const MODES = [
  { key: 'investment', label: 'Investment growth' },
  { key: 'retirement', label: 'Retirement target' },
  { key: 'coverage_gap', label: 'Coverage gap' },
];

function formatCurrency(n) {
  return `S$${Number(n).toLocaleString()}`;
}

export default function FinancialCalculator({ onShare, compact = false, defaultMode = 'investment' }) {
  const [mode, setMode] = useState(defaultMode);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [annualReturn, setAnnualReturn] = useState(5);
  const [years, setYears] = useState(15);
  const [targetAmount, setTargetAmount] = useState(500000);
  const [annualIncome, setAnnualIncome] = useState(72000);
  const [yearsToReplace, setYearsToReplace] = useState(10);
  const [existingCoverage, setExistingCoverage] = useState(100000);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    setLoading(true);
    try {
      const payload = {
        mode,
        monthlyContribution,
        annualReturn,
        years,
        targetAmount,
        annualIncome,
        yearsToReplace,
        existingCoverage,
      };
      const res = await api.post('/tools/calculate', payload);
      setResult(res.data);
    } catch (err) {
      console.error('Calculator failed:', err);
    } finally {
      setLoading(false);
    }
  }

  const maxBar = useMemo(() => {
    if (!result?.projection?.length) return 1;
    return Math.max(...result.projection.map((p) => p.balance), 1);
  }, [result]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calculator size={14} className="text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-700">Financial calculator</h3>
      </div>

      <div className="flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMode(m.key);
              setResult(null);
            }}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium ${
              mode === m.key ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'investment' && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-0.5">
            <span className="text-slate-500">Monthly (S$)</span>
            <input type="number" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
          <label className="space-y-0.5">
            <span className="text-slate-500">Return (% p.a.)</span>
            <input type="number" value={annualReturn} onChange={(e) => setAnnualReturn(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
          <label className="space-y-0.5 col-span-2">
            <span className="text-slate-500">Years</span>
            <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
        </div>
      )}

      {mode === 'retirement' && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-0.5 col-span-2">
            <span className="text-slate-500">Target amount (S$)</span>
            <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
          <label className="space-y-0.5">
            <span className="text-slate-500">Return (% p.a.)</span>
            <input type="number" value={annualReturn} onChange={(e) => setAnnualReturn(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
          <label className="space-y-0.5">
            <span className="text-slate-500">Years to save</span>
            <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
        </div>
      )}

      {mode === 'coverage_gap' && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-0.5">
            <span className="text-slate-500">Annual income (S$)</span>
            <input type="number" value={annualIncome} onChange={(e) => setAnnualIncome(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
          <label className="space-y-0.5">
            <span className="text-slate-500">Years to replace</span>
            <input type="number" value={yearsToReplace} onChange={(e) => setYearsToReplace(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
          <label className="space-y-0.5 col-span-2">
            <span className="text-slate-500">Existing life cover (S$)</span>
            <input type="number" value={existingCoverage} onChange={(e) => setExistingCoverage(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
        </div>
      )}

      <Button size="sm" onClick={calculate} disabled={loading} className="w-full">
        <TrendingUp size={14} /> {loading ? 'Calculating…' : 'Calculate'}
      </Button>

      {result && (
        <Card className="p-3 bg-brand-50/50 border-brand-100">
          {result.mode === 'investment' && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-semibold text-brand-800">
                <span>Projected value</span>
                <span>{formatCurrency(result.futureValue)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total contributed</span>
                <span>{formatCurrency(result.totalContributed)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Growth</span>
                <span>{formatCurrency(result.growth)}</span>
              </div>
              {!compact && result.projection?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-brand-100">
                  <div className="text-[10px] text-slate-500 mb-1">Growth projection</div>
                  <div className="flex items-end gap-0.5 h-16">
                    {result.projection.filter((_, i) => i % Math.max(1, Math.floor(result.projection.length / 8)) === 0).map((p) => (
                      <div key={p.year} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className="w-full bg-brand-500 rounded-t min-h-[2px]"
                          style={{ height: `${Math.max(4, (p.balance / maxBar) * 56)}px` }}
                          title={formatCurrency(p.balance)}
                        />
                        <span className="text-[9px] text-slate-400">Y{p.year}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {result.mode === 'retirement' && (
            <div className="text-xs space-y-1">
              <div className="flex justify-between font-semibold text-brand-800">
                <span>Monthly needed</span>
                <span>{formatCurrency(result.requiredMonthly)}</span>
              </div>
              <p className="text-slate-500">To reach {formatCurrency(result.targetAmount)} in {result.years} years at {result.annualReturn}% p.a.</p>
            </div>
          )}
          {result.mode === 'coverage_gap' && (
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Recommended cover</span>
                <span>{formatCurrency(result.recommendedCoverage)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Existing cover</span>
                <span>{formatCurrency(result.existingCoverage)}</span>
              </div>
              <div className="flex justify-between font-semibold text-rose-700">
                <span>Coverage gap</span>
                <span>{formatCurrency(result.coverageGap)}</span>
              </div>
            </div>
          )}
          {onShare && (
            <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => onShare(result)}>
              <Share2 size={13} /> Share with client on call
            </Button>
          )}
        </Card>
      )}

      <p className="text-[10px] text-slate-400">Illustrative only — not financial advice. Actual returns vary.</p>
    </div>
  );
}
