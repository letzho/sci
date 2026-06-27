import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import api from '../api/client';
import { Badge, Button } from './ui.jsx';

/** Extra demo phrases beyond the seeded compliance_rules table. */
const EXTRA_PHRASES = [
  { phrase: '100% risk-free', replacement: 'Designed to manage risk effectively', severity: 'high' },
  { phrase: 'trust me, it\'s the best', replacement: 'Here are the objective features you can compare', severity: 'medium' },
  { phrase: 'guaranteed returns', replacement: 'Historically projected returns (not guaranteed)', severity: 'high' },
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findFlags(text, rules) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = [];
  for (const rule of rules) {
    const phrase = rule.flagged_phrase || rule.phrase;
    if (lower.includes(phrase.toLowerCase())) {
      found.push({
        phrase,
        severity: rule.severity,
        reason: rule.reason,
        suggestedReplacement: rule.suggested_replacement || rule.suggestedReplacement,
      });
    }
  }
  for (const extra of EXTRA_PHRASES) {
    if (lower.includes(extra.phrase.toLowerCase()) && !found.some((f) => f.phrase === extra.phrase)) {
      found.push({
        phrase: extra.phrase,
        severity: extra.severity,
        reason: 'Risky or non-compliant phrasing for regulated insurance conversations.',
        suggestedReplacement: extra.replacement,
      });
    }
  }
  return found;
}

function renderHighlighted(text, flags) {
  if (!text || !flags.length) return text;
  const patterns = flags.map((f) => escapeRegex(f.phrase)).join('|');
  const parts = text.split(new RegExp(`(${patterns})`, 'gi'));
  return parts.map((part, i) => {
    const match = flags.find((f) => f.phrase.toLowerCase() === part.toLowerCase());
    if (match) {
      return (
        <mark key={i} className="bg-rose-100 text-rose-800 rounded px-0.5" title={match.suggestedReplacement}>
          {part}
        </mark>
      );
    }
    return part;
  });
}

/**
 * FEATURE 3: Real-Time Compliance Guard
 * Highlights risky phrases in soft red + hover/tooltip compliant rewrites.
 * Progress toward "Compliance Clean x5" badge when reps self-correct before sending.
 */
export default function ComplianceGuardTextarea({ value, onChange, onKeyDown, placeholder, rows = 3, className = '', productType }) {
  const [rules, setRules] = useState([]);
  const [flags, setFlags] = useState([]);
  const [hoverFlag, setHoverFlag] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.get('/knowledge-base/compliance-rules').then((res) => {
      const mapped = (res.data.rules || []).map((r) => ({
        flagged_phrase: r.flaggedPhrase,
        severity: r.severity,
        reason: r.reason,
        suggested_replacement: r.suggestedReplacement,
      }));
      setRules(mapped);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const local = findFlags(value, rules);
      setFlags(local);
      if (value?.length > 10) {
        try {
          const res = await api.post('/tools/compliance-check', { text: value, productType });
          if (res.data.flags?.length) {
            const merged = [...local];
            for (const f of res.data.flags) {
              if (!merged.some((m) => m.phrase === f.phrase)) merged.push(f);
            }
            setFlags(merged);
          }
        } catch {
          /* local flags sufficient */
        }
      }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [value, rules, productType]);

  return (
    <div className="flex-1 space-y-2">
      <div className="relative rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-brand-300">
        <div
          className="absolute inset-0 px-3 py-2 text-sm whitespace-pre-wrap break-words pointer-events-none text-transparent"
          aria-hidden
        >
          {renderHighlighted(value, flags)}
        </div>
        <textarea
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={rows}
          className={`relative w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-800 focus:outline-none ${className}`}
        />
      </div>

      {flags.length > 0 && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
            <AlertTriangle size={12} /> Compliance Guard — {flags.length} phrase{flags.length > 1 ? 's' : ''} flagged
            <Badge tone="warning" className="ml-auto">
              <ShieldCheck size={10} /> Clean x5
            </Badge>
          </div>
          {flags.map((f) => (
            <div
              key={f.phrase}
              className="text-[11px] rounded-lg bg-white border border-rose-100 px-2 py-1.5"
              onMouseEnter={() => setHoverFlag(f.phrase)}
              onMouseLeave={() => setHoverFlag(null)}
            >
              <span className="font-medium text-rose-700">"{f.phrase}"</span>
              {(hoverFlag === f.phrase || flags.length === 1) && (
                <p className="text-slate-600 mt-1 flex items-start gap-1">
                  <Sparkles size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                  Try: <em>{f.suggestedReplacement}</em>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
