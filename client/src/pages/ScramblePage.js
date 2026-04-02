import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

export default function ScramblePage() {
  const { user } = useAuth();
  const { scrambleData, scrambleTimeLeft, scrambleCorrect, scoreboard, submitScramble } = useGame();
  const [guess, setGuess] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setGuess(''); setTimeout(() => inputRef.current?.focus(), 300); }, [scrambleData?.scrambled]);
  useEffect(() => { if (scrambleCorrect) setGuess(''); }, [scrambleCorrect]);

  const handleSubmit = (e) => { e.preventDefault(); if (!guess.trim()) return; submitScramble(guess.trim()); setGuess(''); inputRef.current?.focus(); };
  const minutes = Math.floor(scrambleTimeLeft / 60);
  const seconds = scrambleTimeLeft % 60;
  const isLow = scrambleTimeLeft <= 30;

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-green-50 via-white to-blue-50">
      {/* Top */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-green-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h2 className="font-display text-xl font-bold text-green-500">🔤 Letras Locas</h2>
          <div className={`font-display text-2xl font-bold ${isLow ? 'text-red-400 animate-pulse' : 'text-green-600'}`}>
            ⏱️ {minutes}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Scoreboard bar */}
      <div className="px-4 py-2 max-w-lg mx-auto w-full">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {scoreboard.map((s, i) => (
            <div key={s.id} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border-2 ${
              String(s.id) === String(user?.id) ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}>
              <span>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</span>
              <span className="truncate max-w-[80px]">{s.name}</span>
              <span className="font-display">{s.totalScore}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {scrambleData && (
          <div className="mb-8">
            <p className="text-green-400 text-sm font-bold text-center mb-4 font-display">Palabra #{scrambleData.wordNumber}</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {(scrambleData.scrambled || '').split('').map((letter, i) => (
                <div key={`${scrambleData.scrambled}-${i}`}
                  className="w-12 h-14 bg-white rounded-2xl flex items-center justify-center font-display text-2xl font-bold text-purple-600 shadow-md border-2 border-purple-200 border-b-4 animate-pop"
                  style={{ animationDelay: `${i * 0.05}s` }}>
                  {letter}
                </div>
              ))}
            </div>
          </div>
        )}

        {scrambleCorrect && (
          <div className="mb-6 animate-bounce-in">
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl px-6 py-3 text-center">
              <p className="text-green-600 font-display text-xl font-bold">✅ ¡{scrambleCorrect.playerName}!</p>
              <p className="text-green-500 text-sm font-bold">{scrambleCorrect.word} → +10 pts</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="flex gap-2">
            <input ref={inputRef} type="text" value={guess} onChange={e => setGuess(e.target.value.toUpperCase())}
              autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck="false"
              className="flex-1 bg-white border-2 border-green-300 rounded-2xl px-4 py-4 text-gray-700 font-display text-xl font-bold text-center focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 shadow-md"
              placeholder="ESCRIBE..." />
            <button type="submit" className="btn-green text-xl px-6">→</button>
          </div>
        </form>
      </div>
    </div>
  );
}
