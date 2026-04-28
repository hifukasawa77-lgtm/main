const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const dns = require('dns').promises;

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

// ─── ネットワーク ARP スキャン ────────────────────────────

// NetBIOS名取得（nbtstat -A）: Windows/Samba/NAS のコンピュータ名
function getNbtstatName(ip) {
  return new Promise(resolve => {
    exec(`nbtstat -A ${ip}`, { encoding: 'utf8', timeout: 2500, shell: 'cmd.exe' }, (err, stdout) => {
      if (err || !stdout) return resolve('');
      // "  COMPUTERNAME      <00>  UNIQUE      Registered" を抽出
      const m = stdout.match(/^\s+([A-Z0-9_\-\.]{1,15})\s+<00>\s+UNIQUE/im);
      resolve(m ? m[1].trim() : '');
    });
  });
}

// MAC OUI → メーカー名テーブル（主要メーカー）
const OUI_MAP = (() => {
  const t = {};
  const entries = [
    // Apple
    ['00:03:93','Apple'],['00:05:02','Apple'],['00:0A:27','Apple'],['00:0A:95','Apple'],
    ['00:1C:B3','Apple'],['00:1E:52','Apple'],['00:1F:5B','Apple'],['00:1F:F3','Apple'],
    ['00:21:E9','Apple'],['00:22:41','Apple'],['00:23:12','Apple'],['00:23:32','Apple'],
    ['00:23:6C','Apple'],['00:24:36','Apple'],['00:25:00','Apple'],['00:25:4B','Apple'],
    ['00:26:08','Apple'],['00:26:B0','Apple'],['00:26:BB','Apple'],['28:CF:DA','Apple'],
    ['3C:07:54','Apple'],['3C:15:C2','Apple'],['40:30:04','Apple'],['40:6C:8F','Apple'],
    ['60:03:08','Apple'],['60:C5:47','Apple'],['60:D9:C7','Apple'],['60:F4:45','Apple'],
    ['70:11:24','Apple'],['70:56:81','Apple'],['74:E2:F5','Apple'],['74:E5:43','Apple'],
    ['78:31:C1','Apple'],['78:9F:70','Apple'],['7C:6D:62','Apple'],['7C:D1:C3','Apple'],
    ['80:65:6D','Apple'],['80:92:9F','Apple'],['84:29:99','Apple'],['84:38:35','Apple'],
    ['88:1F:A1','Apple'],['8C:58:77','Apple'],['90:27:E4','Apple'],['90:B0:ED','Apple'],
    ['94:E9:6A','Apple'],['98:01:A7','Apple'],['9C:20:7B','Apple'],['9C:F3:87','Apple'],
    ['A4:5E:60','Apple'],['A4:B1:97','Apple'],['A4:C3:61','Apple'],['A4:D1:8C','Apple'],
    ['A8:86:DD','Apple'],['AC:29:3A','Apple'],['AC:3C:0B','Apple'],['AC:87:A3','Apple'],
    ['B0:65:BD','Apple'],['B4:18:D1','Apple'],['B8:09:8A','Apple'],['B8:17:C2','Apple'],
    ['B8:44:D9','Apple'],['B8:53:AC','Apple'],['B8:78:2E','Apple'],['B8:FF:61','Apple'],
    ['BC:52:B7','Apple'],['BC:67:78','Apple'],['C8:1E:E7','Apple'],['C8:2A:14','Apple'],
    ['C8:33:4B','Apple'],['C8:B5:B7','Apple'],['CC:08:8D','Apple'],['CC:44:63','Apple'],
    ['D0:23:DB','Apple'],['D4:9A:20','Apple'],['D8:96:95','Apple'],['D8:A2:5E','Apple'],
    ['DC:2B:2A','Apple'],['DC:86:D8','Apple'],['DC:9B:9C','Apple'],['E0:F8:47','Apple'],
    ['E8:06:88','Apple'],['E8:8D:28','Apple'],['F0:18:98','Apple'],['F0:79:60','Apple'],
    ['F0:98:9D','Apple'],['F0:B4:79','Apple'],['F0:D1:A9','Apple'],['F4:0F:24','Apple'],
    ['F4:37:B7','Apple'],['F8:27:93','Apple'],['F8:62:14','Apple'],['FC:25:3F','Apple'],
    // Samsung
    ['00:12:47','Samsung'],['00:15:99','Samsung'],['00:16:32','Samsung'],['00:17:C9','Samsung'],
    ['00:1A:8A','Samsung'],['00:1B:98','Samsung'],['00:1D:25','Samsung'],['00:1E:7D','Samsung'],
    ['00:21:19','Samsung'],['00:23:39','Samsung'],['00:24:54','Samsung'],['00:25:38','Samsung'],
    ['00:26:37','Samsung'],['28:CC:01','Samsung'],['2C:AE:2B','Samsung'],['34:23:BA','Samsung'],
    ['38:AA:3C','Samsung'],['40:0E:85','Samsung'],['50:01:BB','Samsung'],['50:32:75','Samsung'],
    ['54:88:0E','Samsung'],['5C:49:79','Samsung'],['60:6B:FF','Samsung'],['70:F9:27','Samsung'],
    ['78:1F:DB','Samsung'],['7C:61:93','Samsung'],['84:25:DB','Samsung'],['8C:77:12','Samsung'],
    ['94:63:D1','Samsung'],['94:76:B7','Samsung'],['98:52:B1','Samsung'],['9C:02:98','Samsung'],
    ['A0:07:98','Samsung'],['B0:47:BF','Samsung'],['B0:72:BF','Samsung'],['B4:07:F9','Samsung'],
    ['BC:20:A4','Samsung'],['BC:47:60','Samsung'],['BC:85:56','Samsung'],['C0:BD:D1','Samsung'],
    ['C4:42:02','Samsung'],['CC:07:AB','Samsung'],['D0:17:6A','Samsung'],['D0:22:BE','Samsung'],
    ['D8:57:EF','Samsung'],['E0:99:71','Samsung'],['EC:1F:72','Samsung'],['F0:25:B7','Samsung'],
    ['F4:7B:5E','Samsung'],['F8:04:2E','Samsung'],
    // Google
    ['00:1A:11','Google'],['54:60:09','Google'],['70:3A:CB','Google'],['98:FC:11','Google'],
    ['A4:77:33','Google'],['D4:F5:47','Google'],['F4:F5:D8','Google'],
    // Amazon
    ['00:BB:3A','Amazon'],['0C:47:C9','Amazon'],['34:D2:70','Amazon'],['40:B4:CD','Amazon'],
    ['44:65:0D','Amazon'],['50:F5:DA','Amazon'],['68:37:E9','Amazon'],['74:75:48','Amazon'],
    ['84:D6:D0','Amazon'],['A0:02:DC','Amazon'],['AC:63:BE','Amazon'],['F0:27:2D','Amazon'],
    ['FC:65:DE','Amazon'],
    // Microsoft
    ['00:15:5D','Microsoft'],['00:50:F2','Microsoft'],['28:18:78','Microsoft'],
    ['48:50:73','Microsoft'],['70:66:55','Microsoft'],['7C:1E:52','Microsoft'],
    ['DC:53:60','Microsoft'],
    // Sony
    ['00:01:4A','Sony'],['00:04:1F','Sony'],['00:0D:A0','Sony'],['00:13:A9','Sony'],
    ['00:1A:80','Sony'],['00:1D:0D','Sony'],['00:24:BE','Sony'],['28:0D:FC','Sony'],
    ['30:17:C8','Sony'],['50:2A:EB','Sony'],['5C:B9:01','Sony'],['78:84:3C','Sony'],
    ['84:C7:EA','Sony'],['AC:9B:0A','Sony'],['F0:BF:97','Sony'],
    // Nintendo
    ['00:09:BF','Nintendo'],['00:16:56','Nintendo'],['00:17:AB','Nintendo'],['00:19:1D','Nintendo'],
    ['00:1A:E9','Nintendo'],['00:1B:EA','Nintendo'],['00:1C:BE','Nintendo'],['00:1D:BC','Nintendo'],
    ['00:1E:35','Nintendo'],['00:1F:32','Nintendo'],['00:21:47','Nintendo'],['00:22:4C','Nintendo'],
    ['00:23:CC','Nintendo'],['00:24:44','Nintendo'],['00:24:F3','Nintendo'],['00:25:A0','Nintendo'],
    ['58:BD:A3','Nintendo'],['78:A2:A0','Nintendo'],['8C:56:C5','Nintendo'],['98:B6:E9','Nintendo'],
    ['A4:5C:27','Nintendo'],['B8:8A:EC','Nintendo'],['D8:6B:F7','Nintendo'],['E0:E7:51','Nintendo'],
    // BUFFALO
    ['00:07:40','BUFFALO'],['00:0D:0B','BUFFALO'],['00:0F:EA','BUFFALO'],['00:16:01','BUFFALO'],
    ['00:17:9A','BUFFALO'],['00:1D:73','BUFFALO'],['00:1F:3A','BUFFALO'],['00:23:C7','BUFFALO'],
    ['00:24:A5','BUFFALO'],['14:CF:92','BUFFALO'],['1C:87:2C','BUFFALO'],['20:76:93','BUFFALO'],
    ['28:92:4A','BUFFALO'],['2C:FD:A1','BUFFALO'],['48:4B:AA','BUFFALO'],['4C:E6:76','BUFFALO'],
    ['54:DB:A2','BUFFALO'],['74:03:BD','BUFFALO'],['AC:F1:DF','BUFFALO'],['D4:BF:BF','BUFFALO'],
    ['E8:9F:80','BUFFALO'],
    // NEC
    ['00:00:4C','NEC'],['00:04:89','NEC'],['00:1B:8B','NEC'],['3C:4A:92','NEC'],
    // Yamaha
    ['00:A0:DE','Yamaha'],['08:00:B3','Yamaha'],
    // TP-Link
    ['14:CF:E2','TP-Link'],['1C:61:B4','TP-Link'],['28:28:5D','TP-Link'],['50:3E:AA','TP-Link'],
    ['54:AF:97','TP-Link'],['60:32:B1','TP-Link'],['74:DA:38','TP-Link'],['98:DA:C4','TP-Link'],
    ['A0:F3:C1','TP-Link'],['AC:84:C6','TP-Link'],['B0:4E:26','TP-Link'],['C0:4A:00','TP-Link'],
    ['D8:0D:17','TP-Link'],['E8:DE:27','TP-Link'],['F0:9F:C2','TP-Link'],
    // ASUS
    ['00:1A:92','ASUS'],['00:24:8C','ASUS'],['04:92:26','ASUS'],['10:02:B5','ASUS'],
    ['1C:87:2C','ASUS'],['2C:56:DC','ASUS'],['30:5A:3A','ASUS'],['38:2C:4A','ASUS'],
    ['40:16:7E','ASUS'],['50:46:5D','ASUS'],['54:04:A6','ASUS'],['60:45:CB','ASUS'],
    ['74:D0:2B','ASUS'],['9C:5C:8E','ASUS'],['AC:9E:17','ASUS'],['B0:6E:BF','ASUS'],
    ['BC:AE:C5','ASUS'],['C8:60:00','ASUS'],['D8:50:E6','ASUS'],['E0:3F:49','ASUS'],
    // Panasonic
    ['00:0A:E4','Panasonic'],['00:0B:61','Panasonic'],['00:12:F0','Panasonic'],['00:21:4F','Panasonic'],
    ['00:50:8B','Panasonic'],['04:EA:56','Panasonic'],['28:24:FF','Panasonic'],['40:E2:30','Panasonic'],
    ['58:D0:B7','Panasonic'],['78:3C:40','Panasonic'],['A4:6E:57','Panasonic'],
    // Sharp
    ['00:0A:1B','Sharp'],['00:3A:9A','Sharp'],['10:2A:B3','Sharp'],['20:1F:3B','Sharp'],
    // Toshiba
    ['00:00:39','Toshiba'],['00:08:19','Toshiba'],['00:0E:7B','Toshiba'],['14:13:33','Toshiba'],
    // Epson
    ['00:00:48','Epson'],['00:26:AB','Epson'],['44:D2:44','Epson'],['64:EB:8C','Epson'],
    // Canon
    ['00:00:85','Canon'],['00:1E:8F','Canon'],['08:00:6E','Canon'],['50:1A:C5','Canon'],
    // Cisco
    ['00:00:0C','Cisco'],['00:1A:A1','Cisco'],['00:26:99','Cisco'],['3C:CE:73','Cisco'],
    ['58:AC:78','Cisco'],['70:81:05','Cisco'],['D8:B1:90','Cisco'],['F4:CF:E2','Cisco'],
    // Raspberry Pi
    ['B8:27:EB','Raspberry Pi'],['DC:A6:32','Raspberry Pi'],['E4:5F:01','Raspberry Pi'],
  ];
  entries.forEach(([oui, vendor]) => { t[oui.toUpperCase()] = vendor; });
  return t;
})();

function getMacVendor(mac) {
  const oui = mac.slice(0, 8).toUpperCase();
  return OUI_MAP[oui] || '';
}

app.get('/api/network/arp', (req, res) => {
  exec('chcp 65001 > nul && arp -a', { encoding: 'utf8', shell: 'cmd.exe' }, async (err, stdout) => {
    if (err) return res.status(500).json({ error: 'スキャン失敗: ' + err.message });
    const devices = [];
    stdout.split('\n').forEach(line => {
      const m = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2})\s+(\S+)/i);
      if (m) {
        const rawType = m[3];
        const type = rawType === '動的' ? '動的' : rawType === '静的' ? '静的' : rawType;
        const mac = m[2].toUpperCase().replace(/-/g, ':');
        devices.push({ ip: m[1], mac, type, name: '', vendor: getMacVendor(mac) });
      }
    });

    // DNS逆引き + nbtstat を並列実行して機器名を取得
    const CONCURRENCY = 4;
    for (let i = 0; i < devices.length; i += CONCURRENCY) {
      await Promise.all(devices.slice(i, i + CONCURRENCY).map(async d => {
        const [dnsName, nbtName] = await Promise.all([
          // DNS逆引き（タイムアウト2秒）
          Promise.race([
            dns.reverse(d.ip).then(h => h[0]?.replace(/\.local$/, '').replace(/\.$/, '') || ''),
            new Promise(r => setTimeout(() => r(''), 2000)),
          ]).catch(() => ''),
          // NetBIOS名（nbtstat -A）
          getNbtstatName(d.ip),
        ]);
        // DNS名 > nbtstat名 の優先順位で設定
        d.name = dnsName || nbtName || '';
      }));
    }

    res.json(devices);
  });
});

// ─── アクセスカウント API ─────────────────────────────────

// POST /api/access/hit  (認証不要 — ページ表示時に呼ぶ)
app.post('/api/access/hit', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  const counts = db.hitAccess(ip, ua);
  res.json(counts);
});

// GET /api/access/count  (認証不要)
app.get('/api/access/count', (req, res) => {
  res.json(db.getAccessCount());
});

// GET /api/access/daily?days=7  (認証不要)
app.get('/api/access/daily', (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 7, 30);
  res.json(db.getDailyAccessCount(days));
});

// ─── ヘルスチェック ───────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`[Server] http://localhost:${PORT} で起動しました`);
  console.log('[Server] Ctrl+C で停止');
});
