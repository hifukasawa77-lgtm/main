const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'admin.db');

let db;

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
}

async function init() {
  const SQL = await initSqlJs();
  const buf = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  db = buf ? new SQL.Database(buf) : new SQL.Database();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      bg_color TEXT NOT NULL DEFAULT '#0d0d1a',
      content TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      success INTEGER NOT NULL,
      ip TEXT,
      logged_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT,
      visited_at TEXT NOT NULL
    );
  `);

  if (!queryOne('SELECT 1 FROM users WHERE username=?', ['admin'])) {
    run('INSERT INTO users (username,password,created_at) VALUES (?,?,?)',
      ['admin', bcrypt.hashSync('password', 10), new Date().toISOString()]);
    console.log('[DB] 初期管理者アカウントを作成しました (username: admin, password: password)');
  }
}

module.exports = {
  init,

  getUserByUsername: (username) => queryOne('SELECT * FROM users WHERE username=?', [username]),
  getUserById: (id) => queryOne('SELECT * FROM users WHERE id=?', [id]),
  updatePassword: (id, hash) => run('UPDATE users SET password=? WHERE id=?', [hash, id]),
  updateUsername: (id, username) => run('UPDATE users SET username=? WHERE id=?', [username, id]),
  getUserByUsernameExcept: (username, id) =>
    queryOne('SELECT * FROM users WHERE username=? AND id!=?', [username, id]),

  getBlogs: () => queryAll('SELECT id,title,bg_color,created_at,updated_at FROM blogs ORDER BY updated_at DESC'),
  getBlogById: (id) => queryOne('SELECT * FROM blogs WHERE id=?', [id]),
  createBlog: (title, bg_color, content) => {
    const now = new Date().toISOString();
    run('INSERT INTO blogs (title,bg_color,content,created_at,updated_at) VALUES (?,?,?,?,?)',
      [title, bg_color, JSON.stringify(content), now, now]);
    return db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  },
  updateBlog: (id, title, bg_color, content) => {
    run('UPDATE blogs SET title=?,bg_color=?,content=?,updated_at=? WHERE id=?',
      [title, bg_color, JSON.stringify(content), new Date().toISOString(), id]);
  },
  deleteBlog: (id) => run('DELETE FROM blogs WHERE id=?', [id]),

  getSetting: (key) => queryOne('SELECT value FROM settings WHERE key=?', [key])?.value ?? null,
  setSetting: (key, value) => run('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', [key, value]),

  addLoginLog: (username, success, ip) => {
    run('INSERT INTO login_logs (username,success,ip,logged_at) VALUES (?,?,?,?)',
      [username, success ? 1 : 0, ip || '', new Date().toISOString()]);
  },
  getLoginHistory: () => queryAll('SELECT * FROM login_logs ORDER BY logged_at DESC LIMIT 50'),

  hitAccess: (ip) => {
    const visited_at = new Date().toISOString();
    run('INSERT INTO access_logs (ip,visited_at) VALUES (?,?)', [ip || '-', visited_at]);
    const today = visited_at.slice(0, 10);
    const total = queryOne('SELECT COUNT(*) as c FROM access_logs').c;
    const todayCount = queryOne("SELECT COUNT(*) as c FROM access_logs WHERE visited_at LIKE ?", [today + '%']).c;
    return { total, today: todayCount };
  },
  getAccessCount: () => {
    const today = new Date().toISOString().slice(0, 10);
    const total = queryOne('SELECT COUNT(*) as c FROM access_logs').c;
    const todayCount = queryOne("SELECT COUNT(*) as c FROM access_logs WHERE visited_at LIKE ?", [today + '%']).c;
    return { total, today: todayCount };
  },
  getDailyAccessCount: (days = 7) => {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      const count = queryOne("SELECT COUNT(*) as c FROM access_logs WHERE visited_at LIKE ?", [date + '%']).c;
      result.push({ date, count });
    }
    return result;
  },
};
