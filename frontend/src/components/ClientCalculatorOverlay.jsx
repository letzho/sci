import { TrendingUp, X } from 'lucide-react';

function formatCurrency(n) {
  return `S$${Number(n).toLocaleString()}`;
}

export default function ClientCalculatorOverlay({ result, onDismiss }) {
  if (!result) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-40 max-w-sm mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-brand-100 p-4 animate-slide-in">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <TrendingUp size={16} /> Shared projection
          </div>
          <button type="button" onClick={onDismiss} className="text-slate-400">
            <X size={16} />
          </button>
        </div>
        {result.mode === 'investment' && (
          <div className="text-xs space-y-1 text-slate-600">
            <p>
              Saving <strong>{formatCurrency(result.monthlyContribution)}/month</strong> for {result.years} years at {result.annualReturn}% could grow to{' '}
              <strong className="text-brand-700">{formatCurrency(result.futureValue)}</strong>.
            </p>
          </div>
        )}
        {result.mode === 'retirement' && (
          <p className="text-xs text-slate-600">
            To reach <strong>{formatCurrency(result.targetAmount)}</strong> in {result.years} years, you'd need about{' '}
            <strong className="text-brand-700">{formatCurrency(result.requiredMonthly)}/month</strong>.
          </p>
        )}
        {result.mode === 'coverage_gap' && (
          <p className="text-xs text-slate-600">
            Estimated coverage gap: <strong className="text-rose-600">{formatCurrency(result.coverageGap)}</strong> based on your income replacement needs.
          </p>
        )}
        {result.mode === 'premium_estimate' && (
          <p className="text-xs text-slate-600">
            Illustrative annual premium estimate:{' '}
            <strong className="text-brand-700">{formatCurrency(result.premium)}</strong> based on the profile your representative entered.
          </p>
        )}
        <p className="text-[10px] text-slate-400 mt-2">Illustrative only — discuss with your representative.</p>
      </div>
    </div>
  );
}
