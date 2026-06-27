import { Link } from 'react-router-dom';
import { Briefcase, MessageSquare, ShieldCheck, Sparkles, Smartphone, Video, UserRound } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { Card } from '../components/ui.jsx';
import styles from './Landing.module.css';

const SOLUTIONS = [
  { icon: Sparkles, title: 'Real-time guidance', desc: 'Context-aware prompts surface automatically during live conversations.' },
  { icon: ShieldCheck, title: 'Consistent messaging', desc: 'Approved, clear and accurate wording for every client-facing rep.' },
  { icon: Briefcase, title: 'Compliance checks', desc: 'Automatically flags gaps and suggests approved language in the moment.' },
  { icon: UserRound, title: 'Customer trust', desc: 'Clear, professional explanations that build confidence instantly.' },
];

const CHANNELS = [
  { icon: Smartphone, title: 'Face-to-face', desc: 'Laptop prompts during in-person meetings.' },
  { icon: Video, title: 'Virtual calls', desc: 'Live video with smart on-screen guidance.' },
  { icon: MessageSquare, title: 'Chat & messaging', desc: 'AI-drafted replies, always reviewed by a human.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo size={34} />
          <span className="text-xs text-slate-400">PolyFinTech100 API Hackathon 2026 · UX/CX</span>
        </div>
      </header>

      <section className={`brand-gradient text-white ${styles.hero}`}>
        <div className={`max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-2 gap-10 items-center ${styles.heroContent}`}>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">
              ClarityAI helps representatives explain insurance clearly, consistently and compliantly.
            </h1>
            <p className="mt-4 text-brand-100 text-sm md:text-base max-w-lg">
              Real-time guidance, approved messaging and compliance checks - in person, on video calls, and in chat.
              Built to support representatives, never to advise or sell on its own.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/agent/login"
                className={`bg-white text-brand-700 font-semibold rounded-xl px-5 py-3 text-sm text-center hover:bg-brand-50 ${styles.ctaPrimary}`}
              >
                Enter as Representative →
              </Link>
              <Link
                to="/client"
                className={`bg-brand-700/40 border border-white/30 text-white font-semibold rounded-xl px-5 py-3 text-sm text-center hover:bg-brand-700/60 ${styles.ctaSecondary}`}
              >
                View Customer Portal (demo) →
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <div className={`bg-white/10 border border-white/20 rounded-2xl p-6 backdrop-blur-sm ${styles.briefCard}`}>
              <p className="text-sm text-brand-50 font-medium mb-3">Built for these challenges:</p>
              <ul className="space-y-2 text-sm text-brand-100">
                <li>• Mixed messages on product features and next steps</li>
                <li>• Inconsistent service quality across channels</li>
                <li>• Compliance gaps that can damage trust and reputation</li>
                <li>• Customers losing confidence in financial advice</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-14">
        <h2 className="text-xl font-bold text-slate-800 mb-1">What ClarityAI delivers</h2>
        <p className="text-sm text-slate-500 mb-6">Solution criteria from the brief, built end-to-end.</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {SOLUTIONS.map((s) => (
            <Card key={s.title} className={`p-5 ${styles.solutionCard}`}>
              <s.icon size={20} className="text-brand-600 mb-3" />
              <div className="font-semibold text-slate-800 text-sm">{s.title}</div>
              <p className="text-xs text-slate-500 mt-1.5">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-16">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Where it shines</h2>
        <p className="text-sm text-slate-500 mb-6">Fast, seamless and non-intrusive across every channel.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {CHANNELS.map((c) => (
            <Card key={c.title} className={`p-5 bg-brand-950 text-white border-none ${styles.channelCard}`}>
              <c.icon size={20} className={`text-brand-200 mb-3 ${styles.channelIcon}`} />
              <div className="font-semibold text-sm">{c.title}</div>
              <p className="text-xs text-brand-200 mt-1.5">{c.desc}</p>
            </Card>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-6">
          Covers Life insurance, Investment-linked policies, Critical illness, Integrated Shield Plans, and
          Retirement plans / CPF LIFE. This tool explains products — it does not advise, recommend, or sell.
        </p>
      </section>
    </div>
  );
}
