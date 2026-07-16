import { HelpCircle, X } from 'lucide-react';

/**
 * Live "did they understand?" nudge. When the customer sounds confused, the rep
 * sees a gentle prompt to pause and re-explain before moving on. Rep-only.
 */
export default function UnderstandingNudge({ confusion, onDismiss }) {
  if (!confusion) return null;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 animate-fade-in">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 h-6 w-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
          <HelpCircle size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-rose-800">Client may not have understood</p>
            <button type="button" onClick={onDismiss} className="text-rose-400 hover:text-rose-700 shrink-0" aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
          {confusion.text && <p className="text-[11px] text-slate-600 mt-1 italic">"{confusion.text}"</p>}
          <p className="text-[11px] text-rose-700 mt-1.5">
            Pause and re-explain in simpler terms, or ask "which part shall I go over again?" before moving on.
          </p>
        </div>
      </div>
    </div>
  );
}
