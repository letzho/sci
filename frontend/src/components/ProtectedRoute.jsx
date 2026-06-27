import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingSpinner } from './ui.jsx';

export default function ProtectedRoute({ children }) {
  const { agent, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!agent) {
    return <Navigate to="/agent/login" replace />;
  }

  return children;
}
