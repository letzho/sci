import { useGamificationBonus } from '../context/GamificationBonusContext.jsx';

/** Floating +XP animation after Flight Simulator practice. */
export default function XPBurstOverlay() {
  const { xpBurst } = useGamificationBonus();
  if (!xpBurst) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none animate-fade-in">
      <div className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm shadow-lg flex items-center gap-2">
        <span className="text-lg">⚡</span>
        {xpBurst.label}
      </div>
    </div>
  );
}
