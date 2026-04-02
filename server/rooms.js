const { CATEGORY_POOL, getRandomCategories, getRandomLetter, getComboLetter } = require('./categories');
const { calculateRoundScores, totalScore } = require('./validator');
const { generateScrambledWords, scrambleWord } = require('./aiValidator');

// Global game state (single room, admin controlled)
let game = {
  active: false,          // gate open for players
  players: new Map(),     // id -> { id, name, socketId, connected, totalScore, role }
  adminId: null,
  // Game config
  config: {
    rounds: 5,
    categoriesPerRound: 6,
    mode: 'classic',      // classic or combo
    endMode: 'basta_5s',
    scrambleMinutes: 2,
    scrambleDifficulty: 'medium', // easy, medium, hard, extreme
  },
  // Current game session
  session: {
    type: null,           // 'basta' or 'scramble'
    state: 'idle',        // idle, countdown, playing, grace, reviewing, validating, results, finished
    currentRound: 0,
    usedLetters: [],
    roundData: null,
    roundHistory: [],
    answers: {},
    answersReceived: new Set(),
    bastaPlayer: null,
    graceTimer: null,
    fixedTimer: null,
    // Scramble specific
    scrambleWords: [],
    scrambleIndex: 0,
    scrambleCurrentWord: null,
    scrambleScrambled: null,
    scrambleTimer: null,
    scrambleScores: {},   // playerId -> points
    scrambleLog: [],      // [{ word, winner, time }]
  },
  categoryPool: { ...CATEGORY_POOL },
};

function resetSession() {
  if (game.session.graceTimer) clearTimeout(game.session.graceTimer);
  if (game.session.fixedTimer) clearTimeout(game.session.fixedTimer);
  if (game.session.scrambleTimer) clearTimeout(game.session.scrambleTimer);
  game.session = {
    type: null, state: 'idle', currentRound: 0, usedLetters: [],
    roundData: null, roundHistory: [], answers: {}, answersReceived: new Set(),
    bastaPlayer: null, graceTimer: null, fixedTimer: null,
    scrambleWords: [], scrambleIndex: 0, scrambleCurrentWord: null,
    scrambleScrambled: null, scrambleTimer: null, scrambleScores: {}, scrambleLog: [],
  };
  // Reset scores
  for (const p of game.players.values()) { p.totalScore = 0; }
}

function getState() {
  return {
    active: game.active,
    adminId: game.adminId,
    config: game.config,
    sessionType: game.session.type,
    sessionState: game.session.state,
    currentRound: game.session.currentRound,
    players: [...game.players.values()].map(p => ({
      id: p.id, name: p.name, connected: p.connected,
      totalScore: p.totalScore, role: p.role,
    })),
    categoryPool: Object.entries(game.categoryPool).map(([n, d]) => ({ name: n, group: d.group, icon: d.icon })),
  };
}

function getStandings() {
  return [...game.players.values()]
    .map(p => ({ id: p.id, name: p.name, totalScore: p.totalScore, connected: p.connected }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

// Admin activates gate
function activate(adminUser) {
  game.active = true;
  game.adminId = adminUser.id;
  if (!game.players.has(adminUser.id)) {
    game.players.set(adminUser.id, {
      id: adminUser.id, name: adminUser.name, socketId: null,
      connected: true, totalScore: 0, role: 'admin',
    });
  } else {
    const p = game.players.get(adminUser.id);
    p.connected = true; p.role = 'admin';
  }
}

function deactivate() { game.active = false; }

function addPlayer(user) {
  if (!game.active) return { error: 'El juego no está activo' };
  const id = user.id;
  if (!game.players.has(id)) {
    game.players.set(id, {
      id, name: user.name, socketId: null,
      connected: true, totalScore: 0, role: user.role || 'player',
    });
  } else {
    const p = game.players.get(id);
    p.connected = true; p.name = user.name;
  }
  return { ok: true };
}

function removePlayer(id) {
  const p = game.players.get(id);
  if (p) p.connected = false;
  // If admin leaves, kick everyone
  if (id === game.adminId) {
    game.active = false;
    resetSession();
    return { adminLeft: true };
  }
  return { adminLeft: false };
}

function reconnectPlayer(id) {
  const p = game.players.get(id);
  if (p) { p.connected = true; return true; }
  return false;
}

// ============ BASTA GAME ============

function startBastaRound() {
  const s = game.session;
  s.type = 'basta';
  s.currentRound++;
  s.answers = {}; s.answersReceived = new Set();
  s.bastaPlayer = null;

  const letter = getRandomLetter(s.usedLetters);
  if (!letter) { s.state = 'finished'; return null; }
  s.usedLetters.push(letter);

  const combo = game.config.mode === 'combo' ? getComboLetter(letter) : null;
  const cats = getRandomCategories(game.categoryPool, game.config.categoriesPerRound);
  s.roundData = { round: s.currentRound, letter, comboLetter: combo, categories: cats };
  s.state = 'countdown';
  return s.roundData;
}

function beginBastaPlay() {
  game.session.state = 'playing';
  const em = game.config.endMode;
  if (em.startsWith('fixed_')) return { fixedTimeout: parseInt(em.split('_')[1]) * 1000 };
  return {};
}

function playerBasta(playerId, answers) {
  const s = game.session;
  if (s.state !== 'playing') return null;
  const cats = s.roundData.categories;
  const empty = cats.filter(c => !(answers?.[c] || '').trim()).length;
  if (empty > 1) return { error: `Máximo 1 vacía (tienes ${empty})` };
  s.bastaPlayer = playerId;
  const em = game.config.endMode;
  if (em === 'basta_immediate') { s.state = 'reviewing'; return { graceMs: 0, emptyCount: empty }; }
  if (em === 'basta_5s') { s.state = 'grace'; return { graceMs: 5000, emptyCount: empty }; }
  if (em === 'basta_10s') { s.state = 'grace'; return { graceMs: 10000, emptyCount: empty }; }
  return null;
}

function submitBastaAnswers(playerId, answers) {
  const s = game.session;
  if (!['playing', 'grace', 'reviewing'].includes(s.state)) return false;
  const pid = String(playerId);
  s.answers[pid] = {};
  for (const cat of s.roundData.categories) s.answers[pid][cat] = (answers[cat] || '').substring(0, 100);
  s.answersReceived.add(pid);
  const conn = [...game.players.values()].filter(p => p.connected).length;
  console.log(`📝 ${game.players.get(pid)?.name || pid} answered [${s.answersReceived.size}/${conn}]`);
  return true;
}

function allBastaAnswersIn() {
  const conn = [...game.players.entries()].filter(([, p]) => p.connected).map(([id]) => id);
  return conn.every(id => game.session.answersReceived.has(id));
}

async function endBastaRound() {
  const s = game.session;
  s.state = 'reviewing';
  // Fill missing
  for (const [pid, p] of game.players) {
    if (p.connected && !s.answers[pid]) {
      console.log(`⚠️ No answers from ${p.name} — filling empty`);
      s.answers[pid] = {};
      for (const c of s.roundData.categories) s.answers[pid][c] = '';
    }
  }
  console.log(`📊 Scoring: ${Object.keys(s.answers).length} players`);

  const { scores, details } = await calculateRoundScores(
    s.answers, s.roundData.letter, s.roundData.comboLetter, s.bastaPlayer
  );

  for (const [pid, ps] of Object.entries(scores)) {
    const p = game.players.get(pid);
    if (p) {
      p.totalScore += totalScore(ps);
    }
  }

  const result = {
    round: s.currentRound, letter: s.roundData.letter,
    comboLetter: s.roundData.comboLetter, categories: s.roundData.categories,
    details, scores, bastaPlayer: s.bastaPlayer, standings: getStandings(),
  };
  s.roundHistory.push(result);
  s.state = 'results';
  return result;
}

// ============ SCRAMBLE GAME ============

async function initScramble() {
  const s = game.session;
  s.type = 'scramble';
  s.state = 'countdown';
  s.scrambleScores = {};
  s.scrambleLog = [];
  s.scrambleIndex = 0;
  for (const [pid] of game.players) s.scrambleScores[pid] = 0;

  // Generate words
  const minutes = game.config.scrambleMinutes || 2;
  const wordCount = Math.max(20, minutes * 8);
  s.scrambleWords = await generateScrambledWords(wordCount, game.config.scrambleDifficulty);
  console.log(`🔤 Generated ${s.scrambleWords.length} words for ${minutes} min scramble`);
  return { minutes, wordCount: s.scrambleWords.length };
}

function nextScrambleWord() {
  const s = game.session;
  if (s.scrambleIndex >= s.scrambleWords.length) return null;
  const word = s.scrambleWords[s.scrambleIndex].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s.scrambleCurrentWord = word;
  s.scrambleScrambled = scrambleWord(word);
  s.scrambleIndex++;
  return { scrambled: s.scrambleScrambled, wordNumber: s.scrambleIndex, total: s.scrambleWords.length };
}

function checkScrambleAnswer(playerId, answer) {
  const s = game.session;
  if (!s.scrambleCurrentWord) return false;
  const norm = answer.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (norm === s.scrambleCurrentWord) {
    if (!s.scrambleScores[playerId]) s.scrambleScores[playerId] = 0;
    s.scrambleScores[playerId] += 10;
    const p = game.players.get(playerId);
    if (p) p.totalScore += 10;
    s.scrambleLog.push({ word: s.scrambleCurrentWord, winner: p?.name || playerId, winnerId: playerId });
    return true;
  }
  return false;
}

function endScramble() {
  const s = game.session;
  s.state = 'finished';
  return { scores: s.scrambleScores, log: s.scrambleLog, standings: getStandings() };
}

module.exports = {
  game, getState, getStandings, activate, deactivate,
  addPlayer, removePlayer, reconnectPlayer, resetSession,
  // Basta
  startBastaRound, beginBastaPlay, playerBasta, submitBastaAnswers,
  allBastaAnswersIn, endBastaRound,
  // Scramble
  initScramble, nextScrambleWord, checkScrambleAnswer, endScramble,
};
