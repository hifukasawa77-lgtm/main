const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

// file:// で開くと fetch() が CORS で必ず落ちる（"Cross origin requests are only supported
// for protocol schemes: http, https ..."）。JSONを読むページ（index.html等）が常にFAILし、
// 検査が信用されなくなるため、リポジトリ直下を静的配信して http:// で開く。
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.csv': 'text/csv; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.webm': 'video/webm', '.mp4': 'video/mp4',
};

function startServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      // ブラウザは favicon.ico を勝手に取りに行く。無ければ404が出て検査が常に赤くなるので黙らせる
      if (urlPath === '/favicon.ico' && !fs.existsSync(path.join(rootDir, 'favicon.ico'))) {
        res.writeHead(204); res.end(); return;
      }
      const target = path.join(rootDir, urlPath);
      // ルート外への参照を拒否（../ 対策）
      if (!path.resolve(target).startsWith(path.resolve(rootDir))) {
        res.writeHead(403); res.end('forbidden'); return;
      }
      fs.readFile(target, (err, buf) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node dynamic-test.cjs <path-to-html>'); process.exit(1); }

(async () => {
  // CHROMIUM_PATH: 同梱ブラウザとplaywrightのバージョンが合わない環境（CI等）向けの上書き。未設定なら従来どおり
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage();

  const absolute = path.resolve(filePath);
  let serverRoot;
  try {
    serverRoot = execSync('git rev-parse --show-toplevel', { cwd: path.dirname(absolute) }).toString().trim();
  } catch (e) {
    serverRoot = path.dirname(absolute);
  }
  const relative = path.relative(serverRoot, absolute).split(path.sep).join('/');
  const server = await startServer(serverRoot);
  const port = server.address().port;
  const localOrigin = `http://127.0.0.1:${port}`;

  const jsErrors = [];
  const notFound = [];
  // 外部オリジン（CDN・Webフォント等）の読み込み失敗は「ページの欠陥」ではなく実行環境の
  // ネットワーク事情で出る。ここを jsErrors に混ぜると、Google Fonts を読む全ページが
  // オフライン環境で常にFAILし、検査そのものが信用されなくなる（＝偽のFAIL）。
  // 分けて報告し、ブロッキング判定には使わない。ローカル参照の失敗は jsErrors のまま。
  const externalLoadErrors = [];

  // 「外部」＝テストサーバ自身のオリジン以外。http(s) かどうかだけで判定すると、
  // 静的配信した自分のローカル資産（127.0.0.1）まで外部扱いになり本物の読込失敗を見逃す
  const isExternal = (url) => /^https?:\/\//i.test(url || '') && !String(url).startsWith(localOrigin);

  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const url = (msg.location && msg.location().url) || '';
    // 「Failed to load resource: ...」系だけを外部扱いにする（JSの実行時エラーは
    // 外部スクリプト由来でも本物の不具合なので jsErrors に残す）
    if (/failed to load resource/i.test(text) && isExternal(url)) {
      externalLoadErrors.push(`${text} (${url})`);
      return;
    }
    jsErrors.push(text);
  });
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('response', res => {
    if (res.status() === 404) notFound.push(res.url());
  });

  await page.goto(`http://127.0.0.1:${port}/${relative}`);
  await page.waitForTimeout(2000);

  const screenshotDir = path.join(path.dirname(filePath), 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  const timestamp = Date.now();
  const screenshotName = `${path.basename(filePath, '.html')}_${timestamp}.png`;
  const screenshotPath = path.join(screenshotDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const canvasResult = await page.evaluate(() => {
    // 左上100×100pxだけを見ると、パーティクル背景のような疎な描画で「描画なし」と誤判定する
    // （index.html / agents.html で実際に発生）。全canvasを全面走査し、1枚でも描けていればPASS。
    const canvases = Array.from(document.querySelectorAll('canvas'));
    if (canvases.length === 0) return { hasCanvas: false };
    const details = [];
    let any = false, allErrored = true;
    for (const canvas of canvases) {
      if (!canvas.width || !canvas.height) { details.push({ width: canvas.width, height: canvas.height, drawn: false }); continue; }
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) { details.push({ width: canvas.width, height: canvas.height, drawn: null, error: '2dコンテキスト取得不可（WebGL等）' }); continue; }
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        allErrored = false;
        let drawn = false;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] || data[i + 1] || data[i + 2] || data[i + 3]) { drawn = true; break; }
        }
        if (drawn) any = true;
        details.push({ width: canvas.width, height: canvas.height, drawn });
      } catch (e) {
        details.push({ width: canvas.width, height: canvas.height, drawn: null, error: e.message });
      }
    }
    return { hasCanvas: true, hasDrawing: allErrored ? null : any, canvasCount: canvases.length, details };
  });

  const bodyEmpty = await page.evaluate(() => document.body.innerHTML.trim() === '');

  await browser.close();
  await new Promise(r => server.close(r));

  console.log(JSON.stringify({
    jsErrors,
    externalLoadErrors,
    notFound,
    canvasResult,
    bodyEmpty,
    screenshotPath
  }, null, 2));
})();
