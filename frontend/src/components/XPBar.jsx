import { Flame } from 'lucide-react';
import styles from './XPBar.module.css';

/**
 * Compact level / XP-progress / clean-streak pill shown in the persistent
 * agent header, so progress is visible everywhere in the console - including
 * during live sessions - without ever interrupting the rep's work.
 */
export default function XPBar({ gamification }) {
  if (!gamification) return null;
  const { level, levelTitle, progressPct, cleanStreak, xpIntoLevel, xpForNextLevel, nextTitle } = gamification;

  const title = xpForNextLevel
    ? `${xpIntoLevel}/${xpForNextLevel} XP to ${nextTitle}`
    : `${levelTitle} - max level`;

  return (
    <div className={`hidden md:flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 ${styles.pill}`} title={title}>
      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${styles.levelDot}`}>
        {level}
      </div>
      <div className="min-w-[88px]">
        <div className="text-[11px] font-semibold text-amber-800 leading-tight whitespace-nowrap">{levelTitle}</div>
        <div className={`h-1.5 w-full rounded-full bg-amber-200/70 mt-0.5 overflow-hidden ${styles.track}`}>
          <div className={styles.fill} style={{ width: `${progressPct}%` }} />
        </div>
      </div>
      {cleanStreak > 0 && (
        <div className={`flex items-center gap-0.5 text-[11px] font-semibold text-orange-600 ${styles.streak}`}>
          <Flame size={13} className={styles.flameIcon} />
          {cleanStreak}
        </div>
      )}
    </div>
  );
}
