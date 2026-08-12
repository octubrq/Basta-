const path = require('path');
// Carga server/.env en local (dev). En Railway no existe el archivo y usa las
// variables de entorno reales, así que el try/catch lo ignora sin romper nada.
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch {}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const auth = require('./auth');
const G = require('./rooms');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors()); app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

app.post('/api/admin/register', (req, res) => {
  const r = auth.adminRegister(req.body.username, req.body.password);
  if (r.error) return res.status(400).json(r); res.json(r);
});
app.post('/api/admin/login', (req, res) => {
  const r = auth.adminLogin(req.body.username, req.body.password);
  if (r.error) return res.status(401).json(r); res.json(r);
});
app.post('/api/player/join', (req, res) => {
  const r = auth.playerJoin(req.body.name);
  if (r.error) return res.status(400).json(r); res.json(r);
});
app.get('/api/status', (req, res) => { res.json({ active: G.game.active }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../client/build/index.html')); });

// pingTimeout alto: cuando un móvil bloquea la pantalla deja de responder a los
// pings; con 120s el socket sobrevive al bloqueo y el jugador no cae de la partida.
const io = new Server(server, { cors: { origin: '*' }, pingTimeout: 120000, pingInterval: 20000 });

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  const user = auth.verifyToken(token);
  if (!user) return next(new Error('Invalid token'));
  socket.user = user;
  next();
});

function broadcast(event, data) { io.emit(event, data); }
function emitState() { broadcast('game:state', G.getState()); }
function emitStandings() { broadcast('scoreboard:update', G.getStandings()); }

io.on('connection', (socket) => {
  const u = socket.user;
  console.log(`🔌 ${u.name} (${u.id}, ${u.role}) connected`);

  // Auto-reconnect
  if (G.game.players.has(u.id)) {
    G.reconnectPlayer(u.id);
    const p = G.game.players.get(u.id);
    if (p) p.socketId = socket.id;
    socket.emit('reconnected', {
      state: G.getState(),
      session: G.game.session.state,
      sessionType: G.game.session.type,
      roundData: G.game.session.roundData,
      standings: G.getStandings(),
      lastResult: G.game.session.roundHistory[G.game.session.roundHistory.length - 1] || null,
      scrambleData: G.game.session.scrambleCurrentWord ? {
        scrambled: G.game.session.scrambleScrambled,
        wordNumber: G.game.session.scrambleIndex,
      } : null,
    });
    emitState();
    console.log(`🔄 ${u.name} reconnected`);
  } else if (G.game.active || u.role === 'admin') {
    G.addPlayer(u);
    const p = G.game.players.get(u.id);
    if (p) p.socketId = socket.id;
    emitState();
    broadcast('player:joined', { name: u.name });
  } else {
    socket.emit('error:message', 'El juego no está activo');
    return;
  }

  // ===== ADMIN CONTROLS =====
  socket.on('admin:activate', () => {
    if (u.role !== 'admin') return;
    G.activate(u);
    emitState();
    console.log(`✅ Game activated by ${u.name}`);
  });

  socket.on('admin:deactivate', () => {
    if (u.role !== 'admin') return;
    G.deactivate();
    emitState();
    console.log(`🔒 Game deactivated`);
  });

  socket.on('admin:config', (config) => {
    if (u.role !== 'admin') return;
    if (config.rounds) G.game.config.rounds = Math.min(15, Math.max(3, config.rounds));
    if (config.categoriesPerRound) G.game.config.categoriesPerRound = Math.min(10, Math.max(4, config.categoriesPerRound));
    if (config.mode) G.game.config.mode = config.mode;
    if (config.endMode) G.game.config.endMode = config.endMode;
    if (config.scrambleMinutes) G.game.config.scrambleMinutes = Math.min(10, Math.max(1, config.scrambleMinutes));
    if (config.scrambleDifficulty) G.game.config.scrambleDifficulty = config.scrambleDifficulty;
    emitState();
  });

  // ===== START BASTA =====
  socket.on('game:start_basta', () => {
    if (u.role !== 'admin') return;
    const conn = [...G.game.players.values()].filter(p => p.connected).length;
    if (conn < 2) { socket.emit('error:message', 'Mínimo 2 jugadores'); return; }
    G.resetSession();
    G.game.session.type = 'basta';
    startBastaRound();
  });

  // ===== START SCRAMBLE =====
  socket.on('game:start_scramble', async () => {
    if (u.role !== 'admin') return;
    const conn = [...G.game.players.values()].filter(p => p.connected).length;
    if (conn < 2) { socket.emit('error:message', 'Mínimo 2 jugadores'); return; }
    G.resetSession();
    await G.initScramble();

    // Countdown with standings
    broadcast('scramble:countdown', { standings: G.getStandings(), minutes: G.game.config.scrambleMinutes });
    
    setTimeout(() => {
      G.game.session.state = 'playing';
      const word = G.nextScrambleWord();
      broadcast('scramble:start', { ...word, minutes: G.game.config.scrambleMinutes });

      // Main timer
      const ms = G.game.config.scrambleMinutes * 60 * 1000;
      G.game.session.scrambleTimer = setTimeout(() => {
        const results = G.endScramble();
        broadcast('scramble:end', results);
        emitStandings();
      }, ms);
    }, 3500);
  });

  // ===== SCRAMBLE ANSWER =====
  socket.on('scramble:answer', (answer) => {
    if (G.game.session.state !== 'playing' || G.game.session.type !== 'scramble') return;
    const correct = G.checkScrambleAnswer(u.id, answer);
    if (correct) {
      broadcast('scramble:correct', { playerId: u.id, playerName: u.name, word: G.game.session.scrambleCurrentWord });
      emitStandings();
      // Next word
      setTimeout(() => {
        const next = G.nextScrambleWord();
        if (next) broadcast('scramble:word', next);
        else {
          if (G.game.session.scrambleTimer) clearTimeout(G.game.session.scrambleTimer);
          broadcast('scramble:end', G.endScramble());
        }
      }, 1500);
    }
  });

  // ===== BASTA EVENTS =====
  socket.on('player:basta', (answers) => {
    if (G.game.session.state !== 'playing' || G.game.session.type !== 'basta') return;
    const result = G.playerBasta(u.id, answers || {});
    if (!result) return;
    if (result.error) { socket.emit('error:message', result.error); return; }
    G.submitBastaAnswers(u.id, answers || {});
    broadcast('round:basta', { playerId: u.id, playerName: u.name, graceMs: result.graceMs, hadEmpty: result.emptyCount > 0 });
    if (result.graceMs === 0) collectAndScore();
    else G.game.session.graceTimer = setTimeout(collectAndScore, result.graceMs);
  });

  socket.on('player:answers', (answers) => {
    if (G.game.session.type !== 'basta') return;
    G.submitBastaAnswers(u.id, answers);
    if (G.allBastaAnswersIn() && ['grace', 'reviewing'].includes(G.game.session.state)) {
      if (G.game.session.graceTimer) { clearTimeout(G.game.session.graceTimer); G.game.session.graceTimer = null; }
      scoreRound();
    }
  });

  socket.on('round:next', () => {
    if (u.role !== 'admin' || G.game.session.state !== 'results') return;
    if (G.game.session.currentRound >= G.game.config.rounds) {
      G.game.session.state = 'finished';
      broadcast('game:finished', { standings: G.getStandings(), history: G.game.session.roundHistory });
    } else startBastaRound();
  });

  socket.on('game:reset', () => {
    if (u.role !== 'admin') return;
    G.resetSession();
    emitState();
  });

  // ===== DISCONNECT =====
  socket.on('disconnect', () => {
    console.log(`❌ ${u.name} disconnected`);
    const { adminLeft } = G.removePlayer(u.id);
    if (adminLeft) {
      broadcast('admin:left', { message: 'El admin ha salido — juego cerrado' });
    }
    emitState();
  });
});

// ===== BASTA FLOW =====
function startBastaRound() {
  const rd = G.startBastaRound();
  if (!rd) { broadcast('game:finished', { standings: G.getStandings(), history: G.game.session.roundHistory }); return; }
  
  console.log(`🎯 Round ${G.game.session.currentRound}: ${rd.letter}${rd.comboLetter ? '+' + rd.comboLetter : ''} [${rd.categories.join(', ')}]`);
  
  // Show standings + countdown
  broadcast('round:countdown', { round: G.game.session.currentRound, totalRounds: G.game.config.rounds, standings: G.getStandings() });

  setTimeout(() => {
    const pr = G.beginBastaPlay();
    broadcast('round:start', { ...rd, endMode: G.game.config.endMode });
    if (pr.fixedTimeout) G.game.session.fixedTimer = setTimeout(() => {
      if (G.game.session.state === 'playing') collectAndScore();
    }, pr.fixedTimeout);
  }, 3500);
}

function collectAndScore() {
  if (G.game.session.state === 'results' || G.game.session.state === 'validating') return;
  G.game.session.state = 'reviewing';
  broadcast('round:force_submit');
  broadcast('round:collecting');
  setTimeout(scoreRound, 3000);
}

async function scoreRound() {
  if (G.game.session.state === 'results') return;
  broadcast('round:validating');
  const results = await G.endBastaRound();
  broadcast('round:results', results);
  emitStandings();
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║            ¡BASTA! Game Server v2        ║
  ║                                          ║
  ║   🎮 http://localhost:${PORT}               ║
  ║   🤖 AI: ${process.env.ANTHROPIC_API_KEY ? (process.env.CLAUDE_MODEL || 'claude-haiku-4-5') + ' ✅' : '❌ Set ANTHROPIC_API_KEY'}
  ║   👑 Admin: register at /api/admin/register
  ╚══════════════════════════════════════════╝
  `);
});
