import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { isTokenExpired } from '../utils/token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sci_agent_token');
    if (!token || isTokenExpired(token)) {
      if (token) localStorage.removeItem('sci_agent_token');
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setAgent(res.data.agent))
      .catch(() => {
        localStorage.removeItem('sci_agent_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('sci_agent_token', res.data.token);
    setAgent(res.data.agent);
    return res.data.agent;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sci_agent_token');
    setAgent(null);
  }, []);

  return (
    <AuthContext.Provider value={{ agent, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
