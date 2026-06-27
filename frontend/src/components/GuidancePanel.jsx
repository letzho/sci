import { AlertTriangle, FileText, Globe, MessageSquareText, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';
import { Badge } from './ui.jsx';
import styles from './GuidancePanel.module.css';

const SEVERITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' };

function ComplianceFlagCard({ flag, onSpeak }) {
  return (
    <div className={`rounded-xl border border-rose-200 bg-rose-50/70 p-3 animate-slide-in ${styles.flagCard}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-rose-800">Compliance flag: "{flag.phrase}"</span>
            <Badge tone={SEVERITY_TONE[flag.severity] || 'warning'}>{flag.severity} risk</Badge>
          </div>
          <p className="text-xs text-rose-700 mt-1">{flag.reason}</p>
          <div className="mt-2 flex items-start gap-1.5 bg-white rounded-lg border border-rose-100 p-2">
            <ShieldCheck size={14} className="text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-700">{flag.suggestedReplacement}</p>
          </div>
        </div>
        {onSpeak && (
          <button
            onClick={() => onSpeak(flag.suggestedReplacement)}
            className={`text-rose-500 hover:text-rose-700 shrink-0 ${styles.speakBtn}`}
            title="Read suggested language aloud"
          >
            <Volume2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function TalkingPointCard({ point, onSpeak }) {
  return (
    <div className={`rounded-xl border border-brand-100 bg-brand-50/60 p-3 animate-slide-in ${styles.pointCard}`}>
      <div className="flex items-start gap-2">
        <MessageSquareText size={16} className="text-brand-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="text-sm font-semibold text-brand-900">{point.topic}</div>
            {point.source === 'learned' && (
              <span
                title={`Sourced from an uploaded document: ${point.sourceDocument || 'reference PDF'}`}
                className="inline-flex items-center gap-1"
              >
                <Badge tone="accent">
                  <FileText size={10} /> from your document
                </Badge>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">{point.plainEnglish}</p>
          <details className="mt-1.5 group">
            <summary className="text-[11px] text-brand-600 cursor-pointer select-none">
              {point.source === 'learned' ? 'Source excerpt' : 'Approved wording'}
            </summary>
            <p className="text-xs text-slate-700 mt-1 bg-white rounded-lg border border-brand-100 p-2">{point.approvedMessage}</p>
          </details>
        </div>
        {onSpeak && (
          <button
            onClick={() => onSpeak(point.approvedMessage)}
            className={`text-brand-500 hover:text-brand-700 shrink-0 ${styles.speakBtn}`}
            title="Read approved wording aloud"
          >
            <Volume2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function WebResultCard({ result }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/70 p-3 animate-slide-in ${styles.pointCard}`}>
      <div className="flex items-start gap-2">
        <Globe size={16} className="text-slate-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="text-sm font-semibold text-slate-700 truncate">{result.title || 'Web result'}</div>
            <Badge tone="neutral">
              <Globe size={10} /> from the web
            </Badge>
          </div>
          <p className="text-xs text-slate-600 mt-1">{result.snippet}</p>
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-brand-500 hover:underline truncate block mt-1"
              title={result.url}
            >
              {result.url}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ExplainerCard({ text }) {
  return (
    <div className={`rounded-xl border border-accent-500/20 bg-accent-400/5 p-3 animate-slide-in ${styles.explainerCard}`}>
      <div className="flex items-start gap-2">
        <Sparkles size={16} className="text-accent-500 mt-0.5 shrink-0" />
        <div>
          <div className="text-xs font-semibold text-accent-600 uppercase tracking-wide">AI-enhanced explainer</div>
          <p className="text-xs text-slate-700 mt-1">{text}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * The core non-intrusive AI guidance overlay: a stacked feed of compliance
 * flags + approved talking points + (optional) AI explainer, newest first.
 * Used by both the Face-to-Face channel and the Virtual Call channel.
 */
export default function GuidancePanel({ history, onSpeak }) {
  if (!history || history.length === 0) {
    return (
      <div className={`h-full flex flex-col items-center justify-center text-center px-6 py-10 text-slate-400 ${styles.emptyState}`}>
        <ShieldCheck size={28} className="mb-2 opacity-50" />
        <p className="text-sm">Guidance will appear here automatically as the conversation happens.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history
        .slice()
        .reverse()
        .map((g, idx) => (
          <div key={g.id || `${g.generatedAt}-${idx}`} className="animate-fade-in">
            {g.triggerText && (
              <div className="text-[11px] text-slate-400 mb-1 truncate" title={g.triggerText}>
                Heard: "{g.triggerText}"
              </div>
            )}
            <div className="space-y-2">
              {g.complianceFlags?.map((flag) => (
                <ComplianceFlagCard key={flag.id} flag={flag} onSpeak={onSpeak} />
              ))}
              {g.talkingPoints?.map((point) => (
                <TalkingPointCard key={point.id} point={point} onSpeak={onSpeak} />
              ))}
              {g.webResults?.map((result, i) => (
                <WebResultCard key={result.url || i} result={result} />
              ))}
              {g.aiExplainer && <ExplainerCard text={g.aiExplainer} />}
            </div>
          </div>
        ))}
    </div>
  );
}
