import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const API = process.env.REACT_APP_API_URL || (window.location.origin + '/api');
const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load saved session
  useEffect(() => {
    const t = localStorage.getItem('basta_token');
    const u = localStorage.getItem('basta_user');
    if (t && u) {
      try { setToken(t); setUser(JSON.parse(u)); }
      catch { localStorage.removeItem('basta_token'); localStorage.removeItem('basta_user'); }
    }
    setLoading(false);
  }, []);

  // Listen for auth failure from socket (fired via custom event)
  useEffect(() => {
    const handler = () => {
      console.log('🔑 Auth failed — logging out');
      setUser(null);
      setToken(null);
      localStorage.removeItem('basta_token');
      localStorage.removeItem('basta_user');
    };
    window.addEventListener('basta:auth_failed', handler);
    return () => window.removeEventListener('basta:auth_failed', handler);
  }, []);

  const save = (user, token) => {
    setUser(user); setToken(token);
    localStorage.setItem('basta_token', token);
    localStorage.setItem('basta_user', JSON.stringify(user));
  };

  const adminLogin = useCallback(async (username, password) => {
    const r = await fetch(`${API}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const d = await r.json(); if (d.error) throw new Error(d.error);
    save(d.user, d.token); return d;
  }, []);

  const adminRegister = useCallback(async (username, password) => {
    const r = await fetch(`${API}/admin/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const d = await r.json(); if (d.error) throw new Error(d.error);
    save(d.user, d.token); return d;
  }, []);

  const playerJoin = useCallback(async (name) => {
    const r = await fetch(`${API}/player/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await r.json(); if (d.error) throw new Error(d.error);
    save(d.user, d.token); return d;
  }, []);

  const playerSolo = useCallback(async (name, password) => {
    const r = await fetch(`${API}/player/solo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password }) });
    const d = await r.json(); if (d.error) throw new Error(d.error);
    save(d.user, d.token); return d;
  }, []);

  const logout = useCallback(() => {
    setUser(null); setToken(null);
    localStorage.removeItem('basta_token');
    localStorage.removeItem('basta_user');
  }, []);

  return <Ctx.Provider value={{ user, token, loading, adminLogin, adminRegister, playerJoin, playerSolo, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
