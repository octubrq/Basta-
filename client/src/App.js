import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { SocketProvider, useSocket } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';

import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import CountdownPage from './pages/CountdownPage';
import GamePage from './pages/GamePage';
import ScramblePage from './pages/ScramblePage';
import RoundResultsPage from './pages/RoundResultsPage';
import FinalResultsPage from './pages/FinalResultsPage';

function ExitButton() {
  const { user } = useAuth();
  const { phase, resetToLobby } = useGame();
  const { socket } = useSocket();

  // ONLY admin sees the exit button
  if (user?.role !== 'admin') return null;
  if (!['waiting','countdown','playing','grace','collecting','validating','results','finished'].includes(phase)) return null;

  return (
    <button onClick={() => {
      if (window.confirm('¿Salir? Todos los jugadores serán expulsados.')) {
        socket?.disconnect();
        socket?.connect();
        resetToLobby();
        toast.success('Partida cerrada');
      }
    }}
    className="fixed top-3 left-3 z-50 bg-black/30 hover:bg-nintendo-red/80 backdrop-blur-sm text-white/70 hover:text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all border border-white/10">
      ✕ Salir
    </button>
  );
}

function AppRouter() {
  const { user, token, loading } = useAuth();
  const { connect, connected, socket } = useSocket();
  const { phase, sessionType } = useGame();

  useEffect(() => { if (token && !connected) connect(token); }, [token, connected, connect]);
  useEffect(() => {
    if (!socket) return;
    const h = (m) => toast.error(m);
    socket.on('error:message', h);
    return () => socket.off('error:message', h);
  }, [socket]);

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
      <h1 className="font-display text-5xl text-white font-bold animate-pulse">¡Basta!</h1>
    </div>
  );

  if (!user) return <LoginPage />;

  if (!connected && token) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
      <div className="text-center">
        <h1 className="font-display text-4xl text-white font-bold animate-pulse">¡Basta!</h1>
        <p className="text-white/50 mt-2">Conectando...</p>
      </div>
    </div>
  );

  let page;
  switch (phase) {
    case 'countdown': page = <CountdownPage />; break;
    case 'playing': case 'grace': case 'collecting': case 'validating':
      page = sessionType === 'scramble' ? <ScramblePage /> : <GamePage />;
      break;
    case 'results': page = <RoundResultsPage />; break;
    case 'finished': page = <FinalResultsPage />; break;
    case 'waiting': page = <LobbyPage />; break;
    default: page = <LobbyPage />;
  }

  return <><ExitButton />{page}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <GameProvider>
          <Toaster position="top-center" toastOptions={{
            duration: 3000,
            style: { background: '#2D1B69', color: '#FFF8E7', border: '2px solid rgba(255,201,7,0.3)',
              borderRadius: '1rem', fontFamily: 'Nunito', fontWeight: '700' },
          }} />
          <AppRouter />
        </GameProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
