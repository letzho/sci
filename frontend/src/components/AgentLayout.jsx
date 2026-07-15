import { useEffect, useState } from 'react';
import { LayoutDashboard, LogOut, BarChart3, BookOpen, DollarSign, GitCompare, Compass } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import api from '../api/client';
import Logo from './Logo.jsx';
import PersonAvatar from './PersonAvatar.jsx';
import PremiumPredictorModal from './PremiumPredictorModal.jsx';
import XPBar from './XPBar.jsx';
import XPBurstOverlay from './XPBurstOverlay.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { mergeGamification, useGamificationBonus } from '../context/GamificationBonusContext.jsx';
import styles from './AgentLayout.module.css';

export default function AgentLayout() {
  const { agent, logout } = useAuth();
  const { bonusXp } = useGamificationBonus();
  const [gamification, setGamification] = useState(null);
  const [premiumOpen, setPremiumOpen] = useState(false);

  useEffect(() => {
    api
      .get('/metrics')
      .then((res) => setGamification(mergeGamification(res.data.gamification, bonusXp)))
      .catch(() => {});
  }, [bonusXp]);

  return (
    <div className="min-h-screen bg-slate-50">
      <XPBurstOverlay />
      <header className={`bg-white border-b border-slate-100 sticky top-0 z-30 ${styles.header}`}>
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo size={34} />
          <nav className="hidden md:flex items-center gap-1">
            <NavLink
              to="/agent"
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${styles.navLink} ${
                  isActive ? `bg-brand-50 text-brand-700 ${styles.navLinkActive}` : 'text-slate-500 hover:bg-slate-50'
                }`
              }
            >
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>
            <NavLink
              to="/agent/metrics"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${styles.navLink} ${
                  isActive ? `bg-brand-50 text-brand-700 ${styles.navLinkActive}` : 'text-slate-500 hover:bg-slate-50'
                }`
              }
            >
              <BarChart3 size={16} /> Impact
            </NavLink>
            <NavLink
              to="/agent/product-fit"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${styles.navLink} ${
                  isActive ? `bg-brand-50 text-brand-700 ${styles.navLinkActive}` : 'text-slate-500 hover:bg-slate-50'
                }`
              }
            >
              <Compass size={16} /> Fit Guide
            </NavLink>
            <NavLink
              to="/agent/compare"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${styles.navLink} ${
                  isActive ? `bg-brand-50 text-brand-700 ${styles.navLinkActive}` : 'text-slate-500 hover:bg-slate-50'
                }`
              }
            >
              <GitCompare size={16} /> Compare
            </NavLink>
            <NavLink
              to="/agent/knowledge"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${styles.navLink} ${
                  isActive ? `bg-brand-50 text-brand-700 ${styles.navLinkActive}` : 'text-slate-500 hover:bg-slate-50'
                }`
              }
            >
              <BookOpen size={16} /> Knowledge
            </NavLink>
            <button
              type="button"
              onClick={() => setPremiumOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-brand-50 hover:text-brand-700 ${styles.navLink}`}
            >
              <DollarSign size={16} /> Predict premium
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPremiumOpen(true)}
              className="md:hidden flex items-center gap-1 px-2.5 py-2 rounded-lg text-sm font-medium text-brand-700 bg-brand-50"
              title="Predict premium"
            >
              <DollarSign size={16} />
            </button>
            <XPBar gamification={gamification} />
            <div className="flex items-center gap-2">
              <PersonAvatar name={agent?.name} emoji={agent?.avatarEmoji} className="h-9 w-9 bg-brand-50 text-base hidden sm:flex" />
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-slate-700">{agent?.name}</div>
                <div className="text-[11px] text-slate-400">Representative</div>
              </div>
            </div>
            <button
              onClick={logout}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 ${styles.logoutBtn}`}
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-5 py-6">
        <Outlet context={{ openPremiumPredictor: () => setPremiumOpen(true) }} />
      </main>
      {premiumOpen && <PremiumPredictorModal onClose={() => setPremiumOpen(false)} />}
    </div>
  );
}
