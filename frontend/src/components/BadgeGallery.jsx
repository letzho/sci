import { BadgeCheck, Compass, Flame, Rocket, Shield, Sparkles } from 'lucide-react';
import styles from './BadgeGallery.module.css';

const ICONS = {
  rocket: Rocket,
  compass: Compass,
  flame: Flame,
  sparkles: Sparkles,
  shield: Shield,
  'badge-check': BadgeCheck,
};

/**
 * Earned/locked badge grid. `compact` renders small tiles with no progress
 * caption (for the dashboard hero); the full version (Impact page) shows
 * progress-toward-goal on locked badges.
 */
export default function BadgeGallery({ badges = [], compact = false }) {
  return (
    <div className={`grid ${compact ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3'} gap-3`}>
      {badges.map((b) => {
        const Icon = ICONS[b.icon] || Sparkles;
        return (
          <div
            key={b.id}
            title={b.description}
            className={`flex flex-col items-center text-center rounded-xl border px-2 py-3 ${
              b.earned ? `border-amber-200 bg-amber-50 ${styles.earned}` : `border-slate-100 bg-slate-50 ${styles.locked}`
            }`}
          >
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center mb-1.5 ${
                b.earned ? `text-white ${styles.earnedIcon}` : 'bg-slate-200 text-slate-400'
              }`}
            >
              <Icon size={16} />
            </div>
            <div className={`text-[11px] font-semibold ${b.earned ? 'text-amber-800' : 'text-slate-400'}`}>{b.label}</div>
            {!compact && (
              <div className="text-[10px] text-slate-400 mt-0.5">{b.earned ? 'Earned' : `${b.progress}/${b.goal}`}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
