import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'sci_practice_bonus_xp';

const GamificationBonusContext = createContext(null);

export function GamificationBonusProvider({ children }) {
  const [bonusXp, setBonusXp] = useState(() => Number(localStorage.getItem(STORAGE_KEY) || 0));
  const [xpBurst, setXpBurst] = useState(null);

  const awardPracticeXp = useCallback((amount = 50, label = '+50 XP') => {
    setBonusXp((prev) => {
      const next = prev + amount;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
    setXpBurst({ amount, label, id: Date.now() });
    setTimeout(() => setXpBurst(null), 2800);
  }, []);

  const value = useMemo(() => ({ bonusXp, awardPracticeXp, xpBurst }), [bonusXp, awardPracticeXp, xpBurst]);

  return <GamificationBonusContext.Provider value={value}>{children}</GamificationBonusContext.Provider>;
}

export function useGamificationBonus() {
  const ctx = useContext(GamificationBonusContext);
  if (!ctx) throw new Error('useGamificationBonus must be used within GamificationBonusProvider');
  return ctx;
}

/** Merge server gamification snapshot with local practice XP for display. */
export function mergeGamification(base, bonusXp) {
  if (!base) return null;
  const xp = base.xp + (bonusXp || 0);
  const levels = [
    { level: 1, title: 'New Rep', minXp: 0 },
    { level: 2, title: 'Rising Rep', minXp: 100 },
    { level: 3, title: 'Confident Advisor', minXp: 300 },
    { level: 4, title: 'Trusted Advisor', minXp: 600 },
    { level: 5, title: 'Client Champion', minXp: 1000 },
    { level: 6, title: 'SCI Certified Pro', minXp: 1500 },
    { level: 7, title: 'Master Advisor', minXp: 2200 },
  ];
  let current = levels[0];
  for (const l of levels) {
    if (xp >= l.minXp) current = l;
    else break;
  }
  const idx = levels.indexOf(current);
  const next = levels[idx + 1];
  const xpIntoLevel = xp - current.minXp;
  const xpForNextLevel = next ? next.minXp - current.minXp : null;
  const progressPct = next ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100;
  return {
    ...base,
    xp,
    level: current.level,
    levelTitle: current.title,
    xpIntoLevel,
    xpForNextLevel,
    progressPct,
    nextTitle: next ? next.title : null,
    practiceBonusXp: bonusXp || 0,
  };
}
