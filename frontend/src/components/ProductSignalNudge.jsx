import { Lightbulb, X, Volume2 } from 'lucide-react';

/**
 * Live "need detected" nudge (feature C). When the customer voices a need,
 * the rep sees which product category addresses it plus talking points. Rep
 * only — never shown to the customer, and it prompts the rep, never sells.
 */
export default function ProductSignalNudge({ signal, onDismiss, onSpeak }) {
  if (!signal) return null;
  const { need, product } = signal;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 animate-fade-in">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 h-6 w-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
          <Lightbulb size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-amber-800">
              Client mentioned <span className="font-semibold">{need.label.toLowerCase()}</span>
            </p>
            <button type="button" onClick={onDismiss} className="text-amber-400 hover:text-amber-700 shrink-0" aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-base">{product.emoji}</span>
            <span className="text-xs font-semibold text-slate-800">{product.label}</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">{product.whatItDoes}</p>

          <ul className="mt-1.5 space-y-1">
            {product.talkingPoints.map((t, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                <span className="text-amber-400">•</span>
                <span className="flex-1">{t}</span>
                {onSpeak && (
                  <button type="button" onClick={() => onSpeak(t)} className="text-slate-300 hover:text-brand-600 shrink-0" title="Read aloud">
                    <Volume2 size={11} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[9px] text-amber-700/80">Prompt for you — open the Fit Guide tab for questions to ask. Not a recommendation to the client.</p>
        </div>
      </div>
    </div>
  );
}
