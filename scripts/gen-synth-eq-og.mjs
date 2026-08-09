#!/usr/bin/env node
/*
 * gen-synth-eq-og.mjs — synth-eq.html の OGP 画像（1200×630 JPEG）を実画面から起こす
 *
 * ★ og:image は JPEG。PNG だと桁違いに重くクローラの取得が遅くなる（seo-audit スキルの方針）
 * ★ 絵は描き起こさず「実際に動いている画面」を撮る。UI を変えたら撮り直せば OGP も追随する
 *
 * デモ演奏を鳴らしてスペクトラムが立ち上がった瞬間を撮るので、
 * ヘッドレスでも自動再生ポリシーを解除して AudioContext を起こす必要がある。
 *
 * 使い方: node scripts/gen-synth-eq-og.mjs [--out assets/og/synth-eq.jpg]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 && process.argv[i+1] ? process.argv[i+1] : d; };
const OUT = path.resolve(ROOT, arg('out', 'assets/og/synth-eq.jpg'));
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.join(ROOT, url === '/' ? 'synth-eq.html' : url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--autoplay-policy=no-user-gesture-required']
});
// ★ deviceScaleFactor は 1 のまま。2 にすると 2400×1260 で書き出され、
//   og:image:width/height の 1200×630 と食い違ううえファイルも重くなる
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.addInitScript(() => { try { localStorage.clear(); } catch(e){} });
await page.goto(`${BASE}/synth-eq.html`, { waitUntil: 'load' });

// 見栄えのするプリセットを当ててデモ演奏。スペクトラムが立つまで待つ
await page.locator('#synthPresets .chip').first().click();      // ウォームパッド
await page.locator('#eqPresets .chip').nth(1).click();          // ロック
await page.locator('#btnDemo').click();
await page.waitForTimeout(2600);

// ビューポートをそのまま撮る（clip でずらすとタイトルが切れ、
// ビューポート外を指定した分だけ縦が縮んで 1200×630 にならない）
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT, type: 'jpeg', quality: 84 });

await browser.close();
server.close();
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`✅ ${path.relative(ROOT, OUT)}  ${kb} KB  (1200×630)`);
