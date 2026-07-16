import { useMemo, useState } from 'react';
import { Calculator, Share2, TrendingUp, ShieldCheck, Lock } from 'lucide-react';
import api from '../api/client';
import { Button, Card } from './ui.jsx';

const MODES = [
  { key: 'investment', label: 'Investment growth' },
  { key: 'retirement', label: 'Retirement target' },
  { key: 'coverage_gap', label: 'Coverage gap' },
  { key: 'mas_illustration', label: 'MAS illustration' },
];

// MAS caps benefit illustrations for par/investment-linked products at two
// prescribed rates so returns can never be over-illustrated. These are fixed
// and not editable — that's the whole compliance point.
const MAS_RATES = [4, 8];

function formatCurrency(n) {
  return `S$${Number(n).toLocaleString()}`;
}

/** Future value of level monthly contributions at an annual rate over N years. */
function futureValueMonthly(monthly, annualRatePct, years) {
  const i = annualRatePct / 100 / 12;
  const n = years * 12;
  if (i === 0) return monthly * n;
  return monthly * ((Math.pow(1 + i, n) - 1) / i);
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
    // MAS illustration is computed locally with fixed, non-editable rates.
    if (mode === 'mas_illustration') {
      const totalContributed = monthlyContribution * years * 12;
      setResult({
        mode: 'mas_illustration',
        monthly: monthlyContribution,
        years,
        totalContributed,
        scenarios: MAS_RATES.map((rate) => ({
          rate,
          futureValue: Math.round(futureValueMonthly(monthlyContribution, rate, years)),
        })),
      });
      return;
    }

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

      {mode === 'mas_illustration' && (
        <div className="space-y-2">
          <div className="flex items-start gap-1.5 rounded-lg bg-brand-50 border border-brand-100 px-2.5 py-1.5">
            <ShieldCheck size={13} className="text-brand-600 mt-0.5 shrink-0" />
            <p className="text-[10px] text-brand-800">
              Projected at MAS's two prescribed illustration rates. The rates are <span className="font-semibold">locked</span> — you can't
              illustrate higher returns, so over-promising is impossible.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="space-y-0.5">
              <span className="text-slate-500">Monthly (S$)</span>
              <input type="number" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
            </label>
            <label className="space-y-0.5">
              <span className="text-slate-500">Years</span>
              <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5" />
            </label>
            <div className="col-span-2 flex items-center gap-1.5 text-[10px] text-slate-500">
              <Lock size={11} /> Illustration rates fixed at {MAS_RATES[0]}% and {MAS_RATES[1]}% p.a.
            </div>
          </div>
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
          {result.mode === 'mas_illustration' && (
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                {result.scenarios.map((s) => (
                  <div key={s.rate} className="rounded-lg bg-white border border-brand-100 p-2 text-center">
                    <div className="text-[10px] text-slate-400">at {s.rate}% p.a.</div>
                    <div className="text-sm font-bold text-brand-800">{formatCurrency(s.futureValue)}</div>
                    <div className="text-[9px] text-slate-400">{s.rate === MAS_RATES[0] ? 'lower illustration' : 'higher illustration'}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total contributed</span>
                <span>{formatCurrency(result.totalContributed)}</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Both figures are illustrations at MAS-capped rates — <span className="font-medium">not guaranteed</span>. Actual returns may be higher or lower.
              </p>
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
