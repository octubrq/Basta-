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
`);

// Create default admin if not exists
const bcrypt = require('bcryptjs');
const existing = db.prepare('SELECT id FROM admin WHERE username = ?').get('javier');
if (!existing) {
  const hash = bcrypt.hashSync('1234', 10);
  db.prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run('javier', hash);
  console.log('👑 Admin "javier" created');
}

module.exports = db;
