import { useState } from 'react';
import { Sparkles, X, MessageSquare, HelpCircle, Compass, GitCompare, FileText } from 'lucide-react';

const TOUR_KEY = 'sci_tour_dismissed';

const STEPS = [
  { icon: MessageSquare, text: 'Start a Chat with a customer, then open the Client view in a second window and send a message — watch 3 tone-matched replies appear.' },
  { icon: HelpCircle, text: 'As the client, ask a hard question ("will I be covered with stage 1 cancer?") — see the honest, compliant answer, then tap "Still unclear".' },
  { icon: Compass, text: 'Open Fit Guide to map a customer\'s needs to the right products, with talking points.' },
  { icon: GitCompare, text: 'Try Compare — drag in 2+ policy PDFs and get an AI side-by-side table.' },
  { icon: FileText, text: 'End with Clarity Recap — a plain-English summary you can send the customer in their own language.' },
];

/**
 * Dismissible "try this" checklist for first-time reps / testers, so a sponsor
 * trialling the app lands on the strongest moments instead of guessing.
 */
export default function FirstRunTour() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(TOUR_KEY) === '1';
    } catch {
      return true;
    }
  });

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch {
      /* noop */
    }
    setDismissed(true);
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-5 relative">
      <button type="button" onClick={dismiss} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600" aria-label="Dismiss">
        <X size={16} />
      </button>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={16} className="text-brand-600" />
        <h2 className="text-sm font-bold text-slate-800">Welcome — here's the 2-minute tour</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3">Try these to see what ClarityAI does best. You can dismiss this anytime.</p>
      <ol className="space-y-2">
        {STEPS.map((s, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 h-5 w-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span className="text-[12px] text-slate-600 leading-snug flex items-start gap-1.5">
              <s.icon size={13} className="text-brand-500 mt-0.5 shrink-0" />
              {s.text}
            </span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={dismiss} className="mt-3 text-[11px] font-medium text-brand-600 hover:underline">
        Got it, don't show again
      </button>
    </div>
  );
}
