import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
const API = process.env.REACT_APP_API_URL || (window.location.origin + '/api');

export default function LoginPage() {
  const { adminLogin, adminRegister, playerJoin, playerSolo } = useAuth();
  const [mode, setMode] = useState('player'); // player | solo | admin
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [soloEnabled, setSoloEnabled] = useState(false);

  const refreshStatus = () => fetch(`${API}/status`).then(r => r.json())
    .then(d => { setGameActive(d.active); setSoloEnabled(d.soloEnabled); }).catch(() => {});
  useEffect(() => { refreshStatus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (mode === 'admin') await adminLogin(name, password);
      else if (mode === 'solo') await playerSolo(name, password);
      else await playerJoin(name);
    } catch (err) {
      if (mode === 'admin' && err.message.includes('incorrectas')) {
        try { await adminRegister(name, password); } catch (e2) { setError(e2.message); }
      } else setError(err.message);
    } finally { setLoading(false); }
  };

  const tabs = [
    { k: 'player', label: '🎮 Jugar', color: 'bg-blue-400' },
    ...(soloEnabled ? [{ k: 'solo', label: '🙋 Solo', color: 'bg-yellow-400' }] : []),
    { k: 'admin', label: '👑 Admin', color: 'bg-purple-400' },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-pink-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-bounce-in">
          <h1 className="font-display text-7xl font-bold text-purple-500" style={{ textShadow: '3px 3px 0 rgba(236,72,153,0.2)' }}>¡Basta!</h1>
          <p className="text-purple-300 font-body mt-2 text-lg">🎮 ¡El juego de categorías! 🎮</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-purple-100 animate-slide-up">
          <div className="flex mb-6 bg-purple-50 rounded-2xl p-1 gap-1">
            {tabs.map(t => (
              <button key={t.k} onClick={() => { setMode(t.k); setError(''); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === t.k ? `${t.color} text-white shadow-md` : 'text-purple-300'}`}>{t.label}</button>
            ))}
          </div>

          {mode === 'player' && !gameActive && (
            <div className="text-center py-6">
              <p className="text-6xl mb-3">😴</p>
              <p className="text-purple-400 font-bold">El juego no está activo</p>
              {soloEnabled && <p className="text-gray-400 text-sm mt-1">¿Quieres jugar tú solo? Usa la pestaña 🙋</p>}
              <button onClick={refreshStatus} className="mt-4 btn-blue text-sm">🔄 Comprobar</button>
            </div>
          )}

          {(mode === 'admin' || mode === 'solo' || (mode === 'player' && gameActive)) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-purple-500 text-sm font-bold mb-1">
                  {mode === 'admin' ? '👑 Usuario admin' : '🎮 Tu nombre'}
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-game" placeholder={mode === 'admin' ? 'Admin...' : 'Tu nombre...'} maxLength={20} required />
              </div>
              {(mode === 'admin' || mode === 'solo') && (
                <div>
                  <label className="block text-purple-500 text-sm font-bold mb-1">🔒 {mode === 'solo' ? 'Contraseña de solo' : 'Contraseña'}</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-game" placeholder="••••••" minLength={3} required />
                </div>
              )}
              {error && <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 text-red-500 text-sm font-bold text-center animate-shake">{error}</div>}
              <button type="submit" disabled={loading} className={`w-full text-xl py-4 ${mode === 'admin' ? 'btn-purple' : mode === 'solo' ? 'btn-yellow' : 'btn-blue'}`}>
                {loading ? '⏳...' : mode === 'admin' ? '👑 Entrar' : mode === 'solo' ? '🙋 Jugar solo' : '🚀 ¡Jugar!'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
