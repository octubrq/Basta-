const { CATEGORY_POOL } = require('./categories');

// Estado global (sala única controlada por el admin). La lógica de la partida
// vive en engine.js; aquí solo el estado de jugadores, la puerta y la config.
let game = {
  active: false,        // puerta abierta para jugadores (multijugador)
  players: new Map(),   // id -> { id, name, socketId, connected, totalScore, role, solo, profile }
  adminId: null,
  config: {             // parámetros de las pruebas (ajustables por el admin)
    categoriesPerRound: 6,
    mode: 'classic',    // classic | combo (Basta)
    endMode: 'basta_5s',
    scrambleMinutes: 2,
    scrambleDifficulty: 'medium',
  },
  match: null,          // partida en curso (la crea engine.js)
  categoryPool: { ...CATEGORY_POOL },
};

function getStandings() {
  return [...game.players.values()]
    .filter(p => p.connected)
    .map(p => ({ id: p.id, name: p.name, totalScore: p.totalScore, connected: p.connected, profile: p.profile || 'normal' }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

function getState() {
  const m = game.match;
  return {
    active: game.active,
    adminId: game.adminId,
    config: game.config,
    soloPasswordSet: !!require('./database').getSetting('solo_password_hash'),
    pruebas: require('./pruebas').metaList(),
    match: m ? {
      mode: m.mode, state: m.state, roundIndex: m.roundIndex, totalRounds: m.config.rounds,
      currentPrueba: m.currentPrueba, config: m.config, starterId: m.starterId, adminPaused: m.adminPaused,
    } : null,
    players: [...game.players.values()].map(p => ({
      id: p.id, name: p.name, connected: p.connected,
      totalScore: p.totalScore, role: p.role, solo: !!p.solo, profile: p.profile || 'normal',
    })),
    categoryPool: Object.entries(game.categoryPool).map(([n, d]) => ({ name: n, group: d.group, icon: d.icon })),
  };
}

// Admin abre la puerta
function activate(adminUser) {
  game.active = true;
  game.adminId = adminUser.id;
  if (!game.players.has(adminUser.id)) {
    game.players.set(adminUser.id, {
      id: adminUser.id, name: adminUser.name, socketId: null,
      connected: true, totalScore: 0, role: 'admin', solo: false, profile: 'normal',
    });
  } else {
    const p = game.players.get(adminUser.id);
    p.connected = true; p.role = 'admin';
  }
}

function deactivate() { game.active = false; }

function addPlayer(user) {
  const id = user.id;
  if (!game.players.has(id)) {
    game.players.set(id, {
      id, name: user.name, socketId: null,
      connected: true, totalScore: 0,
      role: user.role || 'player', solo: !!user.solo, profile: 'normal',
    });
  } else {
    const p = game.players.get(id);
    p.connected = true; p.name = user.name;
    if (user.solo) p.solo = true;
  }
  return { ok: true };
}

function removePlayer(id) {
  const p = game.players.get(id);
  if (p) p.connected = false;
  if (id === game.adminId) {
    game.active = false;
    return { adminLeft: true };
  }
  return { adminLeft: false };
}

function reconnectPlayer(id) {
  const p = game.players.get(id);
  if (p) { p.connected = true; return true; }
  return false;
}

module.exports = {
  game, getState, getStandings,
  activate, deactivate, addPlayer, removePlayer, reconnectPlayer,
};
