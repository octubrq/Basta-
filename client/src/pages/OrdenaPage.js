import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

// Lista reordenable con el dedo (pointer events → funciona en móvil).
function Reorderable({ order, setOrder, onCommit, disabled }) {
  const [dragIdx, setDragIdx] = useState(null);
  const refs = useRef([]);

  const onPointerDown = (e, idx) => {
    if (disabled) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    setDragIdx(idx);
  };
  const onPointerMove = (e) => {
    if (dragIdx === null) return;
    const y = e.clientY;
    let target = dragIdx;
    for (let i = 0; i < refs.current.length; i++) {
      const el = refs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) { target = i; break; }
      if (y < r.top) { target = i; break; }
      target = i;
    }
    if (target !== dragIdx) {
      const next = [...order];
      const [m] = next.splice(dragIdx, 1);
      next.splice(target, 0, m);
      setOrder(next);
      setDragIdx(target);
    }
  };
  const onPointerUp = () => {
    if (dragIdx !== null) { setDragIdx(null); onCommit?.(); }
  };

  return (
    <div className="space-y-2 select-none" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      {order.map((label, i) => (
        <div key={label} ref={el => { refs.current[i] = el; }}
          onPointerDown={(e) => onPointerDown(e, i)}
          style={{ touchAction: 'none' }}
          className={`flex items-center gap-3 rounded-2xl px-4 py-4 border-2 shadow-sm transition-transform ${
            dragIdx === i ? 'bg-teal-100 border-teal-400 scale-[1.03] shadow-lg' : 'bg-white border-teal-200'
          } ${disabled ? 'opacity-70' : 'cursor-grab active:cursor-grabbing'}`}>
          <span className="font-display text-teal-400 font-bold w-6 text-center">{i + 1}</span>
          <span className="font-bold text-gray-800 flex-1">{label}</span>
          {!disabled && <span className="text-teal-300 text-xl">⋮⋮</span>}
        </div>
      ))}
    </div>
  );
}

export default function OrdenaPage() {
  const { user } = useAuth();
  const { stepData, stepReveal, submitStep, scoreboard, adminPaused, adminPauseToggle, skipRound } = useGame();
  const isAdmin = user?.role === 'admin';
  const [order, setOrder] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const step = stepData?.step;
  const reveal = stepReveal?.reveal;

  useEffect(() => {
    if (!step) return;
    setOrder(step.items || []);
    setTimeLeft(step.seconds || 30);
    submitStep(step.items || []); // el orden inicial cuenta si no tocas nada
  }, [step?.index]); // eslint-disable-line

  useEffect(() => {
    if (!step || reveal || adminPaused || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(t => (t <= 1 ? 0 : t - 1)), 1000);
    return () => clearInterval(id);
  }, [step?.index, reveal, adminPaused, timeLeft > 0]); // eslint-disable-line

  const commit = () => submitStep(order);
  const myResult = reveal?.results?.find(r => String(r.id) === String(user?.id));
  const correct = reveal?.correct || [];

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-teal-50 via-white to-cyan-50">
      {adminPaused && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
          <p className="font-display text-6xl font-bold text-white animate-pop">⏸️</p>
          <p className="font-display text-3xl font-bold text-white mt-2">Pausa</p>
          {isAdmin && <button onClick={adminPauseToggle} className="mt-6 btn-green text-xl px-8 py-3">▶️ Reanudar</button>}
        </div>
      )}

      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-teal-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h2 className="font-display text-xl font-bold text-teal-500">↕️ Ordena</h2>
          <div className="flex items-center gap-2">
            {step && <span className="text-teal-300 font-bold text-sm font-display">{step.index + 1}/{step.total}</span>}
            {isAdmin && <button onClick={adminPauseToggle} className="text-xs bg-orange-50 text-orange-500 px-2 py-1 rounded-lg font-bold border border-orange-200">{adminPaused ? '▶️' : '⏸️'}</button>}
            {isAdmin && <button onClick={skipRound} className="text-xs bg-gray-50 text-gray-400 px-2 py-1 rounded-lg font-bold border border-gray-200">⏭️</button>}
            {!reveal && <span className={`font-display text-2xl font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-teal-600'}`}>{timeLeft}s</span>}
          </div>
        </div>
      </div>

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

      <div className="flex-1 px-4 pb-6 max-w-lg mx-auto w-full">
        {step && (
          <>
            <p className="font-display text-xl font-bold text-gray-800 text-center my-4">{step.prompt}</p>

            {!reveal ? (
              <>
                <Reorderable order={order} setOrder={setOrder} onCommit={commit} disabled={false} />
                <p className="text-teal-400 text-sm text-center mt-3 font-bold">Arrastra ⋮⋮ para reordenar. Se guarda solo.</p>
              </>
            ) : (
              <div className="animate-bounce-in">
                <p className="text-center font-display font-bold text-teal-600 mb-2">Orden correcto:</p>
                <div className="space-y-2">
                  {correct.map((label, i) => {
                    const mine = myResult?.order;
                    const gotIt = mine && mine[i] === label;
                    return (
                      <div key={label} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border-2 ${gotIt ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-200'}`}>
                        <span className="font-display font-bold w-6 text-center text-gray-400">{i + 1}</span>
                        <span className="font-bold text-gray-800 flex-1">{label}</span>
                        <span>{gotIt ? '✅' : '❌'}</span>
                      </div>
                    );
                  })}
                </div>
                {myResult && (
                  <p className="text-center font-display text-lg font-bold text-teal-500 mt-3">
                    {myResult.correctCount} en su sitio · +{myResult.points}
                  </p>
                )}
              </div>
            )}
          </>
        )}
        {!step && <p className="text-teal-300 font-display text-lg animate-pulse text-center mt-10">Preparando listas...</p>}
      </div>
    </div>
  );
}
