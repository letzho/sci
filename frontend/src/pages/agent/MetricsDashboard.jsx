import { useEffect, useState } from 'react';
import { AlertTriangle, MessageCircle, MessagesSquare, ShieldCheck, TrendingUp } from 'lucide-react';
import api from '../../api/client';
import { Badge, Card, LoadingSpinner } from '../../components/ui.jsx';
import BadgeGallery from '../../components/BadgeGallery.jsx';
import styles from './MetricsDashboard.module.css';

function StatCard({ icon: Icon, label, value, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-rose-50 text-rose-600',
  };
  return (
    <Card className={`p-4 ${styles.statCard}`}>
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tones[tone]} ${styles.statIcon}`}>
        <Icon size={18} />
      </div>
      <div className={`mt-3 text-2xl font-bold text-slate-800 ${styles.statValue}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </Card>
  );
}

function Bar({ label, value, max, tone = 'bg-brand-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-400">{value}</span>
      </div>
      <div className={`h-2 rounded-full bg-slate-100 ${styles.barTrack}`}>
        <div className={`h-full ${tone} rounded-full ${styles.barFill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    api.get('/metrics').then((res) => setMetrics(res.data));
  }, []);

  if (!metrics) {
    return (
      <div className="py-20">
        <LoadingSpinner />
      </div>
    );
  }

  const channelMax = Math.max(metrics.byChannel.face_to_face, metrics.byChannel.virtual_call, metrics.byChannel.chat, 1);
  const topicMax = Math.max(...metrics.topTopics.map((t) => t.n), 1);
  const flagMax = Math.max(...metrics.topFlags.map((t) => t.n), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Measurable impact</h1>
        <p className="text-sm text-slate-500 mt-0.5">Live figures computed from real usage in this workspace.</p>
      </div>

      {metrics.gamification && (
        <Card className={`p-4 ${styles.achievementsCard}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Your achievements</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Level {metrics.gamification.level} &middot; {metrics.gamification.levelTitle} &middot;{' '}
                {metrics.gamification.badgesEarned}/{metrics.gamification.badgesTotal} badges unlocked
              </p>
            </div>
            {metrics.gamification.cleanStreak > 0 && (
              <Badge tone="warning">🔥 {metrics.gamification.cleanStreak}-session clean streak</Badge>
            )}
          </div>
          <BadgeGallery badges={metrics.gamification.badges} />
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MessagesSquare} label="Total conversations" value={metrics.totalConversations} />
        <StatCard icon={TrendingUp} label="Approved talking points served" value={metrics.totalTalkingPoints} tone="success" />
        <StatCard icon={AlertTriangle} label="Compliance flags caught" value={metrics.totalComplianceFlags} tone="warning" />
        <StatCard icon={ShieldCheck} label="Drafts reviewed before sending" value={metrics.draftsReviewed} tone="brand" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Sessions by channel</h2>
          <div className="space-y-3">
            <Bar label="Face-to-face" value={metrics.byChannel.face_to_face} max={channelMax} />
            <Bar label="Virtual call" value={metrics.byChannel.virtual_call} max={channelMax} />
            <Bar label="Chat" value={metrics.byChannel.chat} max={channelMax} />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Compliance flags by severity</h2>
          <div className="space-y-3">
            <Bar label="High risk" value={metrics.flagsBySeverity.high} max={metrics.totalComplianceFlags || 1} tone="bg-rose-500" />
            <Bar label="Medium risk" value={metrics.flagsBySeverity.medium} max={metrics.totalComplianceFlags || 1} tone="bg-amber-500" />
            <Bar label="Low risk" value={metrics.flagsBySeverity.low} max={metrics.totalComplianceFlags || 1} tone="bg-slate-400" />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Most-used approved talking points</h2>
          {metrics.topTopics.length === 0 ? (
            <p className="text-xs text-slate-400">No guidance served yet - run a session to populate this.</p>
          ) : (
            <div className="space-y-3">
              {metrics.topTopics.map((t) => (
                <Bar key={t.title} label={t.title} value={t.n} max={topicMax} tone="bg-emerald-500" />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Most-flagged phrases</h2>
          {metrics.topFlags.length === 0 ? (
            <p className="text-xs text-slate-400">No compliance flags caught yet.</p>
          ) : (
            <div className="space-y-3">
              {metrics.topFlags.map((t) => (
                <Bar key={t.title} label={t.title} value={t.n} max={flagMax} tone="bg-rose-500" />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className={`p-4 flex items-center gap-3 ${styles.summaryCard}`}>
        <MessageCircle size={18} className="text-brand-500 shrink-0" />
        <p className="text-xs text-slate-500">
          {metrics.totalMessages} total messages exchanged across all channels in this workspace.
        </p>
      </Card>
    </div>
  );
}
