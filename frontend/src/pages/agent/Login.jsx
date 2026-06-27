import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck } from 'lucide-react';
import Logo from '../../components/Logo.jsx';
import { Button, Card } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import styles from './Login.module.css';

export default function AgentLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sessionMessage = location.state?.message;
  const [email, setEmail] = useState('agent@sci.demo');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/agent');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`min-h-screen bg-slate-50 flex items-center justify-center px-4 ${styles.page}`}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Logo size={40} />
        </div>
        <Card className={`p-6 ${styles.card}`}>
          <div className="flex items-center gap-2 mb-1">
            <LogIn size={18} className="text-brand-600" />
            <h1 className="text-lg font-bold text-slate-800">Representative sign in</h1>
          </div>
          <p className="text-xs text-slate-500 mb-5">Access your live guidance console.</p>
          {sessionMessage && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{sessionMessage}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Work email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 ${styles.input}`}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 ${styles.input}`}
              />
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className={`mt-5 flex items-start gap-2 bg-brand-50 rounded-xl p-3 ${styles.demoNotice}`}>
            <ShieldCheck size={15} className="text-brand-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-brand-700">
              Demo credentials are pre-filled: <strong>agent@sci.demo</strong> / <strong>demo1234</strong>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
