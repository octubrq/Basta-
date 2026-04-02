import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

const S = {
  unique: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-500' },
  repeated: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-500' },
  invalid: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-400' },
  empty: { bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-300' },
};

export default function RoundResultsPage() {
  const { user } = useAuth();
  const { roundResults, nextRound, gameState } = useGame();
  const [view, setView] = useState('byCategory');
  if (!roundResults) return null;
  const isAdmin = user?.role === 'admin';
  const players = gameState?.players || [];
  const { letter, comboLetter, categories, details, standings, bastaPlayer } = roundResults;
  const getName = (id) => players.find(p => String(p.id) === String(id))?.name || '?';
  const totals = {};
  for (const [pid, cd] of Object.entries(details)) { if (pid.startsWith('_')) continue; let t = 0;
    for (const [k, d] of Object.entries(cd)) { if (!k.startsWith('_') && d?.total) t += d.total; }
    if (cd._basta_penalty) t += cd._basta_penalty.penalty; totals[pid] = t; }

  return (
    <div className="min-h-dvh flex flex-col pb-28 bg-gradient-to-b from-pink-50 via-white to-purple-50">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-purple-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-purple-300 text-xs font-bold">Ronda {roundResults.round}</p>
            <div className="flex gap-2 mt-1">
              <span className="bg-pink-400 text-white font-display text-xl font-bold w-9 h-9 rounded-xl flex items-center justify-center border-b-2 border-pink-500">{letter}</span>
              {comboLetter && <span className="bg-yellow-300 text-gray-700 font-display text-lg font-bold w-8 h-8 rounded-xl flex items-center justify-center border-b-2 border-yellow-400">{comboLetter}</span>}
            </div>
          </div>
          <div className="flex bg-purple-50 rounded-2xl p-0.5 border border-purple-200">
            {['byCategory','byPlayer'].map(m => (
              <button key={m} onClick={() => setView(m)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${view === m ? 'bg-purple-400 text-white' : 'text-purple-300'}`}>
                {m === 'byCategory' ? 'Categoría' : 'Jugador'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {bastaPlayer && (
        <div className="px-4 py-2 max-w-2xl mx-auto w-full">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-3 py-2 text-center">
            <span className="text-red-400 text-sm font-bold">💥 ¡{getName(bastaPlayer)} gritó BASTA!{details[String(bastaPlayer)]?._basta_penalty && ` · ${details[String(bastaPlayer)]._basta_penalty.penalty} pts`}</span>
          </div>
        </div>
      )}

      <div className="flex-1 px-4 max-w-2xl mx-auto w-full mt-2 space-y-4">
        {view === 'byCategory' && categories.map((cat, idx) => (
          <div key={cat} className="bg-white rounded-3xl p-4 shadow-md border-2 border-purple-100 animate-pop" style={{animationDelay:`${idx*0.05}s`}}>
            <h3 className="font-display text-purple-500 font-bold text-sm mb-2">{cat}</h3>
            <div className="space-y-1.5">
              {Object.entries(details).filter(([k])=>!k.startsWith('_')).map(([pid, cd]) => {
                const d = cd[cat]; if (!d) return null; const s = S[d.status] || S.empty;
                return (<div key={pid} className={`flex items-center gap-2 ${s.bg} ${s.border} border-2 rounded-xl px-3 py-1.5`}>
                  <span className="text-gray-500 text-sm font-bold w-20 truncate">{getName(pid)}</span>
                  <div className="flex-1 min-w-0"><span className="text-gray-700 font-bold text-sm truncate block">{d.answer||'—'}</span>
                    {d.status==='invalid'&&d.reason&&<span className="text-red-300 text-xs">{d.reason}</span>}</div>
                  {d.combo>0&&<span className="text-yellow-500 text-xs font-bold">+{d.combo}🔥</span>}
                  <span className={`${s.text} text-sm font-bold min-w-[36px] text-right`}>{d.total}</span>
                </div>);
              })}
            </div>
          </div>
        ))}

        {view === 'byPlayer' && Object.entries(details).filter(([k])=>!k.startsWith('_'))
          .sort((a,b)=>(totals[b[0]]||0)-(totals[a[0]]||0)).map(([pid, cd], idx) => (
          <div key={pid} className="bg-white rounded-3xl p-4 shadow-md border-2 border-purple-100 animate-pop" style={{animationDelay:`${idx*0.05}s`}}>
            <div className="flex justify-between mb-2">
              <h3 className="font-display text-gray-700 font-bold">{getName(pid)}</h3>
              <span className="font-display text-xl text-purple-500 font-bold">+{totals[pid]||0}</span>
            </div>
            {categories.map(cat => { const d = cd[cat]; if(!d) return null; const s = S[d.status]||S.empty;
              return (<div key={cat} className={`flex items-center gap-2 ${s.bg} rounded-xl px-3 py-1 mb-1`}>
                <span className="text-gray-400 text-xs w-24 truncate">{cat}</span>
                <span className="text-gray-700 text-sm font-bold flex-1 truncate">{d.answer||'—'}</span>
                {d.combo>0&&<span className="text-yellow-500 text-xs">🔥</span>}
                <span className={`${s.text} text-xs font-bold`}>{d.total}</span>
              </div>);
            })}
          </div>
        ))}

        <div className="bg-white rounded-3xl p-4 shadow-md border-2 border-yellow-200">
          <h3 className="font-display text-purple-500 font-bold mb-3">🏆 Clasificación</h3>
          {standings.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 mb-1 border-2 ${
              String(s.id)===String(user?.id) ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-100'
            }`}>
              <span className="font-display text-lg font-bold w-6 text-center">{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`}</span>
              <span className="text-gray-700 font-bold flex-1">{s.name}</span>
              <span className="font-display text-purple-500 font-bold">{s.totalScore}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white to-transparent">
        <div className="max-w-2xl mx-auto">
          {isAdmin ? <button onClick={nextRound} className="btn-pink w-full text-xl py-4">
            {roundResults.round >= gameState?.config?.rounds ? '🏆 Final' : `➡️ Ronda ${roundResults.round + 1}`}
          </button> : <p className="text-purple-300 text-center font-display py-4">⏳ Esperando...</p>}
        </div>
      </div>
    </div>
  );
}
