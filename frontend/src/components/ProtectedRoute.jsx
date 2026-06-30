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
    const sessionExpired = sessionStorage.getItem('sci_session_expired') === '1';
    if (sessionExpired) sessionStorage.removeItem('sci_session_expired');
    return (
      <Navigate
        to="/agent/login"
        replace
        state={
          sessionExpired
            ? { message: 'Your session expired (often after a database re-seed). Please sign in again.' }
            : undefined
        }
      />
    );
  }

  return children;
}
