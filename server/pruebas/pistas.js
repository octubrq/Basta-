const { callClaude, extractJSON } = require('../aiValidator');
const { normalize, areSame } = require('../validator');
const db = require('../database');

// Pistas Progresivas: adivinar una incógnita con pistas que van de difícil a fácil.
// Una llamada a la IA por ronda genera varias incógnitas con sus 4 pistas.
const CLUE_SECONDS = 15;
const N_ITEMS = 3;
const POINTS = [20, 15, 10, 5]; // según con cuántas pistas se acierta (1..4)

const FALLBACK = [
  { answer: 'Elefante', aliases: [], clues: ['Vivo en manada y tengo muy buena memoria.', 'Mi piel es gris y arrugada.', 'Uso mi trompa para beber y coger cosas.', 'Soy el animal terrestre más grande, con colmillos y grandes orejas.'] },
  { answer: 'Guitarra', aliases: [], clues: ['Sueno distinto según cómo me toquen.', 'Estoy hecha de madera y tengo un agujero.', 'Tengo seis cuerdas.', 'Instrumento que se rasga con los dedos, típico del flamenco y el rock.'] },
  { answer: 'Luna', aliases: [], clues: ['Cambio de forma a lo largo del mes.', 'No tengo luz propia, reflejo la del Sol.', 'Provoco las mareas.', 'Es el satélite natural de la Tierra y se ve de noche.'] },
  { answer: 'Pizza', aliases: [], clues: ['Nací en Italia.', 'Soy redonda y se me corta en porciones.', 'Llevo tomate y queso fundido.', 'Comida con una base de masa y distintos ingredientes encima.'] },
  { answer: 'Girasol', aliases: [], clues: ['Sigo algo durante el día.', 'Soy alto y de color amarillo.', 'De mí salen pipas que se comen.', 'Flor grande y amarilla que mira hacia el Sol.'] },
];

module.exports = {
  id: 'pistas',
  name: 'Pistas Progresivas',
  color: '#F59E0B',
  icon: '🔍',
  minPlayers: 1,
  instructionsSeconds: 3,
  howToPlay: 'Hay que adivinar una incógnita. Salen pistas de una en una, de la más difícil a la más fácil. El primero que la adivina se lleva los puntos y cierra.',
  howToScore: 'Cuantas menos pistas necesites, más puntos: 20 con 1 pista, 15 con 2, 10 con 3, 5 con 4.',
  soloHowToScore: '20 puntos con 1 pista, 15 con 2, 10 con 3, 5 con 4.',

  async startPlay(ctx) {
    const rt = ctx.m.runtime = { items: [], idx: -1, clueNum: 1, solved: false, roundScores: {} };
    const diff = ctx.game.config.pistasDifficulty || 'medium';
    const DIFF = {
      easy: 'FÁCIL: incógnitas muy conocidas y cotidianas (animales comunes, objetos de casa, comidas típicas). Las pistas, incluso la primera, deben ser bastante claras y directas.',
      medium: 'MEDIA: incógnitas variadas y conocidas. La primera pista algo críptica, las últimas claras.',
      hard: 'DIFÍCIL: incógnitas más específicas o rebuscadas (conceptos, personajes históricos, lugares menos obvios, objetos poco comunes). Las pistas deben ser sutiles e ingeniosas, evitando lo evidente hasta la última.',
    };
    const used = ctx.game.config.avoidRepeats !== false ? db.getUsed('pistas') : [];
    const avoid = used.length ? `\nMUY IMPORTANTE: NO uses ninguna de estas incógnitas que ya han salido: ${used.slice(0, 40).join(', ')}. Elige palabras claramente distintas.` : '';
    const text = await callClaude(
      `Genera ${N_ITEMS} incógnitas para un juego de adivinar en español, para toda la familia, con dificultad ${DIFF[diff] || DIFF.medium} Cada incógnita es UNA palabra concreta. Da 4 PISTAS ordenadas de la MÁS críptica y difícil (pista 1) a la MÁS obvia y fácil (pista 4). Las pistas NO pueden contener la palabra a adivinar ni derivados suyos.${avoid} Devuelve SOLO un array JSON: [{"answer":"Elefante","aliases":["elefantes"],"clues":["pista dificil","pista media","pista facil","pista muy facil"]}]`,
      1500
    );
    let items = extractJSON(text);
    if (!Array.isArray(items)) items = null;
    items = (items || []).filter(x => x && x.answer && Array.isArray(x.clues) && x.clues.length >= 4);
    if (items.length < 1) items = [...FALLBACK].sort(() => Math.random() - 0.5).slice(0, N_ITEMS);
    rt.items = items.slice(0, N_ITEMS).map(x => ({
      answer: String(x.answer),
      aliases: Array.isArray(x.aliases) ? x.aliases.map(String) : [],
      clues: x.clues.slice(0, 4).map(String),
    }));
    db.pushUsed('pistas', rt.items.map(x => x.answer));
    ctx.broadcast('round:play', { prueba: 'pistas', content: { total: rt.items.length } });
    this.nextItem(ctx);
  },

  nextItem(ctx) {
    const rt = ctx.m.runtime;
    rt.idx++;
    if (rt.idx >= rt.items.length) return this.finishRound(ctx);
    rt.clueNum = 1;
    rt.solved = false;
    this.showClue(ctx);
  },

  showClue(ctx) {
    const rt = ctx.m.runtime;
    const item = rt.items[rt.idx];
    ctx.broadcast('step:show', {
      prueba: 'pistas',
      step: {
        index: rt.idx, total: rt.items.length,
        clues: item.clues.slice(0, rt.clueNum), clueNum: rt.clueNum, totalClues: 4,
        seconds: CLUE_SECONDS,
      },
    });
    ctx.setTimer(() => this.timeUp(ctx), CLUE_SECONDS * 1000);
  },

  timeUp(ctx) {
    const rt = ctx.m.runtime;
    if (rt.solved) return;
    if (rt.clueNum < 4) { rt.clueNum++; this.showClue(ctx); }
    else this.giveUp(ctx);
  },

  onEvent(ctx, event, payload, playerId) {
    const rt = ctx.m.runtime;
    if (!rt || event !== 'step:answer' || rt.solved || rt.idx < 0) return;
    const item = rt.items[rt.idx];
    if (!this.matches(String(payload || ''), item)) return; // fallo: se ignora, puede reintentar
    rt.solved = true;
    ctx.clearTimers();
    const points = POINTS[rt.clueNum - 1] || 0;
    rt.roundScores[String(playerId)] = (rt.roundScores[String(playerId)] || 0) + points;
    ctx.recordStat(playerId, 'speed');
    ctx.broadcast('step:reveal', {
      prueba: 'pistas',
      reveal: { answer: item.answer, solvedBy: ctx.nameOf(playerId), solvedById: String(playerId), points, clueNum: rt.clueNum },
    });
    ctx.emitLiveStandings(rt.roundScores);
    ctx.setTimer(() => this.nextItem(ctx), 4500);
  },

  giveUp(ctx) {
    const rt = ctx.m.runtime;
    if (rt.solved) return;
    rt.solved = true;
    ctx.clearTimers();
    const item = rt.items[rt.idx];
    ctx.broadcast('step:reveal', { prueba: 'pistas', reveal: { answer: item.answer, solvedBy: null, points: 0, clueNum: 4 } });
    ctx.setTimer(() => this.nextItem(ctx), 4500);
  },

  matches(guess, item) {
    if (!normalize(guess)) return false;
    if (areSame(guess, item.answer)) return true;
    return (item.aliases || []).some(a => areSame(guess, a));
  },

  finishRound(ctx) {
    ctx.clearTimers();
    ctx.finish({ roundScores: ctx.m.runtime.roundScores || {}, reveal: { type: 'pistas', total: ctx.m.runtime.items.length } });
  },

  cleanup(ctx) { ctx.clearTimers(); },
};
