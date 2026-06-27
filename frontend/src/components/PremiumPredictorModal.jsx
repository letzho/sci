import { DollarSign, X } from 'lucide-react';
import PremiumPredictor from './PremiumPredictor.jsx';
import { Card } from './ui.jsx';

export default function PremiumPredictorModal({ onClose, onShare }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <Card className="w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border-brand-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 brand-gradient text-white shrink-0">
          <div className="flex items-center gap-2">
            <DollarSign size={18} />
            <div>
              <div className="text-sm font-bold">Premium predictor</div>
              <div className="text-[10px] text-white/80">ML estimate from client profile</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <PremiumPredictor hideTitle onShare={onShare} />
        </div>
      </Card>
    </div>
  );
}
