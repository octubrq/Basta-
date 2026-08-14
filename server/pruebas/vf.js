const { callClaude, extractJSON } = require('../aiValidator');
const db = require('../database');

// Verdadero o Falso: afirmación curiosa, todos votan a la vez.
const VOTE_SECONDS = 15;
const N = 4;

const FALLBACK = [
  { statement: 'Los pulpos tienen tres corazones.', answer: true, explanation: 'Dos bombean sangre a las branquias y uno al resto del cuerpo.' },
  { statement: 'La Gran Muralla China se ve a simple vista desde la Luna.', answer: false, explanation: 'Es demasiado estrecha; no se distingue desde la Luna.' },
  { statement: 'Los flamencos son rosas por lo que comen.', answer: true, explanation: 'Su dieta de crustáceos y algas les da ese color.' },
  { statement: 'En Mercurio un día dura más que un año.', answer: true, explanation: 'Rota tan despacio que su día supera a su órbita alrededor del Sol.' },
  { statement: 'El tomate es una verdura.', answer: false, explanation: 'Botánicamente el tomate es una fruta.' },
  { statement: 'Los tiburones existían antes que los árboles.', answer: true, explanation: 'Los tiburones son más antiguos que los primeros árboles.' },
];

module.exports = {
  id: 'vf',
  name: 'Verdadero o Falso',
  color: '#8B5CF6',
  icon: '⚖️',
  minPlayers: 1,
  instructionsSeconds: 3,
  howToPlay: 'Sale una afirmación curiosa. Vota si es VERDADERA o FALSA. ¡Todos a la vez!',
  howToScore: '10 puntos por acertar, y +5 extra si eres de los tres primeros en votar bien.',
  soloHowToScore: '10 puntos por acertar (+5 por rapidez).',

  async startPlay(ctx) {
    const rt = ctx.m.runtime = { items: [], idx: -1, roundScores: {}, votes: {}, order: [], revealed: false };
    const used = ctx.game.config.avoidRepeats !== false ? db.getUsed('vf') : [];
    const avoid = used.length ? `\nMUY IMPORTANTE: NO repitas ninguna de estas afirmaciones que ya han salido: ${used.slice(0, 30).join(' | ')}. Haz otras claramente distintas.` : '';
    const text = await callClaude(
      `Genera ${N} afirmaciones curiosas de cultura general en español para un juego de Verdadero o Falso familiar. Mezcla verdaderas y falsas; que no sean ni obvias ni imposibles. Añade una explicación breve (una sola frase).${avoid} Devuelve SOLO un array JSON: [{"statement":"...","answer":true,"explanation":"..."}]`,
      1200
    );
    let items = extractJSON(text);
    if (!Array.isArray(items)) items = null;
    items = (items || []).filter(x => x && typeof x.statement === 'string' && typeof x.answer === 'boolean');
    if (items.length < 1) items = [...FALLBACK].sort(() => Math.random() - 0.5).slice(0, N);
    rt.items = items.slice(0, N).map(x => ({ statement: String(x.statement), answer: !!x.answer, explanation: String(x.explanation || '') }));
    db.pushUsed('vf', rt.items.map(x => x.statement));
    ctx.broadcast('round:play', { prueba: 'vf', content: { total: rt.items.length } });
    this.nextItem(ctx);
  },

  nextItem(ctx) {
    const rt = ctx.m.runtime;
    rt.idx++;
    if (rt.idx >= rt.items.length) return this.finishRound(ctx);
    rt.votes = {}; rt.order = []; rt.revealed = false;
    rt.qStart = Date.now();
    const extra = ctx.extraSeconds();
    const it = rt.items[rt.idx];
    ctx.broadcast('step:show', { prueba: 'vf', step: { index: rt.idx, total: rt.items.length, statement: it.statement, seconds: VOTE_SECONDS, extraSeconds: extra } });
    ctx.setTimer(() => this.reveal(ctx), (VOTE_SECONDS + extra) * 1000);
  },

  onEvent(ctx, event, payload, playerId) {
    const rt = ctx.m.runtime;
    if (!rt || event !== 'step:answer' || rt.revealed) return;
    const pid = String(playerId);
    if (rt.votes[pid] !== undefined) return; // ya votó
    // No privilegiados solo dentro del tiempo base; niño/mayor tienen extra
    if (!ctx.isPrivileged(pid) && rt.qStart && (Date.now() - rt.qStart) > VOTE_SECONDS * 1000 + 800) return;
    rt.votes[pid] = (payload === true || payload === 'V' || payload === 'v' || payload === 'true');
    rt.order.push(pid);
    if (ctx.playerIds().every(id => rt.votes[String(id)] !== undefined)) this.reveal(ctx);
  },

  reveal(ctx) {
    const rt = ctx.m.runtime;
    if (rt.revealed) return;
    rt.revealed = true;
    ctx.clearTimers();
    const it = rt.items[rt.idx];
    const first3 = new Set(rt.order.slice(0, 3));
    const results = [];
    for (const id of ctx.playerIds()) {
      const pid = String(id);
      const vote = rt.votes[pid];
      const correct = vote !== undefined && vote === it.answer;
      let points = 0;
      if (correct) { points = 10; if (first3.has(pid)) { points += 5; ctx.recordStat(pid, 'speed'); } }
      if (points > 0) rt.roundScores[pid] = (rt.roundScores[pid] || 0) + points;
      results.push({ id: pid, name: ctx.nameOf(id), vote: vote === undefined ? null : vote, correct, points });
    }
    results.sort((a, b) => b.points - a.points);
    ctx.broadcast('step:reveal', { prueba: 'vf', reveal: { answer: it.answer, explanation: it.explanation, results } });
    ctx.emitLiveStandings(rt.roundScores);
    ctx.setTimer(() => this.nextItem(ctx), 5500);
  },

  finishRound(ctx) {
    ctx.clearTimers();
    ctx.finish({ roundScores: ctx.m.runtime.roundScores || {}, reveal: { type: 'vf', total: ctx.m.runtime.items.length } });
  },

  cleanup(ctx) { ctx.clearTimers(); },
};
