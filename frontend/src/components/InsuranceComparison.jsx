import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import api from '../api/client';
import { LoadingSpinner } from './ui.jsx';
import PlainEnglishInfographic from './PlainEnglishInfographic.jsx';

function formatMetric(value, format) {
  if (format === 'currency') return `S$${value}`;
  if (format === 'percent') return `${value}%`;
  if (format === 'score') return `${value}/100`;
  return String(value);
}

function ComparisonBarChart({ insurers, metric, maxVal }) {
  const higherIsBetter = metric.higherIsBetter;
  return (
    <div className="space-y-2">
      {insurers.map((ins) => {
        const val = ins[metric.key];
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const isBest =
          higherIsBetter
            ? val === Math.max(...insurers.map((i) => i[metric.key]))
            : val === Math.min(...insurers.map((i) => i[metric.key]));
        return (
          <div key={ins.id}>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className={`font-medium ${isBest ? 'text-brand-700' : 'text-slate-600'}`}>{ins.name}</span>
              <span className="text-slate-500">{formatMetric(val, metric.format)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isBest ? 'bg-brand-500' : 'bg-slate-300'}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function InsuranceComparison({ productType }) {
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('chart');
  const [metricKey, setMetricKey] = useState(null);

  useEffect(() => {
    if (!productType) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get('/tools/comparisons', { params: { productType } })
      .then((res) => {
        setComparison(res.data.comparison);
        setMetricKey(res.data.comparison?.metrics?.[0]?.key || null);
      })
      .catch(() => setComparison(null))
      .finally(() => setLoading(false));
  }, [productType]);

  const activeMetric = useMemo(
    () => comparison?.metrics?.find((m) => m.key === metricKey) || comparison?.metrics?.[0],
    [comparison, metricKey]
  );

  const maxVal = useMemo(() => {
    if (!comparison?.insurers?.length || !activeMetric) return 1;
    return Math.max(...comparison.insurers.map((i) => i[activeMetric.key]), 1);
  }, [comparison, activeMetric]);

  if (loading) {
    return (
      <div className="py-6 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!comparison) {
    return (
      <p className="text-xs text-slate-400 py-4 text-center">
        No insurer comparison data for this product type yet. Upload reference material in the Knowledge Library.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={14} className="text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-700">Insurer comparison</h3>
      </div>
      <p className="text-[11px] text-slate-500">{comparison.productLabel}</p>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setView('chart')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] ${view === 'chart' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}
        >
          <BarChart3 size={12} /> Chart
        </button>
        <button
          type="button"
          onClick={() => setView('table')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] ${view === 'table' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}
        >
          <Table2 size={12} /> Table
        </button>
      </div>

      {view === 'chart' && activeMetric && (
        <>
          <div className="flex flex-wrap gap-1">
            {comparison.metrics.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetricKey(m.key)}
                className={`px-2 py-0.5 rounded text-[10px] ${metricKey === m.key ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <ComparisonBarChart insurers={comparison.insurers} metric={activeMetric} maxVal={maxVal} />
        </>
      )}

      {view === 'table' && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-2 text-slate-500 font-medium">Insurer</th>
                {comparison.metrics.map((m) => (
                  <th key={m.key} className="text-right py-2 px-1 text-slate-500 font-medium whitespace-nowrap">
                    {m.label}
                  </th>
                ))}
                <th className="text-left py-2 pl-2 text-slate-500 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {comparison.insurers.map((ins) => (
                <tr key={ins.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2 pr-2 font-medium text-slate-700">{ins.name}</td>
                  {comparison.metrics.map((m) => (
                    <td key={m.key} className="text-right py-2 px-1 text-slate-600">
                      {formatMetric(ins[m.key], m.format)}
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-slate-400">{ins.highlight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-slate-400">{comparison.disclaimer}</p>

      <PlainEnglishInfographic productType={productType} />
    </div>
  );
}
