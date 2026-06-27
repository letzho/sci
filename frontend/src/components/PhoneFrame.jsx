import { Wifi, BatteryFull, SignalHigh } from 'lucide-react';
import styles from './PhoneFrame.module.css';

/**
 * Wraps Client Portal screens in a phone-shaped frame, echoing the supplied
 * UI reference (status bar + rounded device chrome) so the customer-facing
 * demo visually reads as "a mobile app" even though it's running in a
 * desktop browser window for the presentation.
 */
export default function PhoneFrame({ children, footer }) {
  return (
    <div className={`min-h-screen w-full brand-gradient flex items-center justify-center py-8 px-4 ${styles.backdrop}`}>
      <div className={`relative w-full max-w-[400px] bg-slate-50 rounded-[2.25rem] shadow-2xl border-[6px] border-slate-900 overflow-hidden ${styles.device}`}>
        <div className={`absolute top-0 left-0 right-0 h-7 bg-slate-50 flex items-center justify-between px-6 text-[11px] font-semibold text-slate-900 z-20 ${styles.statusBar}`}>
          <span>11:30</span>
          <div className="flex items-center gap-1">
            <SignalHigh size={13} />
            <Wifi size={13} />
            <BatteryFull size={14} />
          </div>
        </div>
        <div className={`pt-7 min-h-[680px] max-h-[80vh] overflow-y-auto flex flex-col ${styles.screen}`}>{children}</div>
        {footer && <div className="border-t border-slate-100 bg-white">{footer}</div>}
      </div>
    </div>
  );
}
