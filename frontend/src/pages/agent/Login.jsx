import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import Logo from '../../components/Logo.jsx';
import { Button, Card } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import styles from './Login.module.css';

export default function AgentLogin() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sessionMessage = location.state?.message;

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('agent@sci.demo');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  function switchMode(next) {
    setMode(next);
    setError('');
    if (next === 'signup') {
      setEmail('');
      setPassword('');
    } else {
      setEmail('agent@sci.demo');
      setPassword('demo1234');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        await register({ name, email, password });
      } else {
        await login(email, password);
      }
      navigate('/agent');
    } catch (err) {
      setError(err.response?.data?.error || (isSignup ? 'Could not create account.' : 'Login failed. Check your credentials.'));
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
            {isSignup ? <UserPlus size={18} className="text-brand-600" /> : <LogIn size={18} className="text-brand-600" />}
            <h1 className="text-lg font-bold text-slate-800">{isSignup ? 'Create your representative account' : 'Representative sign in'}</h1>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            {isSignup ? 'Try the console with your own account — you get the same demo customers.' : 'Access your live guidance console.'}
          </p>
          {sessionMessage && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{sessionMessage}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignup && (
              <div>
                <label className="text-xs font-medium text-slate-600">Your name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jamie Lee"
                  className={`mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 ${styles.input}`}
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600">Work email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isSignup ? 'you@agency.com' : undefined}
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
                placeholder={isSignup ? 'At least 8 characters' : undefined}
                className={`mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 ${styles.input}`}
              />
              {isSignup && <p className="text-[10px] text-slate-400 mt-1">Stored securely — hashed with bcrypt, never in plain text.</p>}
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (isSignup ? 'Creating…' : 'Signing in…') : isSignup ? 'Create account & enter' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            {isSignup ? (
              <button type="button" onClick={() => switchMode('signin')} className="text-xs text-brand-600 hover:underline">
                Already have an account? Sign in
              </button>
            ) : (
              <button type="button" onClick={() => switchMode('signup')} className="text-xs text-brand-600 hover:underline">
                New here? Create a representative account
              </button>
            )}
          </div>

          {!isSignup && (
            <div className={`mt-4 flex items-start gap-2 bg-brand-50 rounded-xl p-3 ${styles.demoNotice}`}>
              <ShieldCheck size={15} className="text-brand-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-brand-700">
                Demo credentials are pre-filled: <strong>agent@sci.demo</strong> / <strong>demo1234</strong>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
