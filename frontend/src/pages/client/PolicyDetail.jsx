import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, ShieldCheck } from 'lucide-react';
import api from '../../api/client';
import PhoneFrame from '../../components/PhoneFrame.jsx';
import { Badge, Card, LoadingSpinner, productLabel } from '../../components/ui.jsx';
import styles from './PolicyDetail.module.css';

function formatCoverageKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatCoverageValue(value) {
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default function PolicyDetail() {
  const { policyId } = useParams();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/policies/${policyId}`).then((res) => {
      setPolicy(res.data.policy);
      setLoading(false);
    });
  }, [policyId]);

  if (loading || !policy) {
    return (
      <PhoneFrame>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="text-slate-400">
            <ArrowLeft size={18} />
          </button>
          <div className="font-bold text-slate-800 text-sm">{productLabel(policy.productType)}</div>
        </div>

        <Card className={`p-4 brand-gradient text-white border-none mb-4 ${styles.heroCard}`}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">{policy.status}</span>
          </div>
          <div className="text-lg font-bold">{policy.policyNumber}</div>
          <div className="text-xs text-brand-100 mt-1">
            S${Number(policy.premium).toLocaleString()} / {policy.premiumFreq}
          </div>
        </Card>

        <Card className={`p-4 mb-4 ${styles.datesCard}`}>
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={15} className="text-brand-500" />
            <span className="text-sm font-semibold text-slate-700">Key dates</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-slate-400">Start date</div>
              <div className="font-medium text-slate-700">{policy.startDate || '—'}</div>
            </div>
            <div>
              <div className="text-slate-400">Next payment</div>
              <div className="font-medium text-slate-700">{policy.nextPaymentDate || '—'}</div>
            </div>
            {policy.endDate && (
              <div>
                <div className="text-slate-400">End / maturity</div>
                <div className="font-medium text-slate-700">{policy.endDate}</div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <span className="text-sm font-semibold text-slate-700">Coverage summary</span>
          <div className="mt-3 space-y-2">
            {Object.entries(policy.coverage || {}).map(([key, value]) => (
              <div key={key} className={`flex items-center justify-between text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0 ${styles.coverageRow}`}>
                <span className="text-slate-500">{formatCoverageKey(key)}</span>
                <span className="font-medium text-slate-700">{formatCoverageValue(value)}</span>
              </div>
            ))}
            {Object.keys(policy.coverage || {}).length === 0 && (
              <p className="text-xs text-slate-400">No coverage details on file - check with your representative.</p>
            )}
          </div>
        </Card>

        <div className={`mt-4 flex items-start gap-2 bg-slate-50 rounded-xl p-3 ${styles.infoNotice}`}>
          <Badge tone="neutral">Info only</Badge>
          <p className="text-[11px] text-slate-400">
            This summary is for your reference. For advice on what's right for you, please speak with your representative.
          </p>
        </div>
      </div>
    </PhoneFrame>
  );
}
