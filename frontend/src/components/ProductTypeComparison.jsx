import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import api from '../api/client';
import { LoadingSpinner } from './ui.jsx';

/**
 * Product-type comparator (feature B): a side-by-side reference of the five
 * in-scope product CATEGORIES across key dimensions. Educational only — a
 * screen-shareable explainer, never a recommendation.
 */
export default function ProductTypeComparison() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get('/tools/product-types')
      .then((res) => active && setData(res.data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-6 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  if (!data) return <p className="text-xs text-slate-400 py-4 text-center">Couldn't load product reference.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers size={15} className="text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-700">Product types at a glance</h3>
      </div>
      <p className="text-[11px] text-slate-500">
        What each of the five product categories does — handy to explain the differences to a customer.
      </p>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 pr-2 text-slate-500 font-medium sticky left-0 bg-white">Dimension</th>
              {data.products.map((p) => (
                <th key={p.productType} className="text-left py-2 px-2 font-semibold text-slate-700 min-w-[130px]">
                  <span className="mr-1">{p.emoji}</span>
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.dimensions.map((dim) => (
              <tr key={dim.key} className="border-b border-slate-50 align-top">
                <td className="py-2 pr-2 font-medium text-slate-600 sticky left-0 bg-white whitespace-nowrap">{dim.label}</td>
                {data.products.map((p) => (
                  <td key={p.productType} className="py-2 px-2 text-slate-600">
                    {p[dim.key] || <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400">{data.disclaimer}</p>
    </div>
  );
}
