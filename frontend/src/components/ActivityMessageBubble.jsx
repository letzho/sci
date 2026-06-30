import { Gamepad2, BookOpenCheck } from 'lucide-react';

export default function ActivityMessageBubble({ activity, sender }) {
  if (!activity) return null;

  const isAgent = sender === 'agent';
  const isSuccess = activity.tone === 'success';

  return (
    <div
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm border ${
        isAgent
          ? 'bg-brand-50 border-brand-200 text-slate-800 ml-auto'
          : 'bg-emerald-50 border-emerald-200 text-slate-800'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {activity.title?.includes('Quiz') ? (
          <BookOpenCheck size={14} className={isSuccess ? 'text-emerald-600' : 'text-brand-600'} />
        ) : (
          <Gamepad2 size={14} className={isSuccess ? 'text-emerald-600' : 'text-violet-600'} />
        )}
        <span className="text-xs font-semibold">{activity.title}</span>
      </div>
      <p className="text-xs text-slate-600">{activity.body}</p>
      {activity.insights?.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {activity.insights.map((line) => (
            <li key={line} className="text-[11px] text-slate-600">
              • {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
