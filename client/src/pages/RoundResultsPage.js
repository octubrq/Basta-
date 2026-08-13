import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

const S = {
  unique: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-500' },
  repeated: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-500' },
  invalid: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-400' },
  empty: { bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-300' },
};

function Arrow({ delta }) {
  if (!delta) return <span className="text-gray-300 text-xs font-bold w-8 text-center">=</span>;
  if (delta > 0) return <span className="text-green-500 text-xs font-bold w-8 text-center">▲{delta}</span>;
  return <span className="text-red-400 text-xs font-bold w-8 text-center">▼{-delta}</span>;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const PODIUM_H = [104, 74, 52];
const PODIUM_BG = ['bg-yellow-50 border-yellow-200', 'bg-gray-100 border-gray-200', 'bg-orange-50 border-orange-200'];

export default function RoundResultsPage() {
  const { user } = useAuth();
  const { roundResult, nextRound, resetMatch } = useGame();
  const [showDetail, setShowDetail] = useState(false);
  if (!roundResult) return null;
  const { prueba, reveal, podium = [], standings = [], roundIndex, totalRounds, isLast, solo } = roundResult;
  const isAdmin = user?.role === 'admin';
  const canAdvance = isAdmin || solo;
  const nameOf = (id) => standings.find(s => String(s.id) === String(id))?.name
    || podium.find(p => String(p.id) === String(id))?.name || '?';

  // Orden visual del podio: 2º, 1º, 3º
  const order = [podium[1], podium[0], podium[2]];
  const rankOf = [1, 0, 2];

  return (
    <div className="min-h-dvh flex flex-col pb-28 bg-gradient-to-b from-yellow-50 via-white to-pink-50">
      <div className="text-center pt-6 pb-2">
        <p className="text-purple-300 text-sm font-bold font-display">Ronda {roundIndex + 1} de {totalRounds}</p>
        <h1 className="font-display text-3xl font-bold text-purple-600">🏆 Podio de la ronda</h1>
      </div>

      <div className="w-full max-w-lg mx-auto px-4 space-y-4">
        {/* Podio */}
        <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-yellow-200">
          <div className="flex items-end justify-center gap-3" style={{ minHeight: 170 }}>
            {order.map((pp, idx) => pp ? (
              <div key={pp.id} className="flex flex-col items-center animate-slide-up" style={{ animationDelay: `${idx * 0.15}s` }}>
                <div className={`rounded-2xl flex items-center justify-center font-display font-bold shadow-sm ${rankOf[idx] === 0 ? 'w-16 h-16 text-2xl bg-yellow-200 text-yellow-700 ring-2 ring-yellow-300' : 'w-12 h-12 text-lg bg-gray-200 text-gray-500'}`}>
                  {pp.name[0].toUpperCase()}
                </div>
                <p className="text-gray-700 text-xs font-bold mt-1 truncate max-w-20">{pp.name}</p>
                <p className="text-purple-500 text-sm font-bold">+{pp.roundScore}</p>
                <div className={`w-20 rounded-t-2xl mt-1 flex items-end justify-center border-2 ${PODIUM_BG[rankOf[idx]]}`} style={{ height: PODIUM_H[rankOf[idx]] }}>
                  <span className="text-3xl mb-2">{MEDAL[rankOf[idx]]}</span>
                </div>
              </div>
            ) : <div key={idx} className="w-20" />)}
          </div>
        </div>

        {/* Tus respuestas (solo Basta) — cada jugador ve las suyas */}
        {reveal?.type === 'basta' && reveal.details?.[String(user?.id)] && (
          <div className="bg-white rounded-3xl p-4 shadow-md border-2 border-pink-200">
            <h3 className="font-display text-pink-500 font-bold mb-3">📝 Tus respuestas (letra {reveal.letter})</h3>
            <div className="space-y-1.5">
              {reveal.categories.map(cat => {
                const d = reveal.details[String(user?.id)][cat];
                if (!d) return null;
                const st = S[d.status] || S.empty;
                const label = d.status === 'unique' ? '✓ Válida' : d.status === 'repeated' ? '≈ Repetida'
                  : d.status === 'invalid' ? '✗ No vale' : '— Vacía';
                return (
                  <div key={cat} className={`flex items-center gap-2 ${st.bg} ${st.border} border-2 rounded-xl px-3 py-2`}>
                    <span className="text-gray-400 text-xs font-bold w-24 truncate">{cat}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-800 font-bold text-sm truncate block">{d.answer || '—'}</span>
                      <span className={`${st.text} text-xs font-bold`}>{label}{d.status === 'invalid' && d.reason ? ` · ${d.reason}` : ''}</span>
                    </div>
                    <span className={`${st.text} font-display font-bold text-lg w-8 text-right`}>{d.total > 0 ? `+${d.total}` : d.total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Clasificación global con flechas */}
        <div className="bg-white rounded-3xl p-4 shadow-md border-2 border-purple-100">
          <h3 className="font-display text-purple-500 font-bold mb-3">📊 Clasificación general</h3>
          {standings.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-1 border-2 ${
              String(s.id) === String(user?.id) ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-100'
            }`}>
              <span className="font-display text-lg font-bold w-7 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
              <span className="text-gray-800 font-bold flex-1 truncate">{s.name}</span>
              <Arrow delta={s.delta} />
              <span className="font-display text-purple-500 font-bold w-10 text-right">{s.totalScore}</span>
            </div>
          ))}
        </div>

        {/* Detalle de la ronda (revelación) */}
        {reveal?.type === 'basta' && (
          <div>
            <button onClick={() => setShowDetail(!showDetail)}
              className="w-full bg-white rounded-2xl p-3 shadow-md border-2 border-purple-100 font-display font-bold text-purple-500 flex items-center justify-between">
              <span>👥 Respuestas de todos</span><span>{showDetail ? '△' : '▽'}</span>
            </button>
            {showDetail && (
              <div className="mt-2 space-y-3">
                {reveal.categories.map(cat => (
                  <div key={cat} className="bg-white rounded-2xl p-3 shadow-sm border-2 border-purple-100">
                    <h4 className="font-display text-purple-500 font-bold text-sm mb-2">{cat}</h4>
                    {Object.entries(reveal.details).filter(([k]) => !k.startsWith('_')).map(([pid, cd]) => {
                      const d = cd[cat]; if (!d) return null; const st = S[d.status] || S.empty;
                      return (
                        <div key={pid} className={`flex items-center gap-2 ${st.bg} ${st.border} border-2 rounded-xl px-3 py-1.5 mb-1`}>
                          <span className="text-gray-500 text-sm font-bold w-20 truncate">{nameOf(pid)}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-gray-800 font-bold text-sm truncate block">{d.answer || '—'}</span>
                            {d.status === 'invalid' && d.reason && <span className="text-red-300 text-xs">{d.reason}</span>}
                          </div>
                          <span className={`${st.text} text-sm font-bold`}>{d.total}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {reveal?.type === 'scramble' && reveal.log?.length > 0 && (
          <div className="bg-white rounded-2xl p-3 shadow-md border-2 border-green-200">
            <h4 className="font-display text-green-500 font-bold text-sm mb-2">📜 Palabras acertadas</h4>
            {reveal.log.map((l, i) => (
              <div key={i} className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-1.5 mb-1 border border-green-200">
                <span className="text-gray-700 font-bold text-sm">{l.word}</span>
                <span className="text-gray-300">→</span>
                <span className="text-green-500 text-sm font-bold">{l.winner}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent">
        <div className="max-w-lg mx-auto space-y-2">
          {canAdvance ? (
            <button onClick={nextRound} className="btn-pink w-full text-xl py-4">
              {isLast ? '🏆 Ver resultado final' : `➡️ Ronda ${roundIndex + 2}`}
            </button>
          ) : <p className="text-purple-300 text-center font-display py-3">⏳ Esperando al admin...</p>}
          {isAdmin && <button onClick={resetMatch} className="w-full text-purple-300 text-sm font-bold py-1">✕ Terminar partida</button>}
        </div>
      </div>
    </div>
  );
}
