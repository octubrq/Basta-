import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

const END_MODES = {
  basta_immediate: '⚡ Ya', basta_5s: '⏱️ +5s', basta_10s: '⏱️ +10s',
  fixed_30: '🕐 30s', fixed_60: '🕐 60s', fixed_90: '🕐 90s', fixed_120: '🕐 120s',
};
const DIFFICULTIES = [
  { key: 'easy', label: '🧸 Niños' }, { key: 'medium', label: '🎮 Normal' },
  { key: 'hard', label: '🔥 Difícil' }, { key: 'extreme', label: '💀 Extremo' },
];

// Resumen legible de la configuración elegida.
function summaryText(pruebas, selected, rounds, order) {
  const names = pruebas.filter(p => selected.includes(p.id)).map(p => p.name);
  if (!names.length) return 'Marca al menos un juego 👆';
  const juegos = names.length <= 2 ? names.join(' y ') : `${names.length} juegos`;
  return `${juegos} · ${rounds} ronda${rounds > 1 ? 's' : ''} · ${order === 'random' ? 'aleatorio' : 'en orden'}`;
}

// Panel de configuración de partida (compartido por admin y jugador solo).
function MatchConfig({ pruebas, selected, setSelected, rounds, setRounds, order, setOrder }) {
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return (
    <div className="bg-white rounded-3xl p-5 shadow-lg border-2 border-purple-300 ring-4 ring-purple-100 space-y-5">
      <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl px-4 py-3 text-center">
        <p className="font-display font-bold text-purple-600">👇 Prepara tu partida antes de empezar</p>
        <p className="text-purple-400 text-sm font-bold">Marca los juegos y elige las rondas</p>
      </div>
      <div>
        <h3 className="font-display font-bold text-purple-600 mb-2">🎲 Juegos ({selected.length} elegido{selected.length === 1 ? '' : 's'})</h3>
        <div className="space-y-2">
          {pruebas.map(p => {
            const on = selected.includes(p.id);
            return (
              <button key={p.id} onClick={() => toggle(p.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all active:scale-95 ${on ? 'shadow-md' : 'opacity-60'}`}
                style={{ background: on ? `${p.color}15` : '#F9FAFB', borderColor: on ? p.color : '#E5E7EB' }}>
                <span className="text-2xl">{p.icon}</span>
                <span className="font-display font-bold flex-1 text-left" style={{ color: on ? p.color : '#9CA3AF' }}>{p.name}</span>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white`} style={{ background: on ? p.color : '#D1D5DB' }}>{on ? '✓' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-purple-500">Número de rondas: {rounds}</label>
        <input type="range" min="1" max="20" value={rounds} onChange={e => setRounds(+e.target.value)} className="w-full accent-purple-500" />
      </div>

      <div>
        <label className="text-sm font-bold text-purple-500 block mb-2">Orden de las pruebas</label>
        <div className="flex gap-2">
          {[['sequential', '🔢 Secuencial'], ['random', '🎰 Aleatorio']].map(([k, v]) => (
            <button key={k} onClick={() => setOrder(k)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${order === k ? 'bg-purple-500 text-white border-purple-600' : 'bg-purple-50 text-purple-400 border-purple-200'}`}>{v}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Parámetros finos de cada prueba (solo admin).
function PruebaParams({ config, updateConfig }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-purple-100 space-y-5">
      <div className="bg-pink-50 rounded-2xl p-4 border border-pink-200">
        <h3 className="font-display font-bold text-pink-600 mb-3">🎯 ¡Basta!</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-bold text-pink-500">Categorías por ronda: {config.categoriesPerRound}</label>
            <input type="range" min="4" max="10" value={config.categoriesPerRound || 6} onChange={e => updateConfig({ categoriesPerRound: +e.target.value })} className="w-full accent-pink-500" />
          </div>
          <div>
            <label className="text-sm font-bold text-pink-500 block mb-2">Modo</label>
            <div className="flex gap-2">
              {['classic', 'combo'].map(m => (
                <button key={m} onClick={() => updateConfig({ mode: m })}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 ${config.mode === m ? 'bg-pink-500 text-white border-pink-600' : 'bg-pink-50 text-pink-400 border-pink-200'}`}>{m === 'classic' ? '📝 Clásico' : '🔥 Combo'}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-pink-500 block mb-2">Fin de ronda</label>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(END_MODES).map(([k, v]) => (
                <button key={k} onClick={() => updateConfig({ endMode: k })}
                  className={`py-1.5 px-1 rounded-xl font-bold text-xs border-2 ${config.endMode === k ? 'bg-pink-500 text-white border-pink-600' : 'bg-pink-50 text-pink-400 border-pink-200'}`}>{v}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
        <h3 className="font-display font-bold text-green-600 mb-3">🔤 Letras Locas</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-bold text-green-500">Minutos por ronda: {config.scrambleMinutes}</label>
            <input type="range" min="1" max="10" value={config.scrambleMinutes || 2} onChange={e => updateConfig({ scrambleMinutes: +e.target.value })} className="w-full accent-green-500" />
          </div>
          <div>
            <label className="text-sm font-bold text-green-500 block mb-2">Dificultad</label>
            <div className="grid grid-cols-4 gap-1.5">
              {DIFFICULTIES.map(d => (
                <button key={d.key} onClick={() => updateConfig({ scrambleDifficulty: d.key })}
                  className={`py-2 px-1 rounded-xl font-bold text-xs border-2 ${config.scrambleDifficulty === d.key ? 'bg-green-500 text-white border-green-600' : 'bg-green-50 text-green-400 border-green-200'}`}>{d.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SoloPasswordSetter({ isSet, setSoloPassword }) {
  const [pw, setPw] = useState('');
  return (
    <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-purple-100">
      <h3 className="font-display font-bold text-purple-600 mb-1">🙋 Contraseña para jugar solo</h3>
      <p className="text-gray-500 text-sm mb-3">{isSet ? '✅ Configurada. Dásela a quien quieras que pueda jugar solo. Puedes cambiarla aquí.' : 'Aún sin configurar. Ponla y compártela con quien quieras.'}</p>
      <div className="flex gap-2">
        <input type="text" value={pw} onChange={e => setPw(e.target.value)} placeholder="Nueva contraseña..." className="input-game flex-1" />
        <button onClick={() => { if (pw.trim().length >= 3) { setSoloPassword(pw.trim()); setPw(''); } }} className="btn-purple px-5">Guardar</button>
      </div>
    </div>
  );
}

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const { gameState, activate, deactivate, updateConfig, startMatch, setSoloPassword } = useGame();
  const [showConfig, setShowConfig] = useState(false);
  const isAdmin = user?.role === 'admin';
  const isSolo = !isAdmin && user?.solo;
  const players = gameState?.players || [];
  const config = gameState?.config || {};
  const pruebas = gameState?.pruebas || [];
  const isActive = gameState?.active;
  const connectedCount = players.filter(p => p.connected && p.role !== 'admin').length;

  // Config de partida local (selección de pruebas / rondas / orden)
  const [selected, setSelected] = useState([]);
  const [rounds, setRounds] = useState(5);
  const [order, setOrder] = useState('sequential');
  useEffect(() => { if (pruebas.length && selected.length === 0) setSelected(pruebas.map(p => p.id)); }, [pruebas]); // eslint-disable-line

  const canStart = selected.length > 0;

  // ===== Jugador normal esperando =====
  if (!isAdmin && !isSolo) {
    return (
      <div className="min-h-dvh p-4 bg-gradient-to-b from-pink-50 via-white to-blue-50">
        <Header user={user} logout={logout} />
        <div className="max-w-lg mx-auto">
          <PlayersCard players={players} />
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white to-transparent">
          <p className="text-purple-300 text-center font-display text-lg animate-float">⏳ Esperando al admin...</p>
        </div>
      </div>
    );
  }

  // ===== Jugador SOLO: su propia config =====
  if (isSolo) {
    return (
      <div className="min-h-dvh p-4 pb-40 bg-gradient-to-b from-yellow-50 via-white to-pink-50">
        <Header user={user} logout={logout} solo />
        <div className="max-w-lg mx-auto space-y-4">
          <MatchConfig pruebas={pruebas} selected={selected} setSelected={setSelected} rounds={rounds} setRounds={setRounds} order={order} setOrder={setOrder} />
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent">
          <div className="max-w-lg mx-auto">
            <p className="text-center text-purple-500 font-bold text-sm mb-2">🎮 {summaryText(pruebas, selected, rounds, order)}</p>
            <button onClick={() => startMatch({ pruebas: selected, rounds, order, solo: true })} disabled={!canStart}
              className="w-full font-display font-bold text-xl py-4 rounded-2xl bg-yellow-400 text-yellow-900 border-b-4 border-yellow-500 active:scale-95 transition-all shadow-lg disabled:opacity-40">
              🚀 ¡Empezar!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== ADMIN =====
  return (
    <div className="min-h-dvh p-4 pb-40 bg-gradient-to-b from-pink-50 via-white to-blue-50">
      <Header user={user} logout={logout} />
      <div className="max-w-lg mx-auto space-y-4">
        {/* Puerta */}
        <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-purple-100 animate-pop">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-purple-700">🚪 Puerta</h2>
              <p className="text-purple-400 text-sm">{isActive ? '✅ Abierta' : '🔒 Cerrada'}</p>
            </div>
            <button onClick={() => isActive ? deactivate() : activate()}
              className={`font-display font-bold py-2 px-5 rounded-2xl border-b-4 active:scale-95 transition-all ${isActive ? 'bg-red-100 text-red-600 border-red-200' : 'bg-green-100 text-green-600 border-green-200'}`}>
              {isActive ? '🔒 Cerrar' : '🔓 Abrir'}
            </button>
          </div>
        </div>

        <PlayersCard players={players} />

        <MatchConfig pruebas={pruebas} selected={selected} setSelected={setSelected} rounds={rounds} setRounds={setRounds} order={order} setOrder={setOrder} />

        <button onClick={() => setShowConfig(!showConfig)}
          className="w-full bg-white rounded-3xl p-4 shadow-md border-2 border-purple-100 text-left flex items-center justify-between">
          <span className="font-display font-bold text-purple-600">⚙️ Ajustes de las pruebas</span>
          <span className="text-purple-300 text-xl">{showConfig ? '△' : '▽'}</span>
        </button>
        {showConfig && <PruebaParams config={config} updateConfig={updateConfig} />}
        {showConfig && <SoloPasswordSetter isSet={gameState?.soloPasswordSet} setSoloPassword={setSoloPassword} />}
      </div>

      {/* Botones de arranque */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent">
        <div className="max-w-lg mx-auto space-y-2">
          <p className="text-center text-purple-500 font-bold text-sm">🎮 {summaryText(pruebas, selected, rounds, order)}</p>
          <button onClick={() => startMatch({ pruebas: selected, rounds, order, solo: false })} disabled={!canStart || !isActive}
            className="w-full font-display font-bold text-xl py-4 rounded-2xl bg-purple-500 text-white border-b-4 border-purple-600 active:scale-95 transition-all shadow-lg disabled:opacity-40">
            🎉 Empezar partida{connectedCount > 0 ? ` (${connectedCount} jugador${connectedCount > 1 ? 'es' : ''})` : ''}
          </button>
          <button onClick={() => startMatch({ pruebas: selected, rounds, order, solo: true })} disabled={!canStart}
            className="w-full font-display font-bold py-3 rounded-2xl bg-yellow-100 text-yellow-700 border-b-4 border-yellow-300 active:scale-95 transition-all">
            🙋 Jugar yo solo
          </button>
          {!isActive && <p className="text-purple-300 text-center text-xs">Abre la puerta para jugar en grupo</p>}
        </div>
      </div>
    </div>
  );
}

function Header({ user, logout, solo }) {
  return (
    <div className="flex items-center justify-between mb-4 max-w-lg mx-auto">
      <div>
        <h1 className="font-display text-3xl font-bold text-purple-600" style={{ textShadow: '2px 2px 0 rgba(168,85,247,0.15)' }}>¡Basta!</h1>
        <p className="text-purple-400 text-sm font-bold">{user?.name} {solo ? '🙋' : user?.role === 'admin' ? '👑' : '🎮'}</p>
      </div>
      <button onClick={logout} className="text-purple-300 hover:text-purple-600 text-sm font-bold bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200">Salir</button>
    </div>
  );
}

function PlayersCard({ players }) {
  const connected = players.filter(p => p.connected);
  return (
    <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-blue-100">
      <h2 className="font-display text-lg font-bold text-blue-600 mb-3">🎮 Jugadores ({connected.length})</h2>
      {connected.length === 0 ? (
        <p className="text-gray-300 text-center py-4 font-display">Esperando jugadores... 💤</p>
      ) : (
        <div className="space-y-2">
          {connected.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl border-2 bg-gray-50 border-gray-100">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-display text-lg font-bold ${p.role === 'admin' ? 'bg-purple-200 text-purple-700' : 'bg-blue-200 text-blue-700'}`}>{p.name[0].toUpperCase()}</div>
              <span className="font-bold text-gray-700 flex-1">{p.name}</span>
              {p.role === 'admin' && <span className="bg-purple-100 text-purple-600 text-xs font-bold px-2 py-0.5 rounded-full">👑</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
