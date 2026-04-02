import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const Ctx = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const ref = useRef(null);

  const connect = useCallback((token) => {
    if (ref.current) ref.current.disconnect();

    const serverUrl = process.env.REACT_APP_SERVER_URL || window.location.origin;
    const s = io(serverUrl, {
      auth: { token }, transports: ['websocket', 'polling'],
      reconnection: true, reconnectionAttempts: 50, reconnectionDelay: 2000,
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

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
    if (ref.current) { ref.current.disconnect(); ref.current = null; setSocket(null); setConnected(false); }
  }, []);

  useEffect(() => () => { if (ref.current) ref.current.disconnect(); }, []);

  return <Ctx.Provider value={{ socket, connected, connect, disconnect }}>{children}</Ctx.Provider>;
}

export function useSocket() { return useContext(Ctx); }
