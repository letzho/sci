import { useEffect, useState } from 'react';
import { Compass } from 'lucide-react';
import api from '../../api/client';
import ProductFitGuide from '../../components/ProductFitGuide.jsx';
import ProductTypeComparison from '../../components/ProductTypeComparison.jsx';
import PersonAvatar from '../../components/PersonAvatar.jsx';
import { Card } from '../../components/ui.jsx';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis.js';

/**
 * Standalone Product Fit workspace: pick a customer and get a needs → product
 * guide, plus a product-category reference. Helps the rep bring the right
 * product to the right need — without recommending anything to the customer.
 */
export default function ProductFit() {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const { speak } = useSpeechSynthesis();

  useEffect(() => {
    api
      .get('/customers')
      .then((res) => {
        setCustomers(res.data.customers);
        if (res.data.customers?.[0]) setCustomerId(res.data.customers[0].id);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Compass size={20} className="text-brand-600" />
          Product Fit Guide
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Match a customer's needs to the products that address them, with plain-English talking points.
          A guide for you — it never recommends a product to the customer.
        </p>
      </div>

      <Card className="p-4">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {customers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCustomerId(c.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-colors ${
                customerId === c.id ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:border-brand-200'
              }`}
            >
              <PersonAvatar name={c.name} emoji={c.avatarEmoji || '🙂'} className="h-6 w-6 bg-white text-xs" />
              {c.name}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <ProductFitGuide customerId={customerId} onSpeak={speak} />
      </Card>

      <Card className="p-5">
        <ProductTypeComparison />
      </Card>
    </div>
  );
}
