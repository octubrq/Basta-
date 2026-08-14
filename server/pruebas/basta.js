const { calculateRoundScores, totalScore } = require('../validator');
const { getRandomCategories, getRandomLetter, getComboLetter } = require('../categories');

// Prueba ¡Basta! adaptada al motor de partida por rondas.
// Una ronda = una letra + varias categorías. El primero que completa grita ¡BASTA!
module.exports = {
  id: 'basta',
  name: '¡Basta!',
  color: '#EC4899',
  icon: '🎯',
  minPlayers: 1,
  instructionsSeconds: 3,
  howToPlay: 'Sale una LETRA y varias categorías. Escribe en cada una una palabra que empiece por esa letra. El primero que las completa (puede dejar 1 vacía) grita ¡BASTA! y el resto tiene unos segundos para terminar.',
  howToScore: '10 puntos si tu respuesta es válida y única · 5 si otro puso lo mismo.',
  soloHowToScore: '10 puntos por cada respuesta válida.',

  startPlay(ctx) {
    const cfg = ctx.game.config;
    const rt = ctx.m.runtime = { answers: {}, received: new Set(), bastaPlayer: null, state: 'playing' };
    if (!ctx.m.usedLetters) ctx.m.usedLetters = [];
    const letter = getRandomLetter(ctx.m.usedLetters) || getRandomLetter([]);
    ctx.m.usedLetters.push(letter);
    const combo = cfg.mode === 'combo' ? getComboLetter(letter) : null;
    const categories = getRandomCategories(ctx.game.categoryPool, cfg.categoriesPerRound);
    ctx.m.content = { letter, comboLetter: combo, categories, endMode: cfg.endMode };
    ctx.broadcast('round:play', { prueba: 'basta', content: ctx.m.content });
    if (cfg.endMode.startsWith('fixed_')) {
      rt.fixedTimer = ctx.setTimer(() => this.collect(ctx), parseInt(cfg.endMode.split('_')[1]) * 1000);
    }
  },

  onEvent(ctx, event, payload, playerId) {
    const rt = ctx.m.runtime;
    if (!rt) return;

    if (event === 'player:answers') {
      this.store(ctx, playerId, payload || {});
      if (['grace', 'reviewing'].includes(rt.state) && this.allIn(ctx)) this.collect(ctx);
      return;
    }

    if (event === 'player:basta') {
      if (rt.state !== 'playing') return;
      const cats = ctx.m.content.categories;
      const empty = cats.filter(c => !((payload?.[c] || '').trim())).length;
      if (empty > 1 && !ctx.solo) { ctx.emitTo(playerId, 'error:message', `Máximo 1 vacía (tienes ${empty})`); return; }
      rt.bastaPlayer = playerId;
      this.store(ctx, playerId, payload || {});
      const em = ctx.game.config.endMode;
      const graceMs = em === 'basta_10s' ? 10000 : em === 'basta_5s' ? 5000 : 0;
      rt.state = graceMs > 0 ? 'grace' : 'reviewing';
      ctx.broadcast('round:basta', { playerId, playerName: ctx.nameOf(playerId), graceMs, hadEmpty: empty > 0 });
      if (ctx.solo || graceMs === 0) this.collect(ctx);
      else rt.graceTimer = ctx.setTimer(() => this.collect(ctx), graceMs);
    }
  },

  store(ctx, playerId, answers) {
    const rt = ctx.m.runtime;
    const pid = String(playerId);
    rt.answers[pid] = {};
    for (const c of ctx.m.content.categories) rt.answers[pid][c] = (answers[c] || '').substring(0, 100);
    rt.received.add(pid);
  },

  allIn(ctx) {
    return ctx.playerIds().every(id => ctx.m.runtime.received.has(String(id)));
  },

  collect(ctx) {
    const rt = ctx.m.runtime;
    if (rt.collected) return;
    rt.collected = true;
    ctx.clearTimers();
    rt.state = 'reviewing';
    ctx.broadcast('round:force_submit');
    ctx.broadcast('round:collecting');
    ctx.setTimer(() => this.score(ctx), ctx.solo ? 400 : 3000);
  },

  async score(ctx) {
    const rt = ctx.m.runtime;
    if (rt.scored) return;
    rt.scored = true;
    ctx.broadcast('round:validating');
    for (const id of ctx.playerIds()) {
      const pid = String(id);
      if (!rt.answers[pid]) { rt.answers[pid] = {}; for (const c of ctx.m.content.categories) rt.answers[pid][c] = ''; }
    }
    const { scores, details } = await calculateRoundScores(
      rt.answers, ctx.m.content.letter, ctx.m.content.comboLetter, ctx.solo ? null : rt.bastaPlayer
    );
    const roundScores = {};
    for (const pid of Object.keys(scores)) roundScores[pid] = totalScore(scores[pid]);
    ctx.finish({
      roundScores,
      reveal: {
        type: 'basta',
        details,
        letter: ctx.m.content.letter,
        comboLetter: ctx.m.content.comboLetter,
        categories: ctx.m.content.categories,
        bastaPlayer: ctx.solo ? null : rt.bastaPlayer,
      },
    });
  },

  cleanup(ctx) { ctx.clearTimers(); },
};
