import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { sfx } from '../sound';

export default function MasOMenosPage() {
  const { user } = useAuth();
  const { gameState, stepData, stepReveal, submitStep, scoreboard, adminPaused, adminPauseToggle, skipRound } = useGame();
  const isAdmin = user?.role === 'admin';
  const myProfile = gameState?.players?.find(p => String(p.id) === String(user?.id))?.profile;
  const myPrivileged = myProfile === 'nino' || myProfile === 'mayor';
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const inputRef = useRef(null);
  const step = stepData?.step;

  // Nueva pregunta → reiniciar (con segundos extra si tengo ventaja)
  useEffect(() => {
    if (!step) return;
    const extra = myPrivileged ? (step.extraSeconds || 0) : 0;
    setValue(''); setSubmitted(false); setTimeLeft((step.seconds || 20) + extra);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [step?.index]); // eslint-disable-line

  // Cuenta atrás (se congela en pausa o al revelar)
  useEffect(() => {
    if (!step || stepReveal || adminPaused || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(t => (t <= 1 ? 0 : t - 1)), 1000);
    return () => clearInterval(id);
  }, [step?.index, stepReveal, adminPaused, timeLeft > 0]); // eslint-disable-line

  const send = (e) => {
    e?.preventDefault();
    if (submitted || value.trim() === '') return;
    submitStep(value.trim()); setSubmitted(true);
  };

  const reveal = stepReveal?.reveal;
  useEffect(() => {
    if (!reveal) return;
    const mine = reveal.results?.find(r => r.name === user?.name);
    if (mine && mine.points > 0) sfx.correct(); else sfx.pop();
  }, [reveal]); // eslint-disable-line

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-blue-50 via-white to-purple-50">
      {adminPaused && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
          <p className="font-display text-6xl font-bold text-white animate-pop">⏸️</p>
          <p className="font-display text-3xl font-bold text-white mt-2">Pausa</p>
          {isAdmin && <button onClick={adminPauseToggle} className="mt-6 btn-green text-xl px-8 py-3">▶️ Reanudar</button>}
        </div>
      )}

      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-blue-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h2 className="font-display text-xl font-bold text-blue-500">📊 Más o menos</h2>
          <div className="flex items-center gap-2">
            {step && <span className="text-blue-300 font-bold text-sm font-display">{step.index + 1}/{step.total}</span>}
            {isAdmin && <button onClick={adminPauseToggle} className="text-xs bg-orange-50 text-orange-500 px-2 py-1 rounded-lg font-bold border border-orange-200">{adminPaused ? '▶️' : '⏸️'}</button>}
            {isAdmin && <button onClick={skipRound} className="text-xs bg-gray-50 text-gray-400 px-2 py-1 rounded-lg font-bold border border-gray-200">⏭️</button>}
            {!reveal && <span className={`font-display text-2xl font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-blue-600'}`}>{timeLeft}s</span>}
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

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">
        {step && (
          <div className="w-full max-w-md text-center">
            <p className="font-display text-2xl font-bold text-gray-800 leading-snug mb-6">{step.q}</p>

            {!reveal ? (
              <form onSubmit={send} className="space-y-3">
                <input ref={inputRef} type="text" inputMode="decimal" value={value}
                  onChange={e => setValue(e.target.value)} disabled={submitted}
                  className="w-full bg-white border-2 border-blue-300 rounded-2xl px-4 py-4 text-gray-800 font-display text-3xl font-bold text-center focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 shadow-md disabled:opacity-50"
                  placeholder={step.unit ? `nº en ${step.unit}` : 'tu número'} />
                {!submitted
                  ? <button type="submit" className="btn-blue w-full text-xl py-4">✓ Enviar mi número</button>
                  : <p className="text-green-500 font-display text-lg py-3">✓ Enviado, esperando...</p>}
              </form>
            ) : (
              <div className="animate-bounce-in">
                <div className="bg-blue-50 border-2 border-blue-300 rounded-3xl px-6 py-4 mb-4">
                  <p className="text-blue-400 font-bold text-sm">La respuesta era</p>
                  <p className="font-display text-4xl font-bold text-blue-600">{reveal.answer.toLocaleString('es-ES')} {reveal.unit}</p>
                </div>
                <div className="space-y-1.5 text-left">
                  {reveal.results.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 border-2 ${r.points > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                      <span className="w-6 text-center font-bold">{i === 0 && r.diff != null ? '🥇' : i === 1 && r.diff != null ? '🥈' : i === 2 && r.diff != null ? '🥉' : ''}</span>
                      <span className="text-gray-700 font-bold flex-1 truncate">{r.name}</span>
                      <span className="text-gray-500 text-sm">{r.value == null ? '—' : r.value.toLocaleString('es-ES')}</span>
                      <span className="text-gray-400 text-xs w-16 text-right">{r.diff == null ? '' : `±${r.diff.toLocaleString('es-ES')}`}</span>
                      <span className={`font-display font-bold w-10 text-right ${r.points > 0 ? 'text-green-500' : 'text-gray-300'}`}>{r.points > 0 ? `+${r.points}` : '0'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!step && <p className="text-blue-300 font-display text-lg animate-pulse">Preparando preguntas...</p>}
      </div>
    </div>
  );
}
