const { callClaude, extractJSON } = require('../aiValidator');

// Ordena la lista: colocar elementos en el orden correcto según un criterio.
const ORDER_SECONDS = 30;
const N = 3;
const POINTS_PER = 5;

const FALLBACK = [
  { prompt: 'Ordena de más GRANDE a más pequeño', correct: ['Júpiter', 'Saturno', 'Neptuno', 'Marte'] },
  { prompt: 'Ordena de más RÁPIDO a más lento', correct: ['Guepardo', 'Caballo', 'Humano', 'Tortuga'] },
  { prompt: 'Ordena de MENOR a mayor duración', correct: ['Segundo', 'Minuto', 'Hora', 'Día'] },
  { prompt: 'Ordena de más PESADO a más ligero', correct: ['Elefante', 'Caballo', 'Perro', 'Ratón'] },
  { prompt: 'Ordena del invento más ANTIGUO al más moderno', correct: ['Rueda', 'Imprenta', 'Teléfono', 'Internet'] },
];

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

module.exports = {
  id: 'ordena',
  name: 'Ordena la lista',
  color: '#14B8A6',
  icon: '↕️',
  minPlayers: 1,
  instructionsSeconds: 8,
  howToPlay: 'Coloca los elementos en el orden correcto arrastrándolos con el dedo. Cuando lo tengas, confirma.',
  howToScore: '5 puntos por cada elemento que dejes en su posición correcta.',
  soloHowToScore: '5 puntos por cada elemento en su posición correcta.',

  async startPlay(ctx) {
    const rt = ctx.m.runtime = { items: [], idx: -1, roundScores: {}, answers: {}, revealed: false, shuffled: [] };
    const text = await callClaude(
      `Genera ${N} retos de ORDENAR para un juego familiar en español. Cada reto tiene un enunciado con un criterio claro y OBJETIVO (por tamaño, longitud, velocidad, año, población, altura...) y EXACTAMENTE 4 elementos ya colocados en el ORDEN CORRECTO según ese criterio. El orden debe ser verificable y no ambiguo. Devuelve SOLO un array JSON: [{"prompt":"Ordena de más largo a más corto","correct":["Nilo","Amazonas","Yangtsé","Ebro"]}]`,
      1200
    );
    let lists = extractJSON(text);
    if (!Array.isArray(lists)) lists = null;
    lists = (lists || []).filter(x => x && typeof x.prompt === 'string' && Array.isArray(x.correct) && x.correct.length >= 3);
    if (lists.length < 1) lists = [...FALLBACK].sort(() => Math.random() - 0.5).slice(0, N);
    rt.items = lists.slice(0, N).map(x => ({ prompt: String(x.prompt), correct: x.correct.slice(0, 5).map(String) }));
    ctx.broadcast('round:play', { prueba: 'ordena', content: { total: rt.items.length } });
    this.nextItem(ctx);
  },

  nextItem(ctx) {
    const rt = ctx.m.runtime;
    rt.idx++;
    if (rt.idx >= rt.items.length) return this.finishRound(ctx);
    rt.answers = {}; rt.revealed = false;
    const it = rt.items[rt.idx];
    let shuffled = shuffle(it.correct);
    let attempts = 0;
    while (shuffled.join('|') === it.correct.join('|') && it.correct.length > 1 && attempts < 10) { shuffled = shuffle(it.correct); attempts++; }
    rt.shuffled = shuffled;
    ctx.broadcast('step:show', { prueba: 'ordena', step: { index: rt.idx, total: rt.items.length, prompt: it.prompt, items: shuffled, seconds: ORDER_SECONDS } });
    ctx.setTimer(() => this.reveal(ctx), ORDER_SECONDS * 1000);
  },

  onEvent(ctx, event, payload, playerId) {
    const rt = ctx.m.runtime;
    if (!rt || event !== 'step:answer' || rt.revealed || !Array.isArray(payload)) return;
    const it = rt.items[rt.idx];
    const valid = payload.length === it.correct.length && it.correct.every(l => payload.includes(l));
    if (!valid) return;
    rt.answers[String(playerId)] = payload.map(String);
    if (ctx.playerIds().every(id => rt.answers[String(id)])) this.reveal(ctx);
  },

  reveal(ctx) {
    const rt = ctx.m.runtime;
    if (rt.revealed) return;
    rt.revealed = true;
    ctx.clearTimers();
    const it = rt.items[rt.idx];
    const results = [];
    for (const id of ctx.playerIds()) {
      const pid = String(id);
      const ans = rt.answers[pid];
      let correctCount = 0;
      if (ans) for (let i = 0; i < it.correct.length; i++) if (ans[i] === it.correct[i]) correctCount++;
      const points = correctCount * POINTS_PER;
      if (points > 0) rt.roundScores[pid] = (rt.roundScores[pid] || 0) + points;
      results.push({ id: pid, name: ctx.nameOf(id), correctCount, points, order: ans || null });
    }
    results.sort((a, b) => b.points - a.points);
    ctx.broadcast('step:reveal', { prueba: 'ordena', reveal: { correct: it.correct, results } });
    ctx.emitLiveStandings(rt.roundScores);
    ctx.setTimer(() => this.nextItem(ctx), 6000);
  },

  finishRound(ctx) {
    ctx.clearTimers();
    ctx.finish({ roundScores: ctx.m.runtime.roundScores || {}, reveal: { type: 'ordena', total: ctx.m.runtime.items.length } });
  },

  cleanup(ctx) { ctx.clearTimers(); },
};
