import { GitCompare } from 'lucide-react';
import PolicyComparison from '../../components/PolicyComparison.jsx';
import InsuranceComparison from '../../components/InsuranceComparison.jsx';
import ProductTypeComparison from '../../components/ProductTypeComparison.jsx';
import { Card } from '../../components/ui.jsx';

/**
 * Standalone Policy Comparison workspace. A rep can drag in policy documents
 * from any insurer and get an AI-built, side-by-side comparison — available
 * anytime, not only inside a live call.
 */
export default function PolicyCompare() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <GitCompare size={20} className="text-brand-600" />
          Policy Comparison
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Drop policy documents from different insurers and let AI lay out the differences side by side —
          premium, coverage, term, exclusions and more. Objective facts only; it never recommends a policy.
        </p>
      </div>

      <Card className="p-5">
        <PolicyComparison />
      </Card>

      <Card className="p-5">
        <ProductTypeComparison />
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Reference benchmark</h2>
        <p className="text-[11px] text-slate-500 mb-3">
          Curated market benchmark data by product type — handy when you don't have the documents on hand.
        </p>
        <InsuranceComparison productType="life_insurance" />
      </Card>
    </div>
  );
}
