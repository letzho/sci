import { useEffect, useState } from 'react';
import { Check, Copy, Shield, Sparkles, X } from 'lucide-react';
import api from '../api/client';
import { Badge, Button } from './ui.jsx';

/**
 * FEATURE 1: Objection Buster Pivot Matrix
 * Feel-Felt-Found scripts contextualised with competitive comparison + web data.
 * Tied to the "Talking Point Pro" badge progression.
 */
export default function ObjectionBusterPanel({ productType, customerName, onClose, embedded = false }) {
  const [objections, setObjections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    api.get('/tools/objections').then((res) => setObjections(res.data.objections)).catch(() => {});
  }, []);

  async function handleObjection(key) {
    setActiveKey(key);
    setLoading(true);
    setScript(null);
    try {
      const res = await api.post('/tools/objection-buster', {
        objectionKey: key,
        productType,
        customerName,
      });
      setScript(res.data.script);
    } catch (err) {
      console.error('Objection buster failed:', err);
    } finally {
      setLoading(false);
    }
  }

  function copyScript() {
    if (!script?.steps) return;
    const text = script.steps.map((s) => `${s.label}: ${s.text}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shell = embedded
    ? 'space-y-3'
    : 'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-slide-in';

  return (
    <div className={shell}>
      {!embedded && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 brand-gradient text-white">
          <div className="flex items-center gap-2">
            <Shield size={18} />
            <div>
              <div className="text-sm font-bold">Objection Buster</div>
              <div className="text-[10px] text-white/80">Feel · Felt · Found pivot matrix</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${embedded ? '' : 'p-4'} space-y-4`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="accent">
            <Sparkles size={10} /> Talking Point Pro
          </Badge>
          <span className="text-[11px] text-slate-400">Quick-click when the client pushes back</span>
        </div>

        <div className="grid gap-2">
          {(objections.length ? objections : [
            { key: 'too_expensive', label: 'Too expensive', icon: '💰' },
            { key: 'need_to_think', label: 'Need to think about it', icon: '🤔' },
            { key: 'already_have_plan', label: 'Already have a plan', icon: '📋' },
          ]).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => handleObjection(o.key)}
              disabled={loading}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                activeKey === o.key ? 'border-brand-400 bg-brand-50 shadow-sm' : 'border-slate-100 hover:border-brand-200 hover:bg-slate-50'
              }`}
            >
              <span className="text-xl">{o.icon}</span>
              <span className="text-sm font-semibold text-slate-800">{o.label}</span>
            </button>
          ))}
        </div>

        {loading && <p className="text-xs text-slate-400 animate-pulse">Generating pivot script…</p>}

        {script?.steps && (
          <div className="rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/80 to-white p-4 space-y-3 shadow-card">
            {script.steps.map((s) => (
              <div key={s.step} className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {s.step}
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-brand-600">{s.label}</div>
                  <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={copyScript}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy full script'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
