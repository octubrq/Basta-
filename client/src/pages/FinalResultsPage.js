import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { profileIcon } from '../profiles';

export default function FinalResultsPage() {
  const { user } = useAuth();
  const { finalResult, resetToLobby, resetMatch } = useGame();
  const standings = finalResult?.standings || [];
  const solo = finalResult?.solo;
  const record = finalResult?.record;
  const winner = standings[0];
  const isWinner = winner && String(winner.id) === String(user?.id);
  const myPos = standings.findIndex(s => String(s.id) === String(user?.id)) + 1;
  const isAdmin = user?.role === 'admin';

  const goHome = () => { resetMatch(); resetToLobby(); };

  return (
    <div className="min-h-dvh flex flex-col items-center pb-28 bg-gradient-to-b from-yellow-50 via-white to-pink-50">
      <div className="w-full text-center pt-8 pb-4">
        <p className="text-purple-300 font-body text-sm">Fin de la partida</p>
        <h1 className="font-display text-5xl font-bold mt-2 animate-bounce-in"
          style={{ color: isWinner || solo ? '#F59E0B' : '#EC4899', textShadow: '2px 2px 0 rgba(0,0,0,0.05)' }}>
          {solo ? '🎉 ¡Terminado!' : isWinner ? '🎉 ¡Victoria!' : '🏁 ¡Fin!'}
        </h1>
        {solo && winner && <p className="text-purple-500 font-display text-2xl font-bold mt-2">{winner.totalScore} puntos</p>}
        {solo && record && (record.isNew
          ? <p className="font-display text-xl font-bold text-yellow-500 mt-2 animate-bounce-in">🏆 ¡Nuevo récord!{record.previous > 0 ? ` (antes ${record.previous})` : ''}</p>
          : <p className="text-gray-400 font-bold mt-2">Tu récord sigue en {record.best} pts</p>)}
        {!solo && myPos > 0 && <p className="text-purple-400 font-body mt-2">Posición #{myPos}</p>}
      </div>

      <div className="w-full max-w-lg px-4 space-y-4">
        {!solo && (
          <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-yellow-200">
            <div className="flex items-end justify-center gap-3 h-48 mb-2">
              {standings[1] && (
                <div className="flex flex-col items-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
                  <div className="w-12 h-12 rounded-2xl bg-gray-200 flex items-center justify-center font-display text-lg font-bold text-gray-500">{standings[1].name[0]}</div>
                  <p className="text-gray-600 text-xs font-bold mt-1 truncate max-w-16">{standings[1].name}</p>
                  <p className="text-gray-400 text-xs">{standings[1].totalScore}</p>
                  <div className="w-20 bg-gray-100 rounded-t-2xl mt-2 flex items-end justify-center border-2 border-gray-200" style={{ height: 70 }}><span className="text-3xl mb-2">🥈</span></div>
                </div>
              )}
              {standings[0] && (
                <div className="flex flex-col items-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
                  <div className="w-16 h-16 rounded-2xl bg-yellow-200 flex items-center justify-center font-display text-2xl font-bold text-yellow-700 ring-2 ring-yellow-300">{standings[0].name[0]}</div>
                  <p className="text-gray-700 text-sm font-bold mt-1 truncate max-w-20">{standings[0].name}</p>
                  <p className="text-yellow-500 text-sm font-bold">{standings[0].totalScore}</p>
                  <div className="w-20 bg-yellow-50 rounded-t-2xl mt-2 flex items-end justify-center border-2 border-yellow-200" style={{ height: 100 }}><span className="text-4xl mb-2">🥇</span></div>
                </div>
              )}
              {standings[2] && (
                <div className="flex flex-col items-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
                  <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center font-display text-base font-bold text-orange-500">{standings[2].name[0]}</div>
                  <p className="text-gray-600 text-xs font-bold mt-1 truncate max-w-16">{standings[2].name}</p>
                  <p className="text-orange-400 text-xs">{standings[2].totalScore}</p>
                  <div className="w-20 bg-orange-50 rounded-t-2xl mt-2 flex items-end justify-center border-2 border-orange-200" style={{ height: 50 }}><span className="text-2xl mb-2">🥉</span></div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl p-4 shadow-md border-2 border-purple-100">
          <h3 className="font-display text-purple-500 font-bold mb-3">🏆 {solo ? 'Tu resultado' : 'Ranking Final'}</h3>
          {standings.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1 border-2 ${
              String(s.id) === String(user?.id) ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-100'
            }`}>
              <span className="font-display text-lg font-bold w-8 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
              <span className="text-gray-800 font-bold flex-1">{s.name} {profileIcon(s.profile)}</span>
              <span className="font-display text-purple-500 font-bold text-lg">{s.totalScore}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white to-transparent">
        <div className="max-w-lg mx-auto">
          <button onClick={goHome} className="btn-purple w-full text-lg py-4">🏠 Volver al inicio</button>
        </div>
      </div>
    </div>
  );
}
