import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import CustomerPlanPanel from '../../components/CustomerPlanPanel.jsx';
import { Button } from '../../components/ui.jsx';

export default function CustomerPlan() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/agent')}>
        <ArrowLeft size={14} /> Back to dashboard
      </Button>
      <CustomerPlanPanel customerId={customerId} />
    </div>
  );
}
