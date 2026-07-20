import { useCallback, useEffect, useState } from 'react';
import { X, Sparkles, Check, HelpCircle, FileText, ArrowRight, Copy, Send } from 'lucide-react';
import api from '../api/client';
import { getSocket } from '../socket.js';
import { LoadingSpinner } from './ui.jsx';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ms', label: 'Melayu' },
  { code: 'ta', label: 'தமிழ்' },
];

function Section({ icon: Icon, title, items, tint }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} className={tint} />
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[12px] text-slate-600">
            <span className="text-slate-300">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * End-of-session Clarity Recap. The rep generates a plain-English summary of
 * what was covered / still unclear / sources, in the customer's language, then
 * reviews and shares it. Compliance-safe: it summarises, never recommends.
 */
export default function ClarityRecapModal({ conversationId, onClose }) {
  const [lang, setLang] = useState('en');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback((language) => {
    setLoading(true);
    setError(null);
    api
      .get(`/conversations/${conversationId}/recap`, { params: { lang: language } })
      .then((res) => setData(res.data))
      .catch(() => setError('Could not generate the recap.'))
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => {
    load(lang);
  }, [lang, load]);

  const recap = data?.recap;

  function recapAsText() {
    if (!recap) return '';
    const lines = [recap.greeting, ''];
    if (recap.explained?.length) {
      lines.push('What we covered:');
      recap.explained.forEach((e) => lines.push(`• ${e}`));
      lines.push('');
    }
    if (recap.stillUnclear?.length) {
      lines.push('Still to clarify:');
      recap.stillUnclear.forEach((e) => lines.push(`• ${e}`));
      lines.push('');
    }
    if (recap.nextSteps?.length) {
      lines.push('Next steps:');
      recap.nextSteps.forEach((e) => lines.push(`• ${e}`));
    }
    return lines.join('\n');
  }

  function copyRecap() {
    navigator.clipboard?.writeText(recapAsText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function sendToClient() {
    try {
      const socket = getSocket();
      // A recap is always a substantive explanation of the conversation, so it
      // always qualifies for the customer's "did you understand?" feedback.
      socket.emit('agent-send-approved', { conversationId, text: recapAsText(), informational: true });
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <>
      <button type="button" className="fixed inset-0 bg-slate-900/50 z-40" onClick={onClose} aria-label="Close recap" />
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8 pointer-events-auto animate-fade-in">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <FileText size={17} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Clarity Recap</h3>
                <p className="text-[11px] text-slate-500">Review, then share with your client</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Language selector */}
          <div className="px-5 pt-3 flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 mr-1">Language:</span>
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  lang === l.code ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="py-8 flex flex-col items-center gap-2">
                <LoadingSpinner />
                <p className="text-[11px] text-slate-400">Summarising the conversation…</p>
              </div>
            )}
            {error && <p className="text-xs text-rose-600">{error}</p>}

            {!loading && recap && (
              <>
                {recap.greeting && <p className="text-[13px] text-slate-700 font-medium">{recap.greeting}</p>}
                <Section icon={Check} title="What we covered" items={recap.explained} tint="text-emerald-600" />
                <Section icon={HelpCircle} title="Still to clarify" items={recap.stillUnclear} tint="text-amber-600" />
                <Section icon={FileText} title="Where this came from" items={recap.sources} tint="text-slate-500" />
                <Section icon={ArrowRight} title="Next steps" items={recap.nextSteps} tint="text-brand-600" />
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                  <Sparkles size={11} className="text-slate-300" />
                  <p className="text-[10px] text-slate-400">
                    {data.source === 'ai' ? 'AI-generated' : 'Generated'} summary of what was discussed — it never recommends or sells a product.
                  </p>
                </div>
              </>
            )}
          </div>

          {!loading && recap && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={copyRecap}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={sendToClient}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700"
              >
                <Send size={13} /> {sent ? 'Sent to client chat' : 'Send to client'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
