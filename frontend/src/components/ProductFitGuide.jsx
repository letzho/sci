import { useEffect, useState } from 'react';
import { Compass, MessageCircle, HelpCircle, Check, AlertCircle, ChevronDown, Volume2 } from 'lucide-react';
import api from '../api/client';
import { LoadingSpinner } from './ui.jsx';

const NEED_CHIPS = [
  { key: 'family_protection', label: 'Family protection' },
  { key: 'medical_bills', label: 'Medical bills' },
  { key: 'critical_illness_income', label: 'Critical illness' },
  { key: 'retirement_income', label: 'Retirement' },
  { key: 'wealth_growth', label: 'Wealth growth' },
];

/**
 * Product Fit Guide — maps a customer's needs to the product category that
 * addresses each, with plain-English talking points for the rep. A guide for
 * the representative; it never recommends a product to the customer.
 */
export default function ProductFitGuide({ customerId, onSpeak, compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]); // empty = all needs
  const [openCard, setOpenCard] = useState(0);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    const qs = selected.length ? `?needs=${selected.join(',')}` : '';
    api
      .get(`/customers/${customerId}/product-fit${qs}`)
      .then((res) => active && setData(res.data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [customerId, selected]);

  function toggleNeed(key) {
    setOpenCard(0);
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  if (!customerId) {
    return <p className="text-xs text-slate-400 py-4 text-center">Select a customer to see their product fit guide.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Compass size={15} className="text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-700">Product Fit Guide</h3>
      </div>
      <p className="text-[11px] text-slate-500">
        Match {data?.customerName ? data.customerName.split(' ')[0] : 'the client'}'s needs to the products that address them.
        Tap a need to focus. This guides your conversation — it isn't a recommendation to the customer.
      </p>

      {/* Need selector */}
      <div className="flex flex-wrap gap-1.5">
        {NEED_CHIPS.map((n) => {
          const on = selected.includes(n.key);
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => toggleNeed(n.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
              }`}
            >
              {n.label}
            </button>
          );
        })}
        {selected.length > 0 && (
          <button type="button" onClick={() => setSelected([])} className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-600">
            Show all
          </button>
        )}
      </div>

      {loading && (
        <div className="py-6 flex justify-center">
          <LoadingSpinner />
        </div>
      )}

      {!loading && data?.context && <p className="text-[11px] text-slate-400 italic">{data.context}</p>}

      {!loading &&
        data?.cards?.map((card, i) => {
          const p = card.product;
          const open = openCard === i;
          return (
            <div key={card.need.key} className="rounded-xl border border-slate-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenCard(open ? -1 : i)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="text-lg shrink-0">{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800">{p.label}</span>
                    {p.held && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        <Check size={9} /> Already has
                      </span>
                    )}
                    {p.isGap && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        <AlertCircle size={9} /> Not covered
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">for: {card.need.label}</div>
                </div>
                <ChevronDown size={14} className={`text-slate-300 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-slate-50">
                  <p className="text-[11px] text-slate-600">{p.whatItDoes}</p>
                  <div className="rounded-lg bg-amber-50/60 border border-amber-100 px-2.5 py-1.5">
                    <p className="text-[10px] text-amber-800"><span className="font-semibold">Be clear about:</span> {p.tradeoff}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <MessageCircle size={11} className="text-brand-500" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">How to explain it</span>
                    </div>
                    <ul className="space-y-1">
                      {p.talkingPoints.map((t, ti) => (
                        <li key={ti} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                          <span className="text-slate-300">•</span>
                          <span className="flex-1">{t}</span>
                          {onSpeak && (
                            <button type="button" onClick={() => onSpeak(t)} className="text-slate-300 hover:text-brand-600 shrink-0" title="Read aloud">
                              <Volume2 size={11} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <HelpCircle size={11} className="text-sky-500" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Questions to ask</span>
                    </div>
                    <ul className="space-y-1">
                      {p.questionsToAsk.map((q, qi) => (
                        <li key={qi} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                          <span className="text-slate-300">?</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}

      {!loading && data?.disclaimer && (
        <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">{data.disclaimer}</p>
      )}
    </div>
  );
}
