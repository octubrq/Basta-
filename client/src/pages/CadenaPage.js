import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

const REASON = { tiempo: 'se quedó sin tiempo', repetido: 'repitió', 'no vale': 'no valía', letras: 'no encadenó' };

export default function CadenaPage() {
  const { user } = useAuth();
  const { stepData, submitStep, adminPaused, adminPauseToggle, skipRound } = useGame();
  const isAdmin = user?.role === 'admin';
  const [word, setWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const inputRef = useRef(null);
  const step = stepData?.step;

  const myTurn = step && String(step.currentPlayerId) === String(user?.id);

  useEffect(() => {
    if (!step) return;
    setWord(''); setTimeLeft(step.seconds || 5);
    if (myTurn) setTimeout(() => inputRef.current?.focus(), 150);
  }, [step?.turn]); // eslint-disable-line

  useEffect(() => {
    if (!step || adminPaused || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(t => (t <= 1 ? 0 : t - 1)), 1000);
    return () => clearInterval(id);
  }, [step?.turn, adminPaused, timeLeft > 0]); // eslint-disable-line

  const send = (e) => { e?.preventDefault(); if (!word.trim() || !myTurn) return; submitStep(word.trim()); setWord(''); };

  const note = step?.note;

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-red-50 via-white to-orange-50">
      {adminPaused && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
          <p className="font-display text-6xl font-bold text-white animate-pop">⏸️</p>
          <p className="font-display text-3xl font-bold text-white mt-2">Pausa</p>
          {isAdmin && <button onClick={adminPauseToggle} className="mt-6 btn-green text-xl px-8 py-3">▶️ Reanudar</button>}
        </div>
      )}

      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-red-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h2 className="font-display text-xl font-bold text-red-500">🔗 En cadena</h2>
          <div className="flex items-center gap-2">
            {isAdmin && <button onClick={adminPauseToggle} className="text-xs bg-orange-50 text-orange-500 px-2 py-1 rounded-lg font-bold border border-orange-200">{adminPaused ? '▶️' : '⏸️'}</button>}
            {isAdmin && <button onClick={skipRound} className="text-xs bg-gray-50 text-gray-400 px-2 py-1 rounded-lg font-bold border border-gray-200">⏭️</button>}
            <span className={`font-display text-2xl font-bold ${timeLeft <= 2 ? 'text-red-500 animate-pulse' : 'text-red-600'}`}>{timeLeft}s</span>
          </div>
        </div>
      </div>

      {step && (
        <div className="flex-1 flex flex-col px-4 pb-6 max-w-lg mx-auto w-full">
          <div className="text-center my-3">
            <p className="text-red-400 font-bold text-sm font-display">Categoría</p>
            <p className="font-display text-3xl font-bold text-red-600">{step.category}</p>
          </div>

          {/* Jugadores vivos (multi) o racha (solo) */}
          {step.solo ? (
            <p className="text-center font-display text-lg font-bold text-red-500 mb-2">Racha: {step.streak} 🔥</p>
          ) : (
            <div className="flex gap-2 flex-wrap justify-center mb-3">
              {step.alive.map(p => (
                <span key={p.id} className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${String(p.id) === String(step.currentPlayerId) ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-white text-red-500 border-red-200'}`}>{p.name}</span>
              ))}
              {step.eliminated.map(p => (
                <span key={p.id} className="px-3 py-1 rounded-full text-sm font-bold border-2 bg-gray-100 text-gray-300 border-gray-200 line-through">{p.name}</span>
              ))}
            </div>
          )}

          {/* Aviso de la última jugada */}
          {note?.type === 'eliminated' && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-3 py-2 text-center mb-2 animate-shake">
              <span className="text-red-500 font-bold text-sm">❌ {note.playerName} eliminado — {REASON[note.reason] || note.reason}{note.word ? ` ("${note.word}")` : ''}</span>
            </div>
          )}
          {note?.type === 'combo' && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl px-3 py-2 text-center mb-2 animate-pop">
              <span className="text-yellow-600 font-bold text-sm">🔥 ¡Combo de {note.playerName}! "{note.word}" +5</span>
            </div>
          )}

          {/* Debe empezar por... */}
          {step.link && (
            <p className="text-center mb-2 font-display font-bold text-red-500">
              Debe empezar por <span className="bg-red-500 text-white rounded-lg px-2 py-0.5">{step.link.letters}</span>
            </p>
          )}

          {/* Turno */}
          <div className="text-center mb-3">
            {myTurn
              ? <p className="font-display text-xl font-bold text-red-600 animate-pop">¡Tu turno! 👉</p>
              : !step.solo && <p className="font-display text-lg font-bold text-gray-500">Turno de {step.currentPlayerName}</p>}
          </div>

          {myTurn && (
            <form onSubmit={send} className="mb-4">
              <div className="flex gap-2">
                <input ref={inputRef} type="text" value={word} onChange={e => setWord(e.target.value)}
                  autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false"
                  className="flex-1 bg-white border-2 border-red-300 rounded-2xl px-4 py-4 text-gray-800 font-display text-xl font-bold text-center focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 shadow-md"
                  placeholder={`${step.category}...`} />
                <button type="submit" className="btn-red text-xl px-6">→</button>
              </div>
            </form>
          )}

          {/* Lista de lo dicho */}
          <div className="flex-1 overflow-y-auto">
            <p className="text-red-300 font-bold text-xs font-display mb-1">Ya dicho ({step.said.length})</p>
            <div className="flex gap-2 flex-wrap">
              {step.said.map((s, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-xl text-sm font-bold border-2 text-gray-700 ${s.combo ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-red-100'}`}>
                  {s.combo && '🔥'}{s.word} <span className="text-red-300 text-xs">· {s.by}</span>
                </span>
              ))}
              {step.said.length === 0 && <span className="text-gray-300 font-display">Aún nada. ¡Empieza!</span>}
            </div>
          </div>
        </div>
      )}
      {!step && <p className="text-red-300 font-display text-lg animate-pulse text-center mt-10">Preparando la categoría...</p>}
    </div>
  );
}
