#!/usr/bin/env node
/*
 * gen-taihei-og.mjs — 太平風雲記の OGP 画像（1200×630 JPEG）を実画面から起こす
 *
 * genpei/sengoku と同じ方針: og:image は JPEG（PNGだとクローラ取得が重い）。
 * 手描きモックではなく実際に動いている画面を撮るので、UIを変えたら撮り直せば追随する。
 * 併せて index.html の作品カード用サムネイル（WebP）も同じ実行で書き出す。
 *
 * 使い方: node scripts/gen-taihei-og.mjs [--scene title|map] [--out assets/og/taihei.jpg]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const SCENE = arg('scene', 'map');   // 姉妹作（sengoku/genpei/sanguo）に合わせて地図画面を既定にする
const OUT = path.resolve(ROOT, arg('out', 'assets/og/taihei.jpg'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.webp': 'image/webp' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.join(ROOT, url === '/' ? 'taihei.html' : url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(`http://127.0.0.1:${server.address().port}/taihei.html`);
await page.waitForFunction(() => window.TAIHEI_DEBUG && window.TAIHEI_DEBUG.game.scene
  && window.TAIHEI_DEBUG.game.scene.constructor.name === 'TitleScene', null, { timeout: 30000 });
if (SCENE === 'map') {
  await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    const state = D.Rule.buildState({ playerCamp: 'ashikaga' });
    D.game.changeScene(new D.MapScene(state));
  });
}
// 地図・肖像は後読みなので、描画が落ち着くまで数フレーム待つ
await page.waitForTimeout(4000);

const shots = await page.evaluate(() => {
  const src = document.querySelector('canvas');
  // OGP は 1200×630（1.905:1）。ゲーム画面は 16:9 なので縦を切る。
  // ★上端から切る（中央基準にすると最下段のコマンドバーが途中で切れて欠けた絵に見える）。
  const W = 1200, H = 630;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const g = out.getContext('2d');
  const sw = src.width, sh = Math.round(src.width * H / W);
  g.drawImage(src, 0, 0, sw, sh, 0, 0, W, H);

  // 作品カード用サムネイル。画面全体を 16:9 のまま縮小する（切らない）。
  const T = document.createElement('canvas');
  T.width = 960; T.height = 540;
  T.getContext('2d').drawImage(src, 0, 0, src.width, src.height, 0, 0, T.width, T.height);

  return { og: out.toDataURL('image/jpeg', 0.88), thumb: T.toDataURL('image/webp', 0.9) };
});

await browser.close();
server.close();

const write = (file, dataUrl) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return (fs.statSync(file).size / 1024).toFixed(0);
};
const kb = write(OUT, shots.og);
console.log(`✓ ${path.relative(ROOT, OUT)} を書き出した（${SCENE} 画面 / 1200×630 / ${kb}KB）`);
if (kb > 300) console.warn(`  ⚠ ${kb}KB は OGP としては重い。品質を下げるか scene を変えること`);

const THUMB = path.resolve(ROOT, 'assets/taihei/taihei-thumb.webp');
console.log(`✓ ${path.relative(ROOT, THUMB)} を書き出した（${SCENE} 画面 / 960×540 / ${write(THUMB, shots.thumb)}KB）`);
