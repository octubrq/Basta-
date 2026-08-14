const { callClaude } = require('../aiValidator');
const { normalize } = require('../validator');

// Categoría en cadena: por turnos, sin repetir. Quien falla/repite/no llega a
// tiempo queda eliminado. Gana el último en pie. En solo, cuenta la racha.
const TURN_SECONDS = 5;
const SOLO_POINTS_PER = 3;
const SOLO_CAP = 25;

const FALLBACK_CATS = [
  'Frutas', 'Animales', 'Países', 'Colores', 'Partes del cuerpo', 'Deportes',
  'Profesiones', 'Instrumentos musicales', 'Verduras', 'Marcas de coche',
  'Cosas de la cocina', 'Nombres de persona', 'Ríos', 'Prendas de ropa',
];

// Valida (con IA, tolerante) que la respuesta pertenece a la categoría.
async function isValidMember(category, answer) {
  const txt = await callClaude(
    `En un juego de nombrar cosas por categorías: ¿"${answer}" es un ejemplo válido y real de la categoría "${category}"? Usa criterio normal, acepta ejemplos claros. Responde SOLO con SI o NO.`,
    5
  );
  if (txt === null) return true; // sin IA disponible: aceptar (tolerante)
  return /s[ií]/i.test(txt.trim().slice(0, 4));
}

module.exports = {
  id: 'cadena',
  name: 'Categoría en cadena',
  color: '#EF4444',
  icon: '🔗',
  minPlayers: 1,
  instructionsSeconds: 8,
  howToPlay: 'Sale una categoría y vais diciendo ejemplos por turnos, sin repetir. 5 segundos por turno. Quien falla, repite o no llega a tiempo queda eliminado. ¡Gana el último en pie!',
  howToScore: '20 puntos el último en pie, 10 el penúltimo.',
  soloHowToScore: 'Aguanta todo lo que puedas: 3 puntos por cada acierto seguido.',

  async startPlay(ctx) {
    const players = ctx.playerIds();
    const category = await this.pickCategory();
    const rt = ctx.m.runtime = {
      category, said: [], saidNorm: new Set(),
      aliveOrder: [...players], currentIdx: 0, eliminated: [],
      roundScores: {}, turnSeq: 0, busy: false,
      solo: ctx.solo || players.length <= 1, streak: 0, note: { type: 'start' },
    };
    ctx.broadcast('round:play', { prueba: 'cadena', content: { category } });
    this.startTurn(ctx);
  },

  async pickCategory() {
    const txt = await callClaude(
      'Dame UNA categoría sencilla y divertida para un juego de nombrar cosas en cadena, en español (como "Frutas", "Países", "Animales"). Debe tener muchísimos ejemplos posibles. Responde SOLO con el nombre de la categoría, sin nada más.',
      20
    );
    if (txt) {
      const c = txt.trim().replace(/^["'.\s]+|["'.\s]+$/g, '').split('\n')[0];
      if (c && c.length <= 40) return c;
    }
    return FALLBACK_CATS[Math.floor(Math.random() * FALLBACK_CATS.length)];
  },

  startTurn(ctx) {
    const rt = ctx.m.runtime;
    rt.busy = false;
    rt.turnSeq++;
    const seq = rt.turnSeq;
    const pid = rt.aliveOrder[rt.currentIdx];
    this.emitState(ctx, pid);
    ctx.clearTimers();
    ctx.setTimer(() => { if (rt.turnSeq === seq && !rt.busy) this.fail(ctx, pid, 'tiempo'); }, TURN_SECONDS * 1000);
  },

  emitState(ctx, currentPid) {
    const rt = ctx.m.runtime;
    ctx.broadcast('step:show', {
      prueba: 'cadena',
      step: {
        turn: rt.turnSeq, category: rt.category, said: rt.said,
        currentPlayerId: currentPid, currentPlayerName: ctx.nameOf(currentPid),
        alive: rt.aliveOrder.map(id => ({ id, name: ctx.nameOf(id) })),
        eliminated: rt.eliminated, seconds: TURN_SECONDS,
        solo: rt.solo, streak: rt.streak, note: rt.note,
      },
    });
  },

  async onEvent(ctx, event, payload, playerId) {
    const rt = ctx.m.runtime;
    if (!rt || event !== 'step:answer' || rt.busy) return;
    const pid = String(playerId);
    const currentPid = String(rt.aliveOrder[rt.currentIdx]);
    if (pid !== currentPid) return; // no es su turno
    const word = String(payload || '').trim();
    if (!word) return;
    rt.busy = true;
    ctx.clearTimers();
    const n = normalize(word);
    if (!n) { rt.busy = false; this.startTurn(ctx); return; }
    if (rt.saidNorm.has(n)) return this.fail(ctx, pid, 'repetido', word);

    const valid = await isValidMember(rt.category, word);
    if (String(rt.aliveOrder[rt.currentIdx]) !== currentPid) return; // cambió el estado mientras validábamos
    if (!valid) return this.fail(ctx, pid, 'no vale', word);

    rt.said.push({ word, by: ctx.nameOf(pid) });
    rt.saidNorm.add(n);
    rt.note = { type: 'accepted', playerName: ctx.nameOf(pid), word };
    if (rt.solo) {
      rt.streak++;
      if (rt.streak >= SOLO_CAP) return this.finishSolo(ctx);
      rt.busy = false; this.startTurn(ctx); return; // mismo jugador
    }
    rt.currentIdx = (rt.currentIdx + 1) % rt.aliveOrder.length;
    rt.busy = false; this.startTurn(ctx);
  },

  fail(ctx, pid, reason, word) {
    const rt = ctx.m.runtime;
    ctx.clearTimers();
    if (rt.solo) { rt.note = { type: 'fail', playerName: ctx.nameOf(pid), reason, word }; return this.finishSolo(ctx); }
    const idx = rt.aliveOrder.indexOf(String(pid));
    if (idx === -1) { rt.busy = false; return; }
    rt.eliminated.push({ id: String(pid), name: ctx.nameOf(pid), reason });
    rt.aliveOrder.splice(idx, 1);
    if (idx < rt.currentIdx) rt.currentIdx--;
    if (rt.currentIdx >= rt.aliveOrder.length) rt.currentIdx = 0;
    rt.note = { type: 'eliminated', playerName: ctx.nameOf(pid), reason, word };

    if (rt.aliveOrder.length <= 1) {
      const winner = rt.aliveOrder[0];
      if (winner) rt.roundScores[String(winner)] = (rt.roundScores[String(winner)] || 0) + 20;
      rt.roundScores[String(pid)] = (rt.roundScores[String(pid)] || 0) + 10; // penúltimo
      return this.finishRound(ctx, winner);
    }
    rt.busy = false; this.startTurn(ctx);
  },

  finishSolo(ctx) {
    const rt = ctx.m.runtime;
    const pid = rt.aliveOrder[0];
    const pts = rt.streak * SOLO_POINTS_PER;
    if (pid && pts > 0) rt.roundScores[String(pid)] = pts;
    ctx.clearTimers();
    ctx.finish({ roundScores: rt.roundScores, reveal: { type: 'cadena', solo: true, category: rt.category, said: rt.said, streak: rt.streak } });
  },

  finishRound(ctx, winner) {
    const rt = ctx.m.runtime;
    ctx.clearTimers();
    ctx.finish({ roundScores: rt.roundScores, reveal: { type: 'cadena', category: rt.category, said: rt.said, winnerName: winner ? ctx.nameOf(winner) : null, eliminated: rt.eliminated } });
  },

  cleanup(ctx) { ctx.clearTimers(); },
};
