import { useEffect, useState } from 'react';
import { DollarSign, Share2, Sparkles } from 'lucide-react';
import api from '../api/client';
import { Button, Card } from './ui.jsx';

const REGIONS = [
  { value: 'southeast', label: 'Southeast' },
  { value: 'southwest', label: 'Southwest' },
  { value: 'northeast', label: 'Northeast' },
  { value: 'northwest', label: 'Northwest' },
];

function formatCurrency(n) {
  return `S$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PremiumPredictor({ onShare, hideTitle = false }) {
  const [age, setAge] = useState(35);
  const [sex, setSex] = useState('male');
  const [bmi, setBmi] = useState(28);
  const [children, setChildren] = useState(0);
  const [smoker, setSmoker] = useState('no');
  const [region, setRegion] = useState('southeast');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mlAvailable, setMlAvailable] = useState(null);

  useEffect(() => {
    api
      .get('/tools/premium-predictor/status')
      .then((res) => setMlAvailable(res.data.available))
      .catch(() => setMlAvailable(false));
  }, []);

  async function predict() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post('/tools/predict-premium', {
        age,
        sex,
        bmi,
        children,
        smoker,
        region,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Prediction failed');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs';

  return (
    <div className="space-y-3">
      {!hideTitle && (
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-slate-700">Premium predictor</h3>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Enter client profile details — the ML model estimates an annual premium. Review with the client before discussing; this is not a binding quote.
      </p>

      {mlAvailable === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
          ML service offline. Start it with: <code className="text-[10px]">cd backend/ml && pip install -r requirements.txt && python app.py</code>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-0.5">
          <span className="text-slate-500">Age</span>
          <input type="number" min={18} max={100} value={age} onChange={(e) => setAge(Number(e.target.value))} className={inputClass} />
        </label>
        <label className="space-y-0.5">
          <span className="text-slate-500">Sex</span>
          <select value={sex} onChange={(e) => setSex(e.target.value)} className={inputClass}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label className="space-y-0.5">
          <span className="text-slate-500">BMI</span>
          <input type="number" min={10} max={60} step={0.1} value={bmi} onChange={(e) => setBmi(Number(e.target.value))} className={inputClass} />
        </label>
        <label className="space-y-0.5">
          <span className="text-slate-500">Children</span>
          <input type="number" min={0} max={10} value={children} onChange={(e) => setChildren(Number(e.target.value))} className={inputClass} />
        </label>
        <label className="space-y-0.5">
          <span className="text-slate-500">Smoker</span>
          <select value={smoker} onChange={(e) => setSmoker(e.target.value)} className={inputClass}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        <label className="space-y-0.5">
          <span className="text-slate-500">Region</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Button size="sm" onClick={predict} disabled={loading || mlAvailable === false} className="w-full">
        <DollarSign size={14} /> {loading ? 'Predicting…' : 'Predict premium'}
      </Button>

      {error && <p className="text-[11px] text-rose-600">{error}</p>}

      {result && (
        <Card className="p-3 bg-brand-50/50 border-brand-100">
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-slate-600">Estimated annual premium</span>
            <span className="text-lg font-bold text-brand-800">{formatCurrency(result.premium)}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Based on age {result.inputs.age}, {result.inputs.sex}, BMI {result.inputs.bmi}, {result.inputs.children} child
            {result.inputs.children === 1 ? '' : 'ren'}, smoker: {result.inputs.smoker}, region: {result.inputs.region}.
          </p>
          {onShare && (
            <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => onShare(result)}>
              <Share2 size={13} /> Share estimate with client on call
            </Button>
          )}
        </Card>
      )}

      <p className="text-[10px] text-slate-400">{result?.disclaimer || 'Illustrative ML estimate only — not financial advice or a firm quote.'}</p>
    </div>
  );
}
