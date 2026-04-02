import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

export default function CountdownPage() {
  const { user } = useAuth();
  const { countdown, scoreboard, sessionType } = useGame();
  const bg = sessionType === 'scramble' ? 'from-green-50 via-white to-green-50' : 'from-pink-50 via-white to-purple-50';

  return (
    <div className={`min-h-dvh flex flex-col items-center justify-center p-4 bg-gradient-to-b ${bg}`}>
      {scoreboard.length > 0 && (
        <div className="w-full max-w-sm mb-8 animate-slide-up">
          <h3 className="font-display text-purple-400 font-bold text-center mb-3 text-lg">🏆 Ranking</h3>
          <div className="space-y-1.5">
            {scoreboard.map((s, i) => (
              <div key={s.id} className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 border-2 ${
                String(s.id) === String(user?.id) ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-100'
              }`}>
                <span className="font-display text-lg font-bold w-6 text-center text-purple-300">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`}
                </span>
                <span className="text-gray-700 font-bold flex-1">{s.name}</span>
                <span className="font-display text-purple-500 font-bold">{s.totalScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {countdown && (
        <div key={countdown} className="animate-countdown-pop">
          <span className="font-display font-bold text-purple-400" style={{ fontSize: '12rem', textShadow: '0 0 60px rgba(168,85,247,0.3)' }}>
            {countdown}
          </span>
        </div>
      )}

      {!countdown && (
        <div className="animate-bounce-in text-center">
          <span className="font-display text-5xl font-bold text-purple-500" style={{ textShadow: '2px 2px 0 rgba(168,85,247,0.15)' }}>
            {sessionType === 'scramble' ? '🔤 ¡Vamos!' : '🎯 ¡Basta!'}
          </span>
        </div>
      )}
    </div>
  );
}
