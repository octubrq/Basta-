// Motor de partida por rondas. Orquesta el ciclo de cada ronda y delega el juego
// concreto en el módulo de prueba correspondiente (server/pruebas/*).
const { game } = require('./rooms');
const { getPrueba } = require('./pruebas');

let ioRef = null;
function attach(io) { ioRef = io; }

// ---------- helpers ----------
const nameOf = (pid) => game.players.get(String(pid))?.name || '?';

function connectedPlayers() {
  return [...game.players.values()].filter(p => p.connected);
}

// Jugadores que participan en la partida actual. En solo, solo el que la inició
// (aunque el admin esté conectado de fondo). En multi, todos los conectados.
function matchPlayers() {
  const m = game.match;
  if (m && m.mode === 'solo') {
    const p = game.players.get(String(m.starterId));
    return p && p.connected ? [p] : [];
  }
  return connectedPlayers();
}

function publicStandings() {
  return matchPlayers()
    .map(p => ({ id: p.id, name: p.name, totalScore: p.totalScore, connected: p.connected, profile: p.profile || 'normal' }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

// Hándicap por edad: niño/mayor reciben multiplicador de puntos.
function isPrivileged(p) { return !!p && (p.profile === 'nino' || p.profile === 'mayor'); }
function handicapMult(p) { return isPrivileged(p) ? 1 + (game.config.handicapPercent || 0) / 100 : 1; }
function boostedScore(pid, pts) { return Math.round((pts || 0) * handicapMult(game.players.get(String(pid)))); }
function anyPrivileged() { return matchPlayers().some(isPrivileged); }

// Marcador provisional durante el juego (totales confirmados + lo ganado en la ronda, con hándicap).
function liveStandings(roundScores) {
  return matchPlayers()
    .map(p => ({ id: p.id, name: p.name, profile: p.profile || 'normal', totalScore: p.totalScore + boostedScore(p.id, roundScores[String(p.id)] || 0), connected: p.connected }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

function pruebaMeta(p) {
  return {
    id: p.id, name: p.name, color: p.color, icon: p.icon,
    howToPlay: p.howToPlay, howToScore: p.howToScore,
    soloHowToScore: p.soloHowToScore || p.howToScore,
  };
}

// ---------- timers (con pausa genérica) ----------
function addTimer(fn, ms) {
  const m = game.match;
  const meta = { fn, remaining: null, deadline: Date.now() + ms, id: null, done: false };
  meta.id = setTimeout(() => { meta.done = true; fn(); }, ms);
  (m._timerMeta || (m._timerMeta = [])).push(meta);
  return meta;
}
function clearAllTimers() {
  const m = game.match; if (!m) return;
  (m._timerMeta || []).forEach(t => { if (t.id) clearTimeout(t.id); });
  m._timerMeta = [];
}
function pauseTimers() {
  const m = game.match;
  (m._timerMeta || []).forEach(t => {
    if (t.done || t.id == null) return;
    clearTimeout(t.id); t.remaining = Math.max(0, t.deadline - Date.now()); t.id = null;
  });
}
function resumeTimers() {
  const m = game.match;
  (m._timerMeta || []).forEach(t => {
    if (t.done || t.id != null) return;
    const ms = t.remaining != null ? t.remaining : 0;
    t.deadline = Date.now() + ms;
    t.id = setTimeout(() => { t.done = true; t.fn(); }, ms);
  });
}

// Contexto que reciben las pruebas.
function ctx() {
  const m = game.match;
  return {
    io: ioRef, game, m, solo: m.mode === 'solo',
    broadcast: (ev, d) => {
      // Guardar el último paso/revelación para poder restaurarlos al reconectar.
      if (ev === 'step:show') { m.lastStep = d; m.lastReveal = null; }
      else if (ev === 'step:reveal') { m.lastReveal = d; }
      ioRef.emit(ev, d);
    },
    emitTo: (pid, ev, d) => { const p = game.players.get(String(pid)); if (p?.socketId) ioRef.to(p.socketId).emit(ev, d); },
    nameOf,
    playerIds: () => matchPlayers().map(p => String(p.id)),
    setTimer: addTimer,
    clearTimers: clearAllTimers,
    finish: finishRound,
    emitLiveStandings: (roundScores) => ioRef.emit('scoreboard:update', liveStandings(roundScores)),
    // Hándicap: privilegio por jugador y segundos extra en pruebas simultáneas
    isPrivileged: (pid) => isPrivileged(game.players.get(String(pid))),
    extraSeconds: () => (anyPrivileged() ? (game.config.handicapSeconds || 0) : 0),
    // Estadísticas para los premios tontos del final
    recordStat: (pid, key, amt = 1) => {
      const s = m.stats[String(pid)] || (m.stats[String(pid)] = {});
      s[key] = (s[key] || 0) + amt;
    },
  };
}

// ---------- construir la secuencia de rondas ----------
function buildSequence(pruebas, rounds, order) {
  const seq = [];
  if (order === 'random') {
    let last = null;
    for (let i = 0; i < rounds; i++) {
      const pool = pruebas.length > 1 ? pruebas.filter(p => p !== last) : pruebas;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      seq.push(pick); last = pick;
    }
  } else {
    for (let i = 0; i < rounds; i++) seq.push(pruebas[i % pruebas.length]);
  }
  return seq;
}

// ---------- ciclo de partida ----------
function startMatch(cfg, mode, starterId) {
  if (game.match && ['instructions', 'playing', 'reveal', 'standings'].includes(game.match.state)) {
    return { error: 'Ya hay una partida en curso' };
  }
  const pruebas = (cfg.pruebas || []).filter(id => getPrueba(id));
  if (!pruebas.length) return { error: 'Elige al menos una prueba' };
  const rounds = Math.min(20, Math.max(1, parseInt(cfg.rounds) || pruebas.length));
  const order = cfg.order === 'random' ? 'random' : 'sequential';

  for (const p of game.players.values()) p.totalScore = 0;

  game.match = {
    active: true, mode, starterId,
    config: { pruebas, rounds, order },
    sequence: buildSequence(pruebas, rounds, order),
    roundIndex: 0, state: 'idle',
    currentPrueba: null, content: null, runtime: {},
    usedLetters: [], pauses: {}, adminPaused: false,
    prevRanking: [], lastRoundResult: null, stats: {},
    _timerMeta: [], instrInterval: null, instrRemaining: 0,
  };
  beginRound();
  return { ok: true };
}

function beginRound() {
  const m = game.match;
  m.currentPrueba = m.sequence[m.roundIndex];
  const prueba = getPrueba(m.currentPrueba);
  m.state = 'instructions';
  m.content = null; m.runtime = {}; m.pauses = {}; m.adminPaused = false;
  m._timerMeta = [];
  m.instrRemaining = prueba.instructionsSeconds || 8;

  ioRef.emit('round:instructions', {
    prueba: pruebaMeta(prueba),
    roundIndex: m.roundIndex, totalRounds: m.config.rounds,
    solo: m.mode === 'solo', standings: publicStandings(),
  });
  clearInterval(m.instrInterval);
  m.instrInterval = setInterval(instrTick, 1000);
  ioRef.emit('round:instr_tick', { remaining: m.instrRemaining, pausedBy: [] });
}

function pausedByList() {
  const m = game.match;
  return Object.keys(m.pauses).filter(id => m.pauses[id]).map(nameOf);
}

function instrTick() {
  const m = game.match;
  if (!m || m.state !== 'instructions') return;
  const pausedBy = pausedByList();
  if (pausedBy.length > 0) { ioRef.emit('round:instr_tick', { remaining: m.instrRemaining, pausedBy }); return; }
  m.instrRemaining -= 1;
  if (m.instrRemaining <= 0) {
    clearInterval(m.instrInterval); m.instrInterval = null;
    ioRef.emit('round:instr_tick', { remaining: 0, pausedBy: [] });
    beginPlay();
    return;
  }
  ioRef.emit('round:instr_tick', { remaining: m.instrRemaining, pausedBy: [] });
}

// Pausa en la pantalla de instrucciones: la puede pulsar cualquier jugador.
function togglePause(playerId) {
  const m = game.match;
  if (!m || m.state !== 'instructions') return;
  const pid = String(playerId);
  m.pauses[pid] = !m.pauses[pid];
  ioRef.emit('round:instr_tick', { remaining: m.instrRemaining, pausedBy: pausedByList() });
}

async function beginPlay() {
  const m = game.match;
  m.state = 'playing';
  const prueba = getPrueba(m.currentPrueba);
  try { await prueba.startPlay(ctx()); }
  catch (e) { console.error('❌ startPlay error:', e); }
}

// Pausa durante el juego: solo el admin.
function toggleAdminPause() {
  const m = game.match;
  if (!m || m.state !== 'playing') return;
  m.adminPaused = !m.adminPaused;
  if (m.adminPaused) pauseTimers(); else resumeTimers();
  ioRef.emit(m.adminPaused ? 'round:paused' : 'round:resumed', {});
}

function finishRound(result) {
  const m = game.match;
  if (!m || ['reveal', 'standings', 'finished'].includes(m.state)) return;
  clearAllTimers();
  // Aplicar hándicap (multiplicador niño/mayor) a lo ganado en la ronda.
  const roundScores = {};
  for (const [pid, pts] of Object.entries(result.roundScores || {})) roundScores[pid] = boostedScore(pid, pts);
  for (const [pid, pts] of Object.entries(roundScores)) {
    const p = game.players.get(String(pid));
    if (p) p.totalScore += pts;
  }
  const podium = matchPlayers()
    .map(p => ({ id: p.id, name: p.name, profile: p.profile || 'normal', roundScore: roundScores[String(p.id)] || 0 }))
    .sort((a, b) => b.roundScore - a.roundScore)
    .slice(0, 3);

  const ranked = publicStandings();
  const prev = m.prevRanking || [];
  const standings = ranked.map((p, i) => {
    const prevIdx = prev.indexOf(String(p.id));
    return { ...p, delta: prevIdx === -1 ? 0 : prevIdx - i };
  });
  m.prevRanking = ranked.map(p => String(p.id));

  m.state = 'reveal';
  m.lastRoundResult = {
    prueba: m.currentPrueba, reveal: result.reveal, podium, standings,
    roundIndex: m.roundIndex, totalRounds: m.config.rounds,
    isLast: m.roundIndex >= m.config.rounds - 1,
    solo: m.mode === 'solo',
  };
  ioRef.emit('round:result', m.lastRoundResult);
}

function nextRound() {
  const m = game.match;
  if (!m || !['reveal', 'standings'].includes(m.state)) return;
  advance();
}

function skip() {
  const m = game.match;
  if (!m) return;
  const prueba = getPrueba(m.currentPrueba);
  try { prueba && prueba.cleanup && prueba.cleanup(ctx()); } catch { /* noop */ }
  clearInterval(m.instrInterval); m.instrInterval = null;
  ioRef.emit('round:skipped', {});
  advance();
}

function advance() {
  const m = game.match;
  clearAllTimers();
  clearInterval(m.instrInterval); m.instrInterval = null;
  m.roundIndex += 1;
  if (m.roundIndex >= m.config.rounds) return finishMatch();
  beginRound();
}

// Premios tontos: que todo el mundo se lleve algo.
function computeAwards() {
  const m = game.match;
  const stats = m.stats || {};
  const players = matchPlayers();
  const awards = [];
  const given = new Set();
  const give = (pid, emoji, title) => {
    pid = pid && String(pid);
    if (pid && !given.has(pid) && game.players.get(pid)) { given.add(pid); awards.push({ playerId: pid, name: nameOf(pid), emoji, title }); }
  };
  const topBy = (key) => {
    let best = null, bestV = 0;
    for (const p of players) { const v = stats[String(p.id)]?.[key] || 0; if (v > bestV) { bestV = v; best = String(p.id); } }
    return best;
  };
  const ranked = publicStandings();
  if (ranked[0]) give(ranked[0].id, '🏆', 'Campeón');
  give(topBy('speed'), '⚡', 'El más rápido');
  give(topBy('combos'), '🔥', 'El rey del combo');
  give(topBy('closeMiss'), '🎯', 'El más cerca sin ganar');
  const FB = [['😎', 'El más tranquilo'], ['🎨', 'El más original'], ['🍀', 'El más suertudo'], ['🌟', 'La estrella sorpresa'], ['🤝', 'El buen perdedor'], ['🎉', 'El alma de la fiesta']];
  let fi = 0;
  for (const p of players) if (!given.has(String(p.id))) give(p.id, FB[fi % FB.length][0], FB[fi++ % FB.length][1]);
  return awards;
}

function finishMatch() {
  const m = game.match;
  m.state = 'finished';
  clearAllTimers();
  clearInterval(m.instrInterval); m.instrInterval = null;
  const payload = { mode: m.mode, solo: m.mode === 'solo', standings: publicStandings() };
  if (m.mode !== 'solo') payload.awards = computeAwards();

  // Récord personal en modo solo (guardado en BD).
  if (m.mode === 'solo' && m.starterId) {
    const db = require('./database');
    const pid = String(m.starterId);
    const score = game.players.get(pid)?.totalScore || 0;
    const prev = parseInt(db.getSetting(`record_${pid}`) || '0', 10);
    const isNew = score > prev;
    if (isNew) db.setSetting(`record_${pid}`, String(score));
    payload.record = { score, previous: prev, best: Math.max(score, prev), isNew };
  }

  ioRef.emit('match:finished', payload);
}

function resetMatch() {
  const m = game.match;
  if (m) {
    const prueba = getPrueba(m.currentPrueba);
    try { prueba && prueba.cleanup && prueba.cleanup(ctx()); } catch { /* noop */ }
    clearAllTimers();
    clearInterval(m.instrInterval);
  }
  game.match = null;
  for (const p of game.players.values()) p.totalScore = 0;
}

function handleEvent(event, payload, playerId) {
  const m = game.match;
  if (!m || m.state !== 'playing') return;
  const prueba = getPrueba(m.currentPrueba);
  if (prueba && prueba.onEvent) prueba.onEvent(ctx(), event, payload, playerId);
}

// Datos para restaurar la pantalla exacta al reconectar.
function reconnectData() {
  const m = game.match;
  if (!m) return { match: null };
  const base = { match: matchPublic(), standings: publicStandings(), lastResult: m.lastRoundResult };
  if (m.state === 'instructions') {
    base.instr = {
      prueba: pruebaMeta(getPrueba(m.currentPrueba)),
      roundIndex: m.roundIndex, totalRounds: m.config.rounds,
      remaining: m.instrRemaining, pausedBy: pausedByList(), solo: m.mode === 'solo',
    };
  } else if (m.state === 'playing') {
    if (m.currentPrueba === 'basta') base.play = { prueba: 'basta', content: m.content };
    else if (m.currentPrueba === 'scramble') base.play = {
      prueba: 'scramble', content: { minutes: game.config.scrambleMinutes },
      word: m.runtime?.scrambled ? { scrambled: m.runtime.scrambled, wordNumber: m.runtime.index, total: m.runtime.words?.length } : null,
    };
    else base.play = { prueba: m.currentPrueba }; // pruebas de canal genérico (masomenos, pistas, vf, ordena...)
    // Paso/revelación actuales del canal genérico (si los hay)
    base.step = m.lastStep || null;
    base.stepReveal = m.lastReveal || null;
    base.adminPaused = m.adminPaused;
  } else if (['reveal', 'standings'].includes(m.state)) {
    base.result = m.lastRoundResult;
  } else if (m.state === 'finished') {
    base.finished = { standings: publicStandings(), solo: m.mode === 'solo' };
  }
  return base;
}

function matchPublic() {
  const m = game.match;
  if (!m) return null;
  return {
    mode: m.mode, state: m.state, roundIndex: m.roundIndex, totalRounds: m.config.rounds,
    currentPrueba: m.currentPrueba, config: m.config, starterId: m.starterId, adminPaused: m.adminPaused,
  };
}

module.exports = {
  attach, startMatch, beginRound, togglePause, toggleAdminPause,
  nextRound, skip, resetMatch, finishMatch, handleEvent,
  reconnectData, matchPublic, publicStandings,
};
