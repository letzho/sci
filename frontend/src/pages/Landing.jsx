import { Link } from 'react-router-dom';
import { Monitor, Smartphone, ArrowRight } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import styles from './Landing.module.css';

const ROLES = [
  {
    to: '/agent/login',
    icon: Monitor,
    device: 'Web console',
    title: "I'm a Representative",
    desc: 'Live guidance, compliance checks and client insights during every conversation.',
    cta: 'Enter console',
    variant: 'rep',
  },
  {
    to: '/client',
    icon: Smartphone,
    device: 'Mobile view',
    title: "I'm a Client",
    desc: 'Join a call, chat, or review your policies — a clean, simple experience.',
    cta: 'Open client view',
    variant: 'client',
  },
];

export default function Landing() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo size={32} />
        <span className={styles.badge}>PolyFinTech100 · UX/CX</span>
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Who's using ClarityAI?</h1>
          <p className={styles.subtitle}>Choose how you'd like to continue.</p>
        </div>

        <div className={styles.roles}>
          {ROLES.map((r) => (
            <Link key={r.to} to={r.to} className={`${styles.roleCard} ${styles[r.variant]}`}>
              <div className={styles.roleTop}>
                <span className={styles.iconWrap}>
                  <r.icon size={26} strokeWidth={1.75} />
                </span>
                <span className={styles.device}>{r.device}</span>
              </div>
              <h2 className={styles.roleTitle}>{r.title}</h2>
              <p className={styles.roleDesc}>{r.desc}</p>
              <span className={styles.roleCta}>
                {r.cta}
                <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      </main>

      <footer className={styles.footer}>
        Supports representatives — it explains products, and never advises, recommends, or sells.
      </footer>
    </div>
  );
}
