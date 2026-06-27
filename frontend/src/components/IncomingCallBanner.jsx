import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from './ui.jsx';
import styles from './IncomingCallBanner.module.css';

/**
 * Full-screen incoming-call alert for the Client Portal. Rendered by
 * ClientLayout whenever the backend pushes an `incoming-call` socket event
 * (the agent started a virtual call and this customer is online but not yet
 * on the call screen).
 */
export default function IncomingCallBanner({ call, onAnswer, onDecline }) {
  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 pb-8 sm:pb-0 ${styles.backdrop}`}>
      <div className={`w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 ${styles.card}`}>
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 ${styles.avatarRing}`}>
            <Video size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800">Incoming video call</div>
            <div className="text-xs text-slate-500 truncate">{call?.agentName || 'Your representative'} is calling…</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="danger" onClick={onDecline} className={styles.declineBtn}>
            <PhoneOff size={16} /> Decline
          </Button>
          <Button variant="success" onClick={onAnswer} className={styles.answerBtn}>
            <Phone size={16} /> Answer
          </Button>
        </div>
      </div>
    </div>
  );
}
