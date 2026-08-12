import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

export default function InstructionsPage() {
  const { user } = useAuth();
  const { instr, pauseToggle, skipRound } = useGame();
  if (!instr) return null;
  const isAdmin = user?.role === 'admin';
  const p = instr.prueba;
  const color = p.color || '#8B5CF6';
  const paused = (instr.pausedBy || []).length > 0;
  const scoreText = instr.solo ? (p.soloHowToScore || p.howToScore) : p.howToScore;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4"
      style={{ background: `linear-gradient(180deg, ${color}18, #ffffff 55%, ${color}10)` }}>
      <div className="w-full max-w-lg">
        <p className="text-center font-display font-bold text-lg mb-2" style={{ color }}>
          Ronda {instr.roundIndex + 1} de {instr.totalRounds}
        </p>

        <div className="bg-white rounded-3xl p-6 shadow-lg border-4 animate-pop" style={{ borderColor: color }}>
          <div className="text-center">
            <div className="text-6xl mb-2 animate-bounce-in">{p.icon}</div>
            <h1 className="font-display text-4xl font-bold mb-1" style={{ color }}>{p.name}</h1>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl p-4" style={{ background: `${color}12` }}>
              <p className="font-display font-bold text-sm mb-1" style={{ color }}>🎮 Cómo se juega</p>
              <p className="text-gray-800 font-bold leading-snug">{p.howToPlay}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: `${color}12` }}>
              <p className="font-display font-bold text-sm mb-1" style={{ color }}>⭐ Puntos</p>
              <p className="text-gray-800 font-bold leading-snug">{scoreText}</p>
            </div>
          </div>

          {/* Cuenta atrás */}
          <div className="mt-6 text-center">
            {paused ? (
              <div className="animate-pop">
                <p className="font-display text-3xl font-bold text-orange-500">⏸️ EN PAUSA</p>
                <p className="text-gray-600 font-bold mt-1">Esperando a: {instr.pausedBy.join(', ')}</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-400 font-bold text-sm">Empieza en</p>
                <p key={instr.remaining} className="font-display font-bold animate-countdown-pop leading-none"
                  style={{ fontSize: '5rem', color }}>
                  {instr.remaining ?? '…'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="mt-4 space-y-2">
          <button onClick={pauseToggle}
            className={`w-full font-display text-xl font-bold py-4 rounded-2xl border-b-4 active:scale-95 transition-all shadow-md ${
              paused ? 'bg-green-400 text-white border-green-500' : 'bg-orange-300 text-orange-900 border-orange-400'
            }`}>
            {paused ? '▶️ Quitar pausa' : '⏸️ PAUSA (tengo una duda)'}
          </button>
          {isAdmin && (
            <button onClick={skipRound}
              className="w-full font-display font-bold py-3 rounded-2xl bg-white text-gray-500 border-2 border-gray-200 active:scale-95 transition-all">
              ⏭️ Saltar esta prueba
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
