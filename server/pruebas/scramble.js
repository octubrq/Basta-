const { generateScrambledWords, scrambleWord } = require('../aiValidator');

// Letras Locas: palabras con letras desordenadas; el primero que acierta gana 10.
// En una partida por rondas, cada ronda dura los minutos configurados.
module.exports = {
  id: 'scramble',
  name: 'Letras Locas',
  color: '#22C55E',
  icon: '🔤',
  minPlayers: 1,
  instructionsSeconds: 3,
  howToPlay: 'Aparecen palabras con las letras desordenadas. Escribe la palabra correcta lo más rápido que puedas. Van saliendo palabras hasta que se acaba el tiempo.',
  howToScore: '10 puntos por cada palabra que aciertes antes que los demás.',
  soloHowToScore: '10 puntos por cada palabra que aciertes.',

  async startPlay(ctx) {
    const cfg = ctx.game.config;
    const minutes = cfg.scrambleMinutes || 2;
    const rt = ctx.m.runtime = { index: 0, current: null, scrambled: null, scores: {}, log: [], words: [] };
    for (const id of ctx.playerIds()) rt.scores[id] = 0;
    const wordCount = Math.max(20, minutes * 8);
    rt.words = await generateScrambledWords(wordCount, cfg.scrambleDifficulty);
    ctx.broadcast('round:play', { prueba: 'scramble', content: { minutes } });
    const first = this.nextWord(ctx);
    if (first) ctx.broadcast('scramble:word', first);
    rt.mainTimer = ctx.setTimer(() => this.end(ctx), minutes * 60 * 1000);
  },

  nextWord(ctx) {
    const rt = ctx.m.runtime;
    if (rt.index >= rt.words.length) return null;
    const w = rt.words[rt.index].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    rt.current = w;
    rt.scrambled = scrambleWord(w);
    rt.index++;
    return { scrambled: rt.scrambled, wordNumber: rt.index, total: rt.words.length };
  },

  onEvent(ctx, event, payload, playerId) {
    const rt = ctx.m.runtime;
    if (!rt || event !== 'scramble:answer' || !rt.current) return;
    const norm = String(payload || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (norm !== rt.current) return;
    rt.scores[playerId] = (rt.scores[playerId] || 0) + 10;
    rt.log.push({ word: rt.current, winner: ctx.nameOf(playerId), winnerId: playerId });
    ctx.broadcast('scramble:correct', { playerId, playerName: ctx.nameOf(playerId), word: rt.current });
    ctx.emitLiveStandings(rt.scores); // marcador provisional (se confirma al acabar la ronda)
    rt.current = null; // evita dobles aciertos entre palabra y palabra
    ctx.setTimer(() => {
      const next = this.nextWord(ctx);
      if (next) ctx.broadcast('scramble:word', next);
      else this.end(ctx);
    }, 1200);
  },

  end(ctx) {
    const rt = ctx.m.runtime;
    if (rt.ended) return;
    rt.ended = true;
    ctx.clearTimers();
    ctx.finish({ roundScores: { ...rt.scores }, reveal: { type: 'scramble', log: rt.log } });
  },

  cleanup(ctx) { ctx.clearTimers(); },
};
