const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'basta-game-secret-2024';

function adminRegister(username, password) {
  if (!username || !password) return { error: 'Usuario y contraseña obligatorios' };
  const existing = db.prepare('SELECT id FROM admin WHERE username = ?').get(username);
  if (existing) return { error: 'Admin ya existe' };
  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run(username, hash);
  const id = `admin_${r.lastInsertRowid}`;
  const token = jwt.sign({ id, name: username, role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
  return { user: { id, name: username, role: 'admin' }, token };
}

function adminLogin(username, password) {
  if (!username || !password) return { error: 'Usuario y contraseña obligatorios' };
  const row = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return { error: 'Credenciales incorrectas' };
  const id = `admin_${row.id}`;
  const token = jwt.sign({ id, name: row.username, role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
  return { user: { id, name: row.username, role: 'admin' }, token };
}

function getOrCreatePlayer(name) {
  let row = db.prepare('SELECT * FROM players WHERE name = ?').get(name);
  if (!row) {
    const r = db.prepare('INSERT INTO players (name) VALUES (?)').run(name);
    row = { id: r.lastInsertRowid, name, total_points: 0, games_played: 0 };
  }
  return row;
}

function playerJoin(name) {
  if (!name || name.trim().length < 2) return { error: 'Nombre mínimo 2 caracteres' };
  name = name.trim();
  const row = getOrCreatePlayer(name);
  const id = `player_${row.id}`;
  const token = jwt.sign({ id, name: row.name, role: 'player' }, JWT_SECRET, { expiresIn: '7d' });
  return { user: { id, name: row.name, role: 'player', total_points: row.total_points }, token };
}

// ===== Modo solo (protegido por contraseña que el admin configura) =====
function isSoloPasswordSet() {
  return !!db.getSetting('solo_password_hash');
}

function setSoloPassword(password) {
  if (!password || password.length < 3) return { error: 'Contraseña mínimo 3 caracteres' };
  db.setSetting('solo_password_hash', bcrypt.hashSync(password, 10));
  return { ok: true };
}

function playerSolo(name, password) {
  if (!name || name.trim().length < 2) return { error: 'Nombre mínimo 2 caracteres' };
  const hash = db.getSetting('solo_password_hash');
  if (!hash) return { error: 'El modo solo no está habilitado todavía' };
  if (!password || !bcrypt.compareSync(password, hash)) return { error: 'Contraseña de solo incorrecta' };
  name = name.trim();
  const row = getOrCreatePlayer(name);
  const id = `player_${row.id}`;
  const token = jwt.sign({ id, name: row.name, role: 'player', solo: true }, JWT_SECRET, { expiresIn: '7d' });
  return { user: { id, name: row.name, role: 'player', solo: true, total_points: row.total_points }, token };
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === 'admin') {
      const dbId = parseInt(decoded.id.replace('admin_', ''));
      const row = db.prepare('SELECT id, username FROM admin WHERE id = ?').get(dbId);
      if (!row) return null;
      return { id: `admin_${row.id}`, name: row.username, role: 'admin' };
    } else {
      const dbId = parseInt(decoded.id.replace('player_', ''));
      const row = db.prepare('SELECT id, name FROM players WHERE id = ?').get(dbId);
      if (!row) return null;
      return { id: `player_${row.id}`, name: row.name, role: 'player', solo: !!decoded.solo };
    }
  } catch { return null; }
}

module.exports = {
  adminRegister, adminLogin, playerJoin, verifyToken,
  isSoloPasswordSet, setSoloPassword, playerSolo,
};
