import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

export default function PistasPage() {
  const { user } = useAuth();
  const { stepData, stepReveal, submitStep, scoreboard, adminPaused, adminPauseToggle, skipRound } = useGame();
  const isAdmin = user?.role === 'admin';
  const [guess, setGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const inputRef = useRef(null);
  const step = stepData?.step;
  const reveal = stepReveal?.reveal;

  // Reiniciar cuenta atrás cuando cambia la incógnita o sale una pista nueva
  useEffect(() => {
    if (!step) return;
    setTimeLeft(step.seconds || 15);
    setGuess('');
    setTimeout(() => inputRef.current?.focus(), 200);
  }, [step?.index, step?.clueNum]); // eslint-disable-line

  useEffect(() => {
    if (!step || reveal || adminPaused || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(t => (t <= 1 ? 0 : t - 1)), 1000);
    return () => clearInterval(id);
  }, [step?.index, step?.clueNum, reveal, adminPaused, timeLeft > 0]); // eslint-disable-line

  const send = (e) => {
    e?.preventDefault();
    if (!guess.trim() || reveal) return;
    submitStep(guess.trim());
    setGuess('');
    inputRef.current?.focus();
  };

  const solvedByMe = reveal?.solvedById && String(reveal.solvedById) === String(user?.id);

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-amber-50 via-white to-orange-50">
      {adminPaused && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
          <p className="font-display text-6xl font-bold text-white animate-pop">⏸️</p>
          <p className="font-display text-3xl font-bold text-white mt-2">Pausa</p>
          {isAdmin && <button onClick={adminPauseToggle} className="mt-6 btn-green text-xl px-8 py-3">▶️ Reanudar</button>}
        </div>
      )}

      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-amber-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h2 className="font-display text-xl font-bold text-amber-500">🔍 Pistas</h2>
          <div className="flex items-center gap-2">
            {step && <span className="text-amber-300 font-bold text-sm font-display">{step.index + 1}/{step.total}</span>}
            {isAdmin && <button onClick={adminPauseToggle} className="text-xs bg-orange-50 text-orange-500 px-2 py-1 rounded-lg font-bold border border-orange-200">{adminPaused ? '▶️' : '⏸️'}</button>}
            {isAdmin && <button onClick={skipRound} className="text-xs bg-gray-50 text-gray-400 px-2 py-1 rounded-lg font-bold border border-gray-200">⏭️</button>}
            {!reveal && <span className={`font-display text-2xl font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-amber-600'}`}>{timeLeft}s</span>}
          </div>
        </div>
      </div>

      {/* Marcador */}
      <div className="px-4 py-2 max-w-lg mx-auto w-full">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {scoreboard.map((s, i) => (
            <div key={s.id} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border-2 ${
              String(s.id) === String(user?.id) ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}>
              <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
              <span className="truncate max-w-[80px]">{s.name}</span>
              <span className="font-display">{s.totalScore}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-6 max-w-lg mx-auto w-full">
        {step && (
          <>
            <p className="text-center text-amber-400 font-bold text-sm mt-2 font-display">
              Pista {step.clueNum} de {step.totalClues} · vale {[20, 15, 10, 5][step.clueNum - 1]} pts
            </p>
            <div className="space-y-2 mt-3 flex-1">
              {step.clues.map((c, i) => (
                <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm border-2 border-amber-200 animate-slide-up">
                  <span className="text-amber-400 font-display font-bold mr-2">{i + 1}.</span>
                  <span className="text-gray-800 font-bold">{c}</span>
                </div>
              ))}
            </div>

            {reveal ? (
              <div className="animate-bounce-in mt-3">
                <div className={`rounded-3xl px-6 py-4 text-center border-2 ${reveal.solvedBy ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-200'}`}>
                  {reveal.solvedBy
                    ? <p className="font-display text-xl font-bold text-green-600">{solvedByMe ? '¡Acertaste!' : `✅ ¡${reveal.solvedBy}!`} +{reveal.points}</p>
                    : <p className="font-display text-xl font-bold text-red-400">Nadie acertó 🙈</p>}
                  <p className="text-gray-700 font-bold mt-1">Era: <span className="text-amber-600 font-display text-lg">{reveal.answer}</span></p>
                </div>
              </div>
            ) : (
              <form onSubmit={send} className="mt-3">
                <div className="flex gap-2">
                  <input ref={inputRef} type="text" value={guess} onChange={e => setGuess(e.target.value)}
                    autoComplete="off" autoCorrect="off" spellCheck="false"
                    className="flex-1 bg-white border-2 border-amber-300 rounded-2xl px-4 py-4 text-gray-800 font-display text-xl font-bold text-center focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 shadow-md"
                    placeholder="¿Qué es?" />
                  <button type="submit" className="btn-yellow text-xl px-6">→</button>
                </div>
              </form>
            )}
          </>
        )}
        {!step && <p className="text-amber-300 font-display text-lg animate-pulse text-center mt-10">Preparando incógnitas...</p>}
      </div>
    </div>
  );
}
