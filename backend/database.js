const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'admin.db');
const db = new Database(DB_PATH);

// WAL モードで並列読み取りを有効化
db.pragma('journal_mode = WAL');

// テーブル作成
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT    UNIQUE NOT NULL,
    password TEXT    NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blogs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL DEFAULT '無題',
    bg_color   TEXT    NOT NULL DEFAULT '#0d0d1a',
    content    TEXT    NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT NOT NULL,
    success   INTEGER NOT NULL DEFAULT 0,
    ip        TEXT,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 初期管理者アカウント（存在しない場合のみ）
const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!admin) {
  const hash = bcrypt.hashSync('password', 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('[DB] 初期管理者アカウントを作成しました (username: admin, password: password)');
}

module.exports = db;
