import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

export default function GamePage() {
  const { user } = useAuth();
  const { roundData, phase, bastaInfo, graceLeft, fixedLeft, scoreboard, forceSubmit, pressBasta, submitAnswers, gameState } = useGame();
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const inputRefs = useRef({});
  const answersRef = useRef({});

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => {
    if (phase === 'playing' && roundData) {
      const e = {}; roundData.categories.forEach(c => { e[c] = ''; });
      setAnswers(e); answersRef.current = e; setSubmitted(false);
      setTimeout(() => inputRefs.current[roundData.categories[0]]?.focus(), 800);
    }
  }, [phase, roundData]);
  useEffect(() => { if (forceSubmit && !submitted) { submitAnswers(answersRef.current); setSubmitted(true); } }, [forceSubmit, submitted, submitAnswers]);
  useEffect(() => { if (['collecting','grace','validating'].includes(phase) && !submitted) { submitAnswers(answersRef.current); setSubmitted(true); } }, [phase, submitted, submitAnswers]);

  const handleKeyDown = (e, cat) => { if (e.key === 'Enter') { e.preventDefault(); const i = roundData.categories.indexOf(cat); if (i < roundData.categories.length - 1) inputRefs.current[roundData.categories[i+1]]?.focus(); } };
  const filled = roundData?.categories.filter(c => (answers[c]||'').trim()).length || 0;
  const total = roundData?.categories.length || 0;
  const canBasta = (total - filled) <= 1;

  const handleBasta = useCallback(() => { if (submitted || !canBasta) return; pressBasta(answersRef.current); setSubmitted(true); if (navigator.vibrate) navigator.vibrate(200); }, [submitted, canBasta, pressBasta]);
  const handleSubmit = useCallback(() => { if (submitted) return; submitAnswers(answersRef.current); setSubmitted(true); }, [submitted, submitAnswers]);

  if (!roundData) return null;
  const isPlaying = phase === 'playing', isGrace = phase === 'grace';
  const canType = (isPlaying || isGrace) && !submitted;
  const showBastaBtn = isPlaying && !submitted && !roundData.endMode?.startsWith('fixed_');

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-pink-50 via-white to-purple-50">
      {/* Top */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-purple-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-purple-300 text-sm font-bold font-display">R{roundData.round}/{gameState?.config?.rounds}</span>
            <button onClick={() => setShowBoard(!showBoard)} className="text-purple-400 text-xs bg-purple-50 px-2 py-1 rounded-lg font-bold border border-purple-200">🏆</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="animate-letter-spin bg-pink-400 text-white font-display text-3xl font-bold w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border-b-4 border-pink-500">{roundData.letter}</div>
            {roundData.comboLetter && <div className="animate-letter-spin bg-yellow-300 text-gray-700 font-display text-2xl font-bold w-11 h-11 rounded-2xl flex items-center justify-center shadow-md border-b-4 border-yellow-400" style={{animationDelay:'0.3s'}}>{roundData.comboLetter}</div>}
          </div>
          <div className="text-right min-w-[50px]">
            {isPlaying && fixedLeft > 0 && <span className={`font-display text-xl font-bold ${fixedLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-purple-500'}`}>{fixedLeft}s</span>}
            {isGrace && <span className="font-display text-xl font-bold text-yellow-500 animate-pulse">{graceLeft}s</span>}
            {phase === 'collecting' && <span className="text-yellow-500 text-xs font-bold">⏳</span>}
            {phase === 'validating' && <span className="text-blue-400 text-xs font-bold">🤖</span>}
            {submitted && !['collecting','validating'].includes(phase) && <span className="text-green-400 text-sm font-bold">✓</span>}
          </div>
        </div>
        {bastaInfo && (
          <div className="mt-2 bg-red-50 border-2 border-red-200 rounded-2xl px-3 py-1.5 text-center animate-shake max-w-lg mx-auto">
            <span className="text-red-500 font-bold text-sm">💥 ¡{bastaInfo.playerName} gritó BASTA!{bastaInfo.hadEmpty && ' (-10)'}{graceLeft > 0 && ` · ${graceLeft}s`}</span>
          </div>
        )}
      </div>

      {showBoard && scoreboard?.length > 0 && (
        <div className="px-4 py-2 max-w-lg mx-auto w-full">
          <div className="bg-white rounded-2xl p-3 shadow-md border-2 border-purple-100">
            <div className="flex justify-between mb-2"><span className="text-purple-400 text-xs font-bold">🏆 RANKING</span><button onClick={() => setShowBoard(false)} className="text-purple-300 text-xs">✕</button></div>
            {scoreboard.map((s, i) => (
              <div key={s.id} className={`flex items-center gap-2 py-1 ${String(s.id) === String(user?.id) ? 'text-purple-600 font-bold' : 'text-gray-500'}`}>
                <span className="w-5 text-xs">{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`}</span>
                <span className="flex-1 text-sm truncate">{s.name}</span>
                <span className="font-display text-sm font-bold">{s.totalScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {roundData.comboLetter && (
        <div className="px-4 py-2 max-w-lg mx-auto w-full">
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl px-3 py-2 text-center">
            <span className="text-yellow-600 text-xs font-bold">🔥 COMBO: {roundData.letter} + {roundData.comboLetter} = +10</span>
          </div>
        </div>
      )}

      <div className="flex-1 px-4 pb-36 max-w-lg mx-auto w-full overflow-y-auto">
        <div className="space-y-3 mt-3">
          {roundData.categories.map((cat, idx) => (
            <div key={cat} className="animate-slide-up" style={{animationDelay:`${idx*0.05}s`}}>
              <label className="block text-purple-400 text-xs font-bold mb-1 pl-1 font-display">{cat}</label>
              <input ref={el => { inputRefs.current[cat] = el; }} type="text" value={answers[cat]||''} onChange={e => setAnswers(p => ({...p,[cat]:e.target.value}))}
                onKeyDown={e => handleKeyDown(e,cat)} disabled={!canType} autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck="false"
                className={`input-game ${!canType ? 'opacity-40' : ''} ${(answers[cat]||'').trim() ? 'border-green-300 bg-green-50' : ''}`}
                placeholder={`${cat} con ${roundData.letter}...`} />
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent">
        <div className="max-w-lg mx-auto">
          {showBastaBtn && (
            <button onClick={handleBasta} disabled={!canBasta}
              className={`w-full font-display text-2xl font-bold py-5 rounded-2xl transition-all active:scale-95 border-b-4 shadow-lg ${
                canBasta ? 'bg-red-400 text-white border-red-500 animate-pulse-glow' : 'bg-gray-200 text-gray-400 border-gray-300'
              }`}>
              {(total-filled)===0 ? '💥 ¡BASTA!' : canBasta ? '💥 ¡BASTA! (-10)' : `Rellena ${total-1}+ (${filled}/${total})`}
            </button>
          )}
          {isPlaying && !submitted && roundData.endMode?.startsWith('fixed_') && <button onClick={handleSubmit} className="w-full btn-blue text-lg py-4">✓ Enviar ({filled}/{total})</button>}
          {isGrace && !submitted && <button onClick={handleSubmit} className="w-full btn-yellow text-xl py-4 animate-pulse">⚡ ¡Enviar! ({graceLeft}s)</button>}
          {submitted && !['collecting','validating'].includes(phase) && <p className="text-center text-green-400 font-display text-lg py-4">✓ Esperando...</p>}
          {phase === 'validating' && <p className="text-center text-blue-400 font-display text-lg py-4 animate-pulse">🤖 Validando...</p>}
        </div>
      </div>
    </div>
  );
}
