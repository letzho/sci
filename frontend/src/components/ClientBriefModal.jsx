import { useEffect, useState } from 'react';
import {
  X, Sparkles, MessageCircle, HelpCircle, AlertTriangle, ClipboardList, History,
  ShieldCheck, CalendarClock, User,
} from 'lucide-react';
import api from '../api/client';
import { LoadingSpinner, productLabel } from './ui.jsx';

function Section({ icon: Icon, title, tint, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} className={tint} />
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function BulletList({ items, marker = '•', className = '' }) {
  if (!items?.length) return <p className="text-[11px] text-slate-400">None.</p>;
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className={`text-[12px] text-slate-600 flex gap-1.5 ${className}`}>
          <span className="text-slate-300 shrink-0">{marker}</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Pre-call Client Brief. Compiles the customer's profile, portfolio, prior
 * sessions and topics already discussed into a compliance-safe briefing —
 * "know your client" background study before the rep starts a conversation.
 */
export default function ClientBriefModal({ customerId, customerName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/customers/${customerId}/brief`)
      .then((res) => active && setData(res.data))
      .catch(() => active && setError('Could not load the client brief.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [customerId]);

  const brief = data?.brief;
  const meta = data?.meta;
  const portfolio = data?.portfolio;

  return (
    <>
      <button type="button" className="fixed inset-0 bg-slate-900/50 z-40" onClick={onClose} aria-label="Close brief" />
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8 pointer-events-auto animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
                <User size={17} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Client Brief</h3>
                <p className="text-[11px] text-slate-500">{customerName} · prepare before your call</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {loading && (
              <div className="py-10 flex flex-col items-center gap-2">
                <LoadingSpinner />
                <p className="text-[11px] text-slate-400">Compiling profile, history and context…</p>
              </div>
            )}
            {error && <p className="text-xs text-rose-600">{error}</p>}

            {brief && (
              <>
                {/* Snapshot chips */}
                <div className="flex flex-wrap gap-1.5">
                  {portfolio?.age != null && <Chip>{portfolio.age} yrs</Chip>}
                  {meta?.healthCondition && <Chip tone="amber">{meta.healthCondition}</Chip>}
                  <Chip>{meta?.sessionCount || 0} prior session{meta?.sessionCount === 1 ? '' : 's'}</Chip>
                  {meta?.lastSessionAgo && <Chip>last {meta.lastSessionAgo}</Chip>}
                  {portfolio?.totalSumAssured > 0 && <Chip>S${portfolio.totalSumAssured.toLocaleString('en-SG')} cover</Chip>}
                </div>

                {/* AI summary */}
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[12px] text-slate-700 leading-relaxed">{brief.summary}</p>
                </div>

                {/* Held products */}
                {meta?.heldProducts?.length > 0 && (
                  <Section icon={ShieldCheck} title="Current coverage" tint="text-emerald-600">
                    <div className="flex flex-wrap gap-1.5">
                      {portfolio.heldProductTypes.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px]">
                          {productLabel(t)}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Upcoming appointment */}
                {meta?.upcomingAppointments?.length > 0 && (
                  <Section icon={CalendarClock} title="Upcoming" tint="text-brand-600">
                    <p className="text-[12px] text-slate-600">
                      {new Date(meta.upcomingAppointments[0].scheduledAt).toLocaleString('en-SG', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}{' '}
                      · {meta.upcomingAppointments[0].channel.replace('_', ' ')}
                    </p>
                  </Section>
                )}

                <Section icon={ClipboardList} title="Areas to discuss" tint="text-brand-600">
                  <BulletList items={brief.talkingPoints} />
                </Section>

                <Section icon={MessageCircle} title="Icebreakers" tint="text-violet-600">
                  <BulletList items={brief.icebreakers} marker="“" />
                </Section>

                <Section icon={HelpCircle} title="Questions to ask" tint="text-sky-600">
                  <BulletList items={brief.suggestedQuestions} />
                </Section>

                {meta?.discussedTopics?.length > 0 && (
                  <Section icon={History} title="Already covered" tint="text-slate-500">
                    <BulletList items={meta.discussedTopics.slice(0, 5)} />
                  </Section>
                )}

                {brief.watchOuts?.length > 0 && (
                  <Section icon={AlertTriangle} title="Watch-outs" tint="text-amber-600">
                    <BulletList items={brief.watchOuts} />
                  </Section>
                )}

                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 mt-2">
                  <Sparkles size={11} className="text-slate-300" />
                  <p className="text-[10px] text-slate-400">
                    {data.source === 'ai' ? 'AI-compiled' : 'Compiled'} from this client's records. Background only — it never recommends or sells a product.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Chip({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-100 text-amber-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}
