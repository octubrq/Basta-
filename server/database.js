const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'basta.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL COLLATE NOCASE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_points INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    game_type TEXT NOT NULL,
    rounds INTEGER,
    player_count INTEGER
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

// Create default admin if not exists
const bcrypt = require('bcryptjs');
const existing = db.prepare('SELECT id FROM admin WHERE username = ?').get('javier');
if (!existing) {
  const hash = bcrypt.hashSync('1234', 10);
  db.prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run('javier', hash);
  console.log('👑 Admin "javier" created');
}

// Contraseña de solo por defecto = "1234" (para que no se olvide y sobreviva a
// los redespliegues de Railway, donde la BD se recrea). El admin puede cambiarla.
if (!getSetting('solo_password_hash')) {
  setSetting('solo_password_hash', bcrypt.hashSync('1234', 10));
  console.log('🔑 Contraseña de solo por defecto: 1234');
}

module.exports = db;
module.exports.getSetting = getSetting;
module.exports.setSetting = setSetting;
