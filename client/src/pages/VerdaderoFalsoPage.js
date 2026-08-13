import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

export default function VerdaderoFalsoPage() {
  const { user } = useAuth();
  const { stepData, stepReveal, submitStep, scoreboard, adminPaused, adminPauseToggle, skipRound } = useGame();
  const isAdmin = user?.role === 'admin';
  const [voted, setVoted] = useState(null); // true | false | null
  const [timeLeft, setTimeLeft] = useState(0);
  const step = stepData?.step;
  const reveal = stepReveal?.reveal;

  useEffect(() => {
    if (!step) return;
    setVoted(null); setTimeLeft(step.seconds || 15);
  }, [step?.index]); // eslint-disable-line

  useEffect(() => {
    if (!step || reveal || adminPaused || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(t => (t <= 1 ? 0 : t - 1)), 1000);
    return () => clearInterval(id);
  }, [step?.index, reveal, adminPaused, timeLeft > 0]); // eslint-disable-line

  const vote = (v) => { if (voted !== null || reveal) return; setVoted(v); submitStep(v); };
  const myResult = reveal?.results?.find(r => String(r.id) === String(user?.id));

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-purple-50 via-white to-blue-50">
      {adminPaused && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
          <p className="font-display text-6xl font-bold text-white animate-pop">⏸️</p>
          <p className="font-display text-3xl font-bold text-white mt-2">Pausa</p>
          {isAdmin && <button onClick={adminPauseToggle} className="mt-6 btn-green text-xl px-8 py-3">▶️ Reanudar</button>}
        </div>
      )}

      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-purple-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h2 className="font-display text-xl font-bold text-purple-500">⚖️ Verdadero o Falso</h2>
          <div className="flex items-center gap-2">
            {step && <span className="text-purple-300 font-bold text-sm font-display">{step.index + 1}/{step.total}</span>}
            {isAdmin && <button onClick={adminPauseToggle} className="text-xs bg-orange-50 text-orange-500 px-2 py-1 rounded-lg font-bold border border-orange-200">{adminPaused ? '▶️' : '⏸️'}</button>}
            {isAdmin && <button onClick={skipRound} className="text-xs bg-gray-50 text-gray-400 px-2 py-1 rounded-lg font-bold border border-gray-200">⏭️</button>}
            {!reveal && <span className={`font-display text-2xl font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-purple-600'}`}>{timeLeft}s</span>}
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

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6 max-w-lg mx-auto w-full">
        {step && (
          <>
            <div className="bg-white rounded-3xl px-6 py-6 shadow-md border-2 border-purple-200 mb-6 w-full">
              <p className="font-display text-2xl font-bold text-gray-800 text-center leading-snug">{step.statement}</p>
            </div>

            {!reveal ? (
              <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={() => vote(true)} disabled={voted !== null}
                  className={`font-display text-2xl font-bold py-8 rounded-3xl border-b-4 active:scale-95 transition-all ${
                    voted === true ? 'bg-green-500 text-white border-green-600 ring-4 ring-green-200' : voted === null ? 'bg-green-100 text-green-600 border-green-300' : 'bg-gray-100 text-gray-300 border-gray-200'
                  }`}>✔️ Verdadero</button>
                <button onClick={() => vote(false)} disabled={voted !== null}
                  className={`font-display text-2xl font-bold py-8 rounded-3xl border-b-4 active:scale-95 transition-all ${
                    voted === false ? 'bg-red-500 text-white border-red-600 ring-4 ring-red-200' : voted === null ? 'bg-red-100 text-red-500 border-red-300' : 'bg-gray-100 text-gray-300 border-gray-200'
                  }`}>❌ Falso</button>
              </div>
            ) : (
              <div className="w-full animate-bounce-in">
                <div className={`rounded-3xl px-6 py-4 text-center border-2 mb-3 ${reveal.answer ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                  <p className="font-display text-3xl font-bold" style={{ color: reveal.answer ? '#16A34A' : '#DC2626' }}>
                    {reveal.answer ? '✔️ VERDADERO' : '❌ FALSO'}
                  </p>
                  <p className="text-gray-700 font-bold mt-2 leading-snug">{reveal.explanation}</p>
                </div>
                {myResult && (
                  <p className={`text-center font-display text-lg font-bold ${myResult.correct ? 'text-green-500' : 'text-red-400'}`}>
                    {myResult.vote === null ? 'No votaste' : myResult.correct ? `¡Acertaste! +${myResult.points}` : 'Fallaste 🙈'}
                  </p>
                )}
              </div>
            )}
            {!reveal && voted !== null && <p className="text-purple-400 font-display mt-4">✓ Voto registrado, esperando...</p>}
          </>
        )}
        {!step && <p className="text-purple-300 font-display text-lg animate-pulse">Preparando afirmaciones...</p>}
      </div>
    </div>
  );
}
