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
const engine = require('./engine');

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
app.post('/api/player/solo', (req, res) => {
  const r = auth.playerSolo(req.body.name, req.body.password);
  if (r.error) return res.status(401).json(r); res.json(r);
});
app.get('/api/status', (req, res) => {
  res.json({ active: G.game.active, soloEnabled: auth.isSoloPasswordSet() });
});
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../client/build/index.html')); });

// pingTimeout alto: cuando un móvil bloquea la pantalla deja de responder a los
// pings; con 120s el socket sobrevive al bloqueo y el jugador no cae de la partida.
const io = new Server(server, { cors: { origin: '*' }, pingTimeout: 120000, pingInterval: 20000 });
engine.attach(io);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  const user = auth.verifyToken(token);
  if (!user) return next(new Error('Invalid token'));
  socket.user = user;
  next();
});

function emitState() { io.emit('game:state', G.getState()); }

io.on('connection', (socket) => {
  const u = socket.user;
  console.log(`🔌 ${u.name} (${u.id}, ${u.role}${u.solo ? '/solo' : ''}) connected`);

  // ===== Reconexión =====
  if (G.game.players.has(u.id)) {
    G.reconnectPlayer(u.id);
    const p = G.game.players.get(u.id);
    if (p) p.socketId = socket.id;
    socket.emit('reconnected', { state: G.getState(), ...engine.reconnectData() });
    emitState();
    console.log(`🔄 ${u.name} reconnected`);
  } else if (G.game.active || u.role === 'admin' || u.solo) {
    G.addPlayer(u);
    const p = G.game.players.get(u.id);
    if (p) p.socketId = socket.id;
    emitState();
    io.emit('player:joined', { name: u.name });
  } else {
    socket.emit('error:message', 'El juego no está activo');
    return;
  }

  // ===== Admin: puerta y config =====
  socket.on('admin:activate', () => {
    if (u.role !== 'admin') return;
    G.activate(u);
    const p = G.game.players.get(u.id); if (p) p.socketId = socket.id;
    emitState();
    console.log(`✅ Puerta abierta por ${u.name}`);
  });

  socket.on('admin:deactivate', () => {
    if (u.role !== 'admin') return;
    G.deactivate();
    emitState();
  });

  socket.on('admin:config', (cfg = {}) => {
    if (u.role !== 'admin') return;
    const c = G.game.config;
    if (cfg.categoriesPerRound) c.categoriesPerRound = Math.min(10, Math.max(4, cfg.categoriesPerRound));
    if (cfg.mode) c.mode = cfg.mode;
    if (cfg.endMode) c.endMode = cfg.endMode;
    if (cfg.scrambleMinutes) c.scrambleMinutes = Math.min(10, Math.max(1, cfg.scrambleMinutes));
    if (cfg.scrambleDifficulty) c.scrambleDifficulty = cfg.scrambleDifficulty;
    emitState();
  });

  socket.on('admin:set_solo_password', ({ password } = {}) => {
    if (u.role !== 'admin') return;
    const r = auth.setSoloPassword(password);
    if (r.error) return socket.emit('error:message', r.error);
    socket.emit('info:message', '🔑 Contraseña de solo guardada');
    emitState();
  });

  // ===== Partida =====
  socket.on('match:start', (cfg = {}) => {
    let mode;
    if (u.role === 'admin') mode = cfg.solo ? 'solo' : 'multi';
    else if (u.solo) mode = 'solo';
    else return socket.emit('error:message', 'No estás autorizado a iniciar partida');

    if (mode === 'multi' && !G.game.active) return socket.emit('error:message', 'Abre la puerta primero');

    const r = engine.startMatch(cfg, mode, u.id);
    if (r.error) return socket.emit('error:message', r.error);
    console.log(`🎮 Partida ${mode} iniciada por ${u.name}: [${(cfg.pruebas || []).join(', ')}] x${cfg.rounds} (${cfg.order})`);
    emitState();
  });

  // Pausa en instrucciones: cualquier jugador
  socket.on('match:pause_toggle', () => engine.togglePause(u.id));
  // Pausa durante el juego: solo admin
  socket.on('admin:pause_toggle', () => { if (u.role === 'admin') engine.toggleAdminPause(); });

  socket.on('round:next', () => {
    const m = G.game.match;
    if (u.role === 'admin' || (m && m.mode === 'solo' && m.starterId === u.id)) engine.nextRound();
  });

  socket.on('round:skip', () => {
    const m = G.game.match;
    if (u.role === 'admin' || (m && m.mode === 'solo' && m.starterId === u.id)) engine.skip();
  });

  socket.on('match:reset', () => {
    const m = G.game.match;
    if (u.role === 'admin' || (m && m.starterId === u.id)) { engine.resetMatch(); emitState(); }
  });

  // ===== Eventos de prueba (se enrutan a la prueba activa) =====
  const forward = (event) => (payload) => engine.handleEvent(event, payload, u.id);
  socket.on('player:answers', forward('player:answers'));
  socket.on('player:basta', forward('player:basta'));
  socket.on('scramble:answer', forward('scramble:answer'));

  // ===== Desconexión =====
  socket.on('disconnect', () => {
    console.log(`❌ ${u.name} disconnected`);
    const { adminLeft } = G.removePlayer(u.id);
    if (adminLeft) {
      engine.resetMatch();
      io.emit('admin:left', { message: 'El admin ha salido — juego cerrado' });
    }
    emitState();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║            ¡BASTA! Game Server v3        ║
  ║   🎮 http://localhost:${PORT}
  ║   🤖 AI: ${process.env.ANTHROPIC_API_KEY ? (process.env.CLAUDE_MODEL || 'claude-haiku-4-5') + ' ✅' : '❌ Set ANTHROPIC_API_KEY'}
  ╚══════════════════════════════════════════╝
  `);
});
