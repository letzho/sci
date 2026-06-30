import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';
import { isTokenExpired } from '../utils/token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sci_agent_token');
    const onAgentRoute = location.pathname.startsWith('/agent') && location.pathname !== '/agent/login';

    if (!token || isTokenExpired(token)) {
      if (token) localStorage.removeItem('sci_agent_token');
      setAgent(null);
      setLoading(false);
      return;
    }

    // Client portal does not use agent auth — skip /auth/me so a stale token
    // does not block the customer UI or spam 401s in the network tab.
    if (!onAgentRoute) {
      setLoading(false);
      return;
    }

    if (agent) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    api
      .get('/auth/me')
      .then((res) => {
        if (active) setAgent(res.data.agent);
      })
      .catch(() => {
        localStorage.removeItem('sci_agent_token');
        sessionStorage.setItem('sci_session_expired', '1');
        if (active) setAgent(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location.pathname, agent]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('sci_agent_token', res.data.token);
    sessionStorage.removeItem('sci_session_expired');
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
