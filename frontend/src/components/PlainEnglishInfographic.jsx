import { useEffect, useState } from 'react';
import { BarChart3, Share2, Sparkles } from 'lucide-react';
import api from '../api/client';
import { Badge, Button, Card, LoadingSpinner } from './ui.jsx';

/**
 * FEATURE 4: Dynamic Plain English Visual Infographic
 * Renders simplicity score, cost vs benefits, and jargon-free bullets from comparison data.
 */
export default function PlainEnglishInfographic({ productType, sourceUrl, onShare }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!productType) return;
    setLoading(true);
    api
      .post('/tools/plain-english-infographic', { productType, sourceUrl })
      .then((res) => setData(res.data.infographic))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [productType, sourceUrl]);

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data) return null;

  const costPct = data.costRange?.max > data.costRange?.min
    ? Math.round(((data.costRange.max - data.costRange.min) / data.costRange.max) * 100)
    : 40;

  return (
    <Card className="p-4 border-brand-100 bg-gradient-to-br from-white to-brand-50/40 shadow-card overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-brand-600" />
          <h3 className="text-sm font-bold text-slate-800">Plain English breakdown</h3>
        </div>
        <Badge tone="accent">
          <Sparkles size={10} /> Simplicity {data.simplicityScore}/100
        </Badge>
      </div>

      <p className="text-[11px] text-slate-500 mb-4">{data.title}</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-white border border-slate-100 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Cost spread</div>
          <div className="text-lg font-bold text-slate-800 mt-1">
            {data.costRange.unit === 'S$/mo' ? `S$${data.costRange.min}–${data.costRange.max}` : `${data.costRange.min}–${data.costRange.max}%`}
          </div>
          <div className="h-2 rounded-full bg-slate-100 mt-2 overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${costPct}%` }} />
          </div>
        </div>
        <div className="rounded-xl bg-white border border-slate-100 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Simplicity score</div>
          <div className="text-lg font-bold text-brand-700 mt-1">{data.simplicityScore}</div>
          <div className="h-2 rounded-full bg-slate-100 mt-2 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${data.simplicityScore}%` }} />
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-2 mb-4">
        {data.benefits?.map((b) => (
          <div key={b.label} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
            <div className="text-[10px] font-bold text-emerald-700">{b.label}</div>
            <div className="text-[11px] text-slate-600 mt-0.5">{b.value}</div>
          </div>
        ))}
      </div>

      <ul className="space-y-2 mb-3">
        {data.plainBullets?.map((bullet, i) => (
          <li key={i} className="text-xs text-slate-600 flex gap-2">
            <span className="text-brand-500 font-bold">•</span>
            {bullet}
          </li>
        ))}
      </ul>

      <Button
        size="sm"
        className="w-full"
        onClick={() => {
          setShared(true);
          onShare?.(data);
          setTimeout(() => setShared(false), 2000);
        }}
      >
        <Share2 size={14} /> {shared ? 'Shared with client!' : 'Share with client'}
      </Button>

      <p className="text-[10px] text-slate-400 mt-2">{data.disclaimer}</p>
    </Card>
  );
}
