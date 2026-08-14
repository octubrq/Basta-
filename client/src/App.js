import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { SocketProvider, useSocket } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';
import { useWakeLock } from './useWakeLock';

import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import InstructionsPage from './pages/InstructionsPage';
import GamePage from './pages/GamePage';
import ScramblePage from './pages/ScramblePage';
import MasOMenosPage from './pages/MasOMenosPage';
import PistasPage from './pages/PistasPage';
import VerdaderoFalsoPage from './pages/VerdaderoFalsoPage';
import CadenaPage from './pages/CadenaPage';
import RoundResultsPage from './pages/RoundResultsPage';
import FinalResultsPage from './pages/FinalResultsPage';

// Página de juego según la prueba activa.
const PLAY_PAGES = { basta: GamePage, scramble: ScramblePage, masomenos: MasOMenosPage, pistas: PistasPage, vf: VerdaderoFalsoPage, cadena: CadenaPage };

function ExitButton() {
  const { user } = useAuth();
  const { phase, resetMatch, resetToLobby } = useGame();

  // ONLY admin sees the exit button
  if (user?.role !== 'admin') return null;
  if (!['waiting','instructions','playing','grace','collecting','validating','result','finished'].includes(phase)) return null;

  return (
    <button onClick={() => {
      if (window.confirm('¿Terminar la partida y volver al inicio?')) {
        resetMatch();     // el servidor cierra la partida y avisa a todos
        resetToLobby();   // y este cliente vuelve ya al inicio
        toast.success('Partida terminada');
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
  const { phase, currentPrueba } = useGame();

  // Mantener la pantalla encendida durante la partida (fallo silencioso en iOS).
  useWakeLock(['instructions', 'playing', 'grace', 'collecting', 'validating'].includes(phase));

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
    case 'instructions': page = <InstructionsPage />; break;
    case 'playing': case 'grace': case 'collecting': case 'validating': {
      const PlayPage = PLAY_PAGES[currentPrueba] || GamePage;
      page = <PlayPage />;
      break;
    }
    case 'result': page = <RoundResultsPage />; break;
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
