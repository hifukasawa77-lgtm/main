const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('./database');

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'hide-admin-secret-key-change-in-production';
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// ミドルウェア
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500', 'null'], credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// ファイルアップロード設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safeName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('画像ファイルのみアップロード可能です'));
  }
});

// JWT 認証ミドルウェア
function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'トークンが無効または期限切れです' });
  }
}

// ─── 認証 API ───────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (!username || !password) {
    return res.status(400).json({ error: 'IDとパスワードを入力してください' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    db.prepare('INSERT INTO login_logs (username, success, ip) VALUES (?, 0, ?)').run(username, ip);
    return res.status(401).json({ error: 'IDまたはパスワードが正しくありません' });
  }

  db.prepare('INSERT INTO login_logs (username, success, ip) VALUES (?, 1, ?)').run(username, ip);
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, username: user.username });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '現在のパスワードと新しいパスワードを入力してください' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'パスワードは8文字以上で設定してください' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: '現在のパスワードが正しくありません' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'パスワードを変更しました' });
});

// GET /api/auth/me — トークン検証
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username });
});

// PUT /api/auth/username — ユーザー名変更
app.put('/api/auth/username', authMiddleware, (req, res) => {
  const { newUsername, currentPassword } = req.body;
  if (!newUsername || !currentPassword) {
    return res.status(400).json({ error: '新しいユーザー名と現在のパスワードを入力してください' });
  }
  if (newUsername.length < 3) {
    return res.status(400).json({ error: 'ユーザー名は3文字以上で設定してください' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: '現在のパスワードが正しくありません' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, req.user.id);
  if (existing) {
    return res.status(409).json({ error: 'そのユーザー名は既に使用されています' });
  }
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, req.user.id);
  res.json({ message: 'ユーザー名を変更しました' });
});

// GET /api/auth/login-history — ログイン履歴（直近50件）
app.get('/api/auth/login-history', authMiddleware, (req, res) => {
  const logs = db.prepare(
    'SELECT username, success, ip, logged_at FROM login_logs ORDER BY logged_at DESC LIMIT 50'
  ).all();
  res.json(logs);
});

// ─── ブログ API ────────────────────────────────────────────

// GET /api/blogs — 一覧取得
app.get('/api/blogs', authMiddleware, (req, res) => {
  const blogs = db.prepare('SELECT id, title, bg_color, created_at, updated_at FROM blogs ORDER BY updated_at DESC').all();
  res.json(blogs);
});

// GET /api/blogs/:id — 詳細取得
app.get('/api/blogs/:id', authMiddleware, (req, res) => {
  const blog = db.prepare('SELECT * FROM blogs WHERE id = ?').get(req.params.id);
  if (!blog) return res.status(404).json({ error: 'ブログが見つかりません' });
  blog.content = JSON.parse(blog.content);
  res.json(blog);
});

// POST /api/blogs — 新規作成
app.post('/api/blogs', authMiddleware, (req, res) => {
  const { title = '無題', bg_color = '#0d0d1a', content = [] } = req.body;
  const result = db.prepare(
    'INSERT INTO blogs (title, bg_color, content) VALUES (?, ?, ?)'
  ).run(title, bg_color, JSON.stringify(content));
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/blogs/:id — 更新
app.put('/api/blogs/:id', authMiddleware, (req, res) => {
  const { title, bg_color, content } = req.body;
  const blog = db.prepare('SELECT id FROM blogs WHERE id = ?').get(req.params.id);
  if (!blog) return res.status(404).json({ error: 'ブログが見つかりません' });

  db.prepare(
    'UPDATE blogs SET title = ?, bg_color = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(title, bg_color, JSON.stringify(content), req.params.id);
  res.json({ message: '保存しました' });
});

// DELETE /api/blogs/:id — 削除
app.delete('/api/blogs/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM blogs WHERE id = ?').run(req.params.id);
  res.json({ message: '削除しました' });
});

// ─── ファイルアップロード API ──────────────────────────────

// POST /api/upload
app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルが選択されていません' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// GET /api/uploads — アップロード済み画像一覧
app.get('/api/uploads', authMiddleware, (req, res) => {
  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f))
    .map(f => ({ filename: f, url: `/uploads/${f}` }));
  res.json(files);
});

// DELETE /api/uploads/:filename — ファイル削除
app.delete('/api/uploads/:filename', authMiddleware, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'ファイルが見つかりません' });
  }
  fs.unlinkSync(filepath);
  res.json({ message: '削除しました' });
});

// ─── 設定 API ─────────────────────────────────────────────

// GET /api/settings/dashboard — ダッシュボード表示設定取得
app.get('/api/settings/dashboard', (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'dashboard'").get();
  if (!row) return res.json({});
  try { res.json(JSON.parse(row.value)); } catch { res.json({}); }
});

// PUT /api/settings/dashboard — ダッシュボード表示設定保存
app.put('/api/settings/dashboard', authMiddleware, (req, res) => {
  const value = JSON.stringify(req.body);
  db.prepare("INSERT INTO settings (key, value) VALUES ('dashboard', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(value);
  res.json({ message: '設定を保存しました' });
});

// GET /api/settings/smarthome — スマートホームメモ取得
app.get('/api/settings/smarthome', authMiddleware, (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'smarthome'").get();
  if (!row) return res.json({});
  try { res.json(JSON.parse(row.value)); } catch { res.json({}); }
});

// PUT /api/settings/smarthome — スマートホームメモ保存
app.put('/api/settings/smarthome', authMiddleware, (req, res) => {
  const value = JSON.stringify(req.body);
  db.prepare("INSERT INTO settings (key, value) VALUES ('smarthome', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(value);
  res.json({ message: '設定を保存しました' });
});

// ─── ヘルスチェック ───────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`[Server] http://localhost:${PORT} で起動しました`);
  console.log('[Server] Ctrl+C で停止');
});
