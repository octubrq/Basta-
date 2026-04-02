import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

const END_MODES = {
  basta_immediate: '⚡ Inmediato', basta_5s: '⏱️ +5s', basta_10s: '⏱️ +10s',
  fixed_30: '🕐 30s', fixed_60: '🕐 60s', fixed_90: '🕐 90s', fixed_120: '🕐 120s',
};

const DIFFICULTIES = [
  { key: 'easy', label: '🧸 Niños', desc: '4-6 letras, palabras fáciles', color: 'bg-green-200 text-green-800 border-green-300' },
  { key: 'medium', label: '🎮 Normal', desc: '5-8 letras, variadas', color: 'bg-blue-200 text-blue-800 border-blue-300' },
  { key: 'hard', label: '🔥 Difícil', desc: '7-12 letras, poco comunes', color: 'bg-orange-200 text-orange-800 border-orange-300' },
  { key: 'extreme', label: '💀 Extremo', desc: '9-14 letras, técnicas', color: 'bg-red-200 text-red-800 border-red-300' },
];

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const { gameState, activate, deactivate, updateConfig, startBasta, startScramble, resetGame } = useGame();
  const [showConfig, setShowConfig] = useState(false);
  const isAdmin = user?.role === 'admin';
  const players = gameState?.players || [];
  const config = gameState?.config || {};
  const isActive = gameState?.active;
  const connectedCount = players.filter(p => p.connected).length;

  return (
    <div className="min-h-dvh p-4 pb-32 bg-gradient-to-b from-pink-50 via-white to-blue-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-purple-600" style={{ textShadow: '2px 2px 0 rgba(168,85,247,0.15)' }}>¡Basta!</h1>
          <p className="text-purple-400 text-sm font-bold">{user?.name} {isAdmin ? '👑' : '🎮'}</p>
        </div>
        <button onClick={logout} className="text-purple-300 hover:text-purple-600 text-sm font-bold bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200">Salir</button>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        {/* Gate (admin) */}
        {isAdmin && (
          <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-purple-100 animate-pop">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-purple-700">🚪 Puerta</h2>
                <p className="text-purple-400 text-sm">{isActive ? '✅ Abierta' : '🔒 Cerrada'}</p>
              </div>
              <button onClick={() => isActive ? deactivate() : activate()}
                className={`font-display font-bold py-2 px-5 rounded-2xl border-b-4 active:scale-95 transition-all ${
                  isActive ? 'bg-red-100 text-red-600 border-red-200' : 'bg-green-100 text-green-600 border-green-200'
                }`}>
                {isActive ? '🔒 Cerrar' : '🔓 Abrir'}
              </button>
            </div>
          </div>
        )}

        {/* Players */}
        <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-blue-100 animate-slide-up">
          <h2 className="font-display text-lg font-bold text-blue-600 mb-3">🎮 Jugadores ({connectedCount})</h2>
          {players.length === 0 ? (
            <p className="text-gray-300 text-center py-4 font-display">Esperando jugadores... 💤</p>
          ) : (
            <div className="space-y-2">
              {players.filter(p => p.connected).map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${
                  i === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'
                }`}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-display text-lg font-bold shadow-sm ${
                    p.role === 'admin' ? 'bg-purple-200 text-purple-700' : 'bg-blue-200 text-blue-700'
                  }`}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <span className="font-bold text-gray-700 flex-1">{p.name}</span>
                  {p.role === 'admin' && <span className="bg-purple-100 text-purple-600 text-xs font-bold px-2 py-0.5 rounded-full">👑</span>}
                  {p.totalScore > 0 && <span className="font-display text-purple-500 font-bold">{p.totalScore}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Config (admin) */}
        {isAdmin && (
          <>
            <button onClick={() => setShowConfig(!showConfig)}
              className="w-full bg-white rounded-3xl p-4 shadow-md border-2 border-purple-100 text-left flex items-center justify-between animate-slide-up">
              <span className="font-display font-bold text-purple-600">⚙️ Configuración</span>
              <span className="text-purple-300 text-xl">{showConfig ? '△' : '▽'}</span>
            </button>

            {showConfig && (
              <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-purple-100 space-y-5 animate-slide-up">
                {/* Basta config */}
                <div className="bg-pink-50 rounded-2xl p-4 border border-pink-200">
                  <h3 className="font-display font-bold text-pink-600 mb-3">🎯 ¡Basta!</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-bold text-pink-500">Rondas: {config.rounds}</label>
                      <input type="range" min="3" max="15" value={config.rounds || 5}
                        onChange={e => updateConfig({ rounds: +e.target.value })} className="w-full accent-pink-500" />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-pink-500">Categorías: {config.categoriesPerRound}</label>
                      <input type="range" min="4" max="10" value={config.categoriesPerRound || 6}
                        onChange={e => updateConfig({ categoriesPerRound: +e.target.value })} className="w-full accent-pink-500" />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-pink-500 block mb-2">Modo</label>
                      <div className="flex gap-2">
                        {['classic', 'combo'].map(m => (
                          <button key={m} onClick={() => updateConfig({ mode: m })}
                            className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 transition-all ${
                              config.mode === m ? 'bg-pink-500 text-white border-pink-600' : 'bg-pink-50 text-pink-400 border-pink-200'
                            }`}>
                            {m === 'classic' ? '📝 Clásico' : '🔥 Combo'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-pink-500 block mb-2">Fin de ronda</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(END_MODES).map(([k, v]) => (
                          <button key={k} onClick={() => updateConfig({ endMode: k })}
                            className={`py-1.5 px-2 rounded-xl font-bold text-xs border-2 transition-all ${
                              config.endMode === k ? 'bg-pink-500 text-white border-pink-600' : 'bg-pink-50 text-pink-400 border-pink-200'
                            }`}>{v}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scramble config */}
                <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
                  <h3 className="font-display font-bold text-green-600 mb-3">🔤 Letras Locas</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-bold text-green-500">Minutos: {config.scrambleMinutes}</label>
                      <input type="range" min="1" max="10" value={config.scrambleMinutes || 2}
                        onChange={e => updateConfig({ scrambleMinutes: +e.target.value })} className="w-full accent-green-500" />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-green-500 block mb-2">Dificultad</label>
                      <div className="grid grid-cols-2 gap-2">
                        {DIFFICULTIES.map(d => (
                          <button key={d.key} onClick={() => updateConfig({ scrambleDifficulty: d.key })}
                            className={`py-2.5 px-3 rounded-2xl font-bold text-sm border-2 transition-all text-left ${
                              config.scrambleDifficulty === d.key
                                ? d.color + ' shadow-md scale-105'
                                : 'bg-gray-50 text-gray-400 border-gray-200'
                            }`}>
                            <div>{d.label}</div>
                            <div className="text-xs opacity-70 font-normal mt-0.5">{d.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Start buttons (admin) */}
      {isAdmin && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent">
          <div className="max-w-lg mx-auto space-y-2">
            <div className="flex gap-2">
              <button onClick={startBasta} disabled={connectedCount < 2}
                className="flex-1 font-display font-bold text-lg py-4 rounded-2xl bg-pink-400 text-white border-b-4 border-pink-500 active:scale-95 transition-all shadow-lg disabled:opacity-40">
                🎯 ¡Basta!
              </button>
              <button onClick={startScramble} disabled={connectedCount < 2}
                className="flex-1 font-display font-bold text-lg py-4 rounded-2xl bg-green-400 text-white border-b-4 border-green-500 active:scale-95 transition-all shadow-lg disabled:opacity-40">
                🔤 Letras Locas
              </button>
            </div>
            {connectedCount < 2 && <p className="text-purple-300 text-center text-sm">Mínimo 2 jugadores</p>}
            <button onClick={resetGame} className="w-full text-purple-300 text-sm font-bold py-2">🔄 Resetear puntos</button>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white to-transparent">
          <p className="text-purple-300 text-center font-display text-lg animate-float">⏳ Esperando al admin...</p>
        </div>
      )}
    </div>
  );
}
