import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const Ctx = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const ref = useRef(null);
  const visCleanupRef = useRef(null);

  const connect = useCallback((token) => {
    if (visCleanupRef.current) { visCleanupRef.current(); visCleanupRef.current = null; }
    if (ref.current) ref.current.disconnect();

    const serverUrl = process.env.REACT_APP_SERVER_URL || window.location.origin;
    const s = io(serverUrl, {
      auth: { token }, transports: ['websocket', 'polling'],
      reconnection: true, reconnectionAttempts: Infinity,
      reconnectionDelay: 500, reconnectionDelayMax: 3000,
      randomizationFactor: 0.5, timeout: 10000,
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    // Al volver de bloquear el móvil / cambiar de app, forzar reconexión ya
    // (sin esperar al backoff). Safari iOS congela el socket al bloquear pantalla.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !s.connected) s.connect();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    visCleanupRef.current = () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
    };

    s.on('connect_error', (err) => {
      if (err.message === 'Invalid token' || err.message === 'No token') {
        console.log('🔑 Bad token — clearing');
        localStorage.removeItem('basta_token');
        localStorage.removeItem('basta_user');
        window.dispatchEvent(new Event('basta:auth_failed'));
        s.disconnect();
      }
    });

    ref.current = s; setSocket(s);
  }, []);

  const disconnect = useCallback(() => {
    if (visCleanupRef.current) { visCleanupRef.current(); visCleanupRef.current = null; }
    if (ref.current) { ref.current.disconnect(); ref.current = null; setSocket(null); setConnected(false); }
  }, []);

  useEffect(() => () => {
    if (visCleanupRef.current) visCleanupRef.current();
    if (ref.current) ref.current.disconnect();
  }, []);

  return <Ctx.Provider value={{ socket, connected, connect, disconnect }}>{children}</Ctx.Provider>;
}

export function useSocket() { return useContext(Ctx); }
