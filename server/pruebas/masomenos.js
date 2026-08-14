const { callClaude, extractJSON } = require('../aiValidator');
const db = require('../database');

// Más o menos: preguntas con respuesta numérica. Gana quien más se acerca.
// Una sola llamada a la IA por ronda devuelve TODAS las preguntas.
const QUESTION_SECONDS = 20;
const N_QUESTIONS = 4;

const FALLBACK = [
  { q: '¿Cuántos huesos tiene el cuerpo humano adulto?', answer: 206, unit: 'huesos' },
  { q: '¿Cuántos kilómetros tiene el río Nilo?', answer: 6650, unit: 'km' },
  { q: '¿Cuánto pesa un oso polar macho adulto?', answer: 450, unit: 'kg' },
  { q: '¿Cuántos países hay en el continente africano?', answer: 54, unit: 'países' },
  { q: '¿A cuántos km está la Luna de la Tierra (media)?', answer: 384400, unit: 'km' },
  { q: '¿Cuántos dientes tiene un adulto?', answer: 32, unit: 'dientes' },
  { q: '¿Cuántos metros mide la Torre Eiffel?', answer: 330, unit: 'm' },
  { q: '¿En qué año llegó el hombre a la Luna?', answer: 1969, unit: 'año' },
];

module.exports = {
  id: 'masomenos',
  name: 'Más o menos',
  color: '#3B82F6',
  icon: '📊',
  minPlayers: 1,
  instructionsSeconds: 3,
  howToPlay: 'Cada pregunta tiene una respuesta que es un número. Escribe tu número y gana quien más se acerque.',
  howToScore: '20 puntos el más cercano, 15 el segundo y 10 el tercero. En cada pregunta.',
  soloHowToScore: 'Puntos según lo cerca que te quedes de la respuesta real.',

  async startPlay(ctx) {
    const rt = ctx.m.runtime = { questions: [], qIndex: -1, answers: {}, roundScores: {}, qRevealed: -2 };
    const used = db.getUsed('masomenos');
    const avoid = used.length ? `\nMUY IMPORTANTE: NO repitas ninguna de estas preguntas que ya han salido: ${used.slice(0, 35).join(' | ')}. Haz preguntas claramente distintas.` : '';
    const text = await callClaude(
      `Genera ${N_QUESTIONS} preguntas de cultura general para un juego familiar en español, cada una con una respuesta que sea un NÚMERO objetivo y verificable (distancias, pesos, alturas, cantidades, años...). Variadas y curiosas, ni demasiado fáciles ni imposibles. La respuesta debe ser un número entero razonable, SIN separadores de miles.${avoid} Devuelve SOLO un array JSON: [{"q":"¿...?","answer":123,"unit":"km"}]`,
      800
    );
    let qs = extractJSON(text);
    if (!Array.isArray(qs)) qs = null;
    qs = (qs || []).filter(x => x && typeof x.answer === 'number' && isFinite(x.answer) && typeof x.q === 'string');
    if (qs.length < 2) qs = [...FALLBACK].sort(() => Math.random() - 0.5).slice(0, N_QUESTIONS);
    rt.questions = qs.slice(0, N_QUESTIONS);
    db.pushUsed('masomenos', rt.questions.map(q => q.q));
    ctx.broadcast('round:play', { prueba: 'masomenos', content: { total: rt.questions.length } });
    this.nextQuestion(ctx);
  },

  nextQuestion(ctx) {
    const rt = ctx.m.runtime;
    rt.qIndex++;
    if (rt.qIndex >= rt.questions.length) return this.finishRound(ctx);
    rt.answers = {};
    rt.qStart = Date.now();
    const extra = ctx.extraSeconds();
    const q = rt.questions[rt.qIndex];
    ctx.broadcast('step:show', {
      prueba: 'masomenos',
      step: { index: rt.qIndex, total: rt.questions.length, q: q.q, unit: q.unit || '', seconds: QUESTION_SECONDS, extraSeconds: extra },
    });
    ctx.setTimer(() => this.reveal(ctx), (QUESTION_SECONDS + extra) * 1000);
  },

  onEvent(ctx, event, payload, playerId) {
    const rt = ctx.m.runtime;
    if (!rt || event !== 'step:answer') return;
    if (rt.qIndex < 0 || rt.qRevealed === rt.qIndex) return;
    // Los no privilegiados solo pueden responder dentro del tiempo base; los de
    // ventaja (niño/mayor) tienen sus segundos extra.
    if (!ctx.isPrivileged(playerId) && rt.qStart && (Date.now() - rt.qStart) > QUESTION_SECONDS * 1000 + 800) return;
    const num = parseFloat(String(payload).replace(',', '.').replace(/[^0-9.\-]/g, ''));
    if (isNaN(num)) return;
    rt.answers[String(playerId)] = num;
    if (ctx.playerIds().every(id => rt.answers[String(id)] !== undefined)) this.reveal(ctx);
  },

  reveal(ctx) {
    const rt = ctx.m.runtime;
    if (rt.qRevealed === rt.qIndex) return;
    rt.qRevealed = rt.qIndex;
    ctx.clearTimers();
    const q = rt.questions[rt.qIndex];

    const entries = ctx.playerIds().map(id => {
      const v = rt.answers[String(id)];
      return { id: String(id), name: ctx.nameOf(id), value: v, diff: v === undefined ? Infinity : Math.abs(v - q.answer) };
    });
    const ranked = entries.filter(e => e.diff !== Infinity).sort((a, b) => a.diff - b.diff);
    if (!ctx.solo) { if (ranked[0]) ctx.recordStat(ranked[0].id, 'speed'); if (ranked[1]) ctx.recordStat(ranked[1].id, 'closeMiss'); }

    const stepScores = {};
    if (ctx.solo) {
      const e = ranked[0];
      if (e) {
        const rel = q.answer !== 0 ? Math.min(1, e.diff / Math.abs(q.answer)) : (e.diff === 0 ? 0 : 1);
        stepScores[e.id] = Math.round((1 - rel) * 20);
      }
    } else {
      const pts = [20, 15, 10];
      ranked.forEach((e, i) => { if (i < pts.length) stepScores[e.id] = pts[i]; });
    }
    for (const [pid, p] of Object.entries(stepScores)) rt.roundScores[pid] = (rt.roundScores[pid] || 0) + p;

    const results = entries
      .map(e => ({ name: e.name, value: e.value ?? null, diff: e.diff === Infinity ? null : e.diff, points: stepScores[e.id] || 0 }))
      .sort((a, b) => (a.diff == null ? Infinity : a.diff) - (b.diff == null ? Infinity : b.diff));

    ctx.broadcast('step:reveal', { prueba: 'masomenos', reveal: { answer: q.answer, unit: q.unit || '', results } });
    ctx.emitLiveStandings(rt.roundScores);
    ctx.setTimer(() => this.nextQuestion(ctx), 5000);
  },

  finishRound(ctx) {
    ctx.clearTimers();
    ctx.finish({ roundScores: ctx.m.runtime.roundScores || {}, reveal: { type: 'masomenos', total: ctx.m.runtime.questions.length } });
  },

  cleanup(ctx) { ctx.clearTimers(); },
};
