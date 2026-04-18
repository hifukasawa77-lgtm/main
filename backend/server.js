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

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// ミドルウェア
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// ファイルアップロード設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('画像ファイルのみアップロード可能です'));
  }
});

// JWT 認証ミドルウェア
function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: '認証が必要です' });
  try { req.user = jwt.verify(auth.slice(7), JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'トークンが無効または期限切れです' }); }
}

// ─── 認証 API ───────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (!username || !password) return res.status(400).json({ error: 'IDとパスワードを入力してください' });

  const user = db.getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    db.addLoginLog(username, false, ip);
    return res.status(401).json({ error: 'IDまたはパスワードが正しくありません' });
  }
  db.addLoginLog(username, true, ip);
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, username: user.username });
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: '現在のパスワードと新しいパスワードを入力してください' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'パスワードは8文字以上で設定してください' });

  const user = db.getUserById(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ error: '現在のパスワードが正しくありません' });

  db.updatePassword(req.user.id, bcrypt.hashSync(newPassword, 10));
  res.json({ message: 'パスワードを変更しました' });
});

// PUT /api/auth/username
app.put('/api/auth/username', authMiddleware, (req, res) => {
  const { newUsername, currentPassword } = req.body;
  if (!newUsername || !currentPassword) return res.status(400).json({ error: '新しいユーザー名と現在のパスワードを入力してください' });
  if (newUsername.length < 3) return res.status(400).json({ error: 'ユーザー名は3文字以上で設定してください' });

  const user = db.getUserById(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ error: '現在のパスワードが正しくありません' });
  if (db.getUserByUsernameExcept(newUsername, req.user.id)) return res.status(409).json({ error: 'そのユーザー名は既に使用されています' });

  db.updateUsername(req.user.id, newUsername);
  res.json({ message: 'ユーザー名を変更しました' });
});

// GET /api/auth/login-history
app.get('/api/auth/login-history', authMiddleware, (req, res) => {
  res.json(db.getLoginHistory());
});

// ─── ブログ API ────────────────────────────────────────────

app.get('/api/blogs', authMiddleware, (req, res) => {
  const blogs = db.getBlogs().map(b => ({ id: b.id, title: b.title, bg_color: b.bg_color, created_at: b.created_at, updated_at: b.updated_at }));
  res.json(blogs);
});

app.get('/api/blogs/:id', authMiddleware, (req, res) => {
  const blog = db.getBlogById(+req.params.id);
  if (!blog) return res.status(404).json({ error: 'ブログが見つかりません' });
  res.json({ ...blog, content: JSON.parse(blog.content || '[]') });
});

app.post('/api/blogs', authMiddleware, (req, res) => {
  const { title = '無題', bg_color = '#0d0d1a', content = [] } = req.body;
  const id = db.createBlog(title, bg_color, content);
  res.status(201).json({ id });
});

app.put('/api/blogs/:id', authMiddleware, (req, res) => {
  const { title, bg_color, content } = req.body;
  if (!db.getBlogById(+req.params.id)) return res.status(404).json({ error: 'ブログが見つかりません' });
  db.updateBlog(+req.params.id, title, bg_color, content);
  res.json({ message: '保存しました' });
});

app.delete('/api/blogs/:id', authMiddleware, (req, res) => {
  db.deleteBlog(+req.params.id);
  res.json({ message: '削除しました' });
});

// ─── ファイルアップロード API ──────────────────────────────

app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルが選択されていません' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get('/api/uploads', authMiddleware, (req, res) => {
  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f))
    .map(f => ({ filename: f, url: `/uploads/${f}` }));
  res.json(files);
});

app.delete('/api/uploads/:filename', authMiddleware, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'ファイルが見つかりません' });
  fs.unlinkSync(filepath);
  res.json({ message: '削除しました' });
});

// ─── 設定 API ─────────────────────────────────────────────

app.get('/api/settings/dashboard', (req, res) => {
  const val = db.getSetting('dashboard');
  try { res.json(val ? JSON.parse(val) : {}); } catch { res.json({}); }
});

app.put('/api/settings/dashboard', authMiddleware, (req, res) => {
  db.setSetting('dashboard', JSON.stringify(req.body));
  res.json({ message: '設定を保存しました' });
});

app.get('/api/settings/smarthome', authMiddleware, (req, res) => {
  const val = db.getSetting('smarthome');
  try { res.json(val ? JSON.parse(val) : {}); } catch { res.json({}); }
});

app.put('/api/settings/smarthome', authMiddleware, (req, res) => {
  db.setSetting('smarthome', JSON.stringify(req.body));
  res.json({ message: '設定を保存しました' });
});

// ─── ヘルスチェック ───────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`[Server] http://localhost:${PORT} で起動しました`);
  console.log('[Server] Ctrl+C で停止');
});
