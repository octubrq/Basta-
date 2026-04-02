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

function playerJoin(name) {
  if (!name || name.trim().length < 2) return { error: 'Nombre mínimo 2 caracteres' };
  name = name.trim();
  let row = db.prepare('SELECT * FROM players WHERE name = ?').get(name);
  if (!row) {
    const r = db.prepare('INSERT INTO players (name) VALUES (?)').run(name);
    row = { id: r.lastInsertRowid, name, total_points: 0, games_played: 0 };
  }
  const id = `player_${row.id}`;
  const token = jwt.sign({ id, name: row.name, role: 'player' }, JWT_SECRET, { expiresIn: '7d' });
  return { user: { id, name: row.name, role: 'player', total_points: row.total_points }, token };
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
      return { id: `player_${row.id}`, name: row.name, role: 'player' };
    }
  } catch { return null; }
}

module.exports = { adminRegister, adminLogin, playerJoin, verifyToken };
