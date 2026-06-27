import { Calendar, MessageCircle, X } from 'lucide-react';
import { Button } from './ui.jsx';

export default function ClientCoffeeChatOverlay({ invite, agentName, onAccept, onDismiss }) {
  if (!invite?.template) return null;
  const { template } = invite;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-in">
        <div className="px-4 py-4 brand-gradient text-white">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-2xl">{template.icon}</span>
              <h2 className="text-base font-bold mt-1">{template.subject}</h2>
              <p className="text-xs text-white/80 mt-0.5">From {agentName || 'your representative'}</p>
            </div>
            <button type="button" onClick={onDismiss} className="text-white/70 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
          <p className="text-sm text-slate-700">{template.message}</p>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
              <MessageCircle size={13} /> Conversation starters
            </div>
            <ul className="space-y-1.5">
              {template.icebreakers.map((q, i) => (
                <li key={i} className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  "{q}"
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
              <Calendar size={13} /> Suggested agenda
            </div>
            <ul className="space-y-1">
              {template.agenda.map((item, i) => (
                <li key={i} className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={onAccept}>
              Sounds good!
            </Button>
            <Button variant="outline" onClick={onDismiss}>
              Maybe later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
