const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'admin.db.json');

// sql.js はメモリ上で動作するため、JSONファイルに永続化する
let db;
let dbData = { users: [], blogs: [], settings: [], login_logs: [], _seq: { users: 0, blogs: 0, login_logs: 0 } };

function loadData() {
  if (fs.existsSync(DB_PATH)) {
    try { dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch {}
  }
  if (!dbData.settings)    dbData.settings    = [];
  if (!dbData.login_logs)  dbData.login_logs  = [];
  if (!dbData._seq)        dbData._seq        = { users: 0, blogs: 0, login_logs: 0 };
  if (!dbData._seq.login_logs) dbData._seq.login_logs = 0;
}

function saveData() {
  fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), 'utf8');
}

loadData();

// シーケンスID採番
function nextId(table) {
  dbData._seq[table] = (dbData._seq[table] || 0) + 1;
  return dbData._seq[table];
}

// 初期管理者アカウント
if (!dbData.users.find(u => u.username === 'admin')) {
  const hash = bcrypt.hashSync('password', 10);
  dbData.users.push({ id: nextId('users'), username: 'admin', password: hash, created_at: new Date().toISOString() });
  saveData();
  console.log('[DB] 初期管理者アカウントを作成しました (username: admin, password: password)');
}

// ─── DB API（better-sqlite3 互換インターフェース） ───────────
const database = {
  // ユーザー
  getUserByUsername: (username) => dbData.users.find(u => u.username === username) || null,
  getUserById: (id) => dbData.users.find(u => u.id === id) || null,
  updatePassword: (id, hash) => { const u = dbData.users.find(u => u.id === id); if (u) { u.password = hash; saveData(); } },
  updateUsername: (id, username) => { const u = dbData.users.find(u => u.id === id); if (u) { u.username = username; saveData(); } },
  getUserByUsernameExcept: (username, id) => dbData.users.find(u => u.username === username && u.id !== id) || null,

  // ブログ
  getBlogs: () => dbData.blogs.map(b => ({ ...b, content: undefined })).sort((a, b) => b.updated_at > a.updated_at ? 1 : -1),
  getBlogById: (id) => dbData.blogs.find(b => b.id === id) || null,
  createBlog: (title, bg_color, content) => {
    const now = new Date().toISOString();
    const blog = { id: nextId('blogs'), title, bg_color, content: JSON.stringify(content), created_at: now, updated_at: now };
    dbData.blogs.push(blog); saveData(); return blog.id;
  },
  updateBlog: (id, title, bg_color, content) => {
    const b = dbData.blogs.find(b => b.id === id);
    if (b) { b.title = title; b.bg_color = bg_color; b.content = JSON.stringify(content); b.updated_at = new Date().toISOString(); saveData(); }
  },
  deleteBlog: (id) => { dbData.blogs = dbData.blogs.filter(b => b.id !== id); saveData(); },

  // 設定
  getSetting: (key) => { const s = dbData.settings.find(s => s.key === key); return s ? s.value : null; },
  setSetting: (key, value) => {
    const s = dbData.settings.find(s => s.key === key);
    if (s) s.value = value; else dbData.settings.push({ key, value });
    saveData();
  },

  // ログイン履歴
  addLoginLog: (username, success, ip) => {
    dbData.login_logs.push({ id: nextId('login_logs'), username, success: success ? 1 : 0, ip, logged_at: new Date().toISOString() });
    saveData();
  },
  getLoginHistory: () => [...dbData.login_logs].sort((a, b) => b.logged_at > a.logged_at ? 1 : -1).slice(0, 50),
};

module.exports = database;
