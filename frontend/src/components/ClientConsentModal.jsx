import { ShieldCheck, Check } from 'lucide-react';
import PhoneFrame from './PhoneFrame.jsx';
import { Button } from './ui.jsx';

/**
 * One-time PDPA-style consent gate for the Client Portal. Insurance customers
 * are told clearly, before anything starts, that AI assists their rep, a human
 * reviews everything, and their information is handled privately — explicit,
 * plain-English consent that reflects MAS/PDPA good practice.
 */
export default function ClientConsentModal({ onAccept }) {
  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col justify-center px-6 py-8">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
          <ShieldCheck size={26} />
        </div>
        <h1 className="text-lg font-bold text-slate-800 text-center">Before we start</h1>
        <p className="text-xs text-slate-500 text-center mt-1 mb-5">A quick note on how this works and how your information is handled.</p>

        <ul className="space-y-3 mb-6">
          {[
            'An AI assistant helps your representative during this session — it never sells to you or decides anything on its own.',
            'A human representative reviews and approves every message before you see it.',
            'Your conversation may be transcribed only to help your representative assist you, and is handled privately.',
            'You can stop or leave the session at any time.',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Check size={11} />
              </span>
              <span className="text-[12px] text-slate-600 leading-snug">{t}</span>
            </li>
          ))}
        </ul>

        <Button className="w-full" onClick={onAccept}>
          I understand &amp; agree
        </Button>
        <p className="text-[10px] text-slate-400 text-center mt-3">
          By continuing you consent to this AI-assisted session. This is a demo of an internal representative-assist tool.
        </p>
      </div>
    </PhoneFrame>
  );
}
