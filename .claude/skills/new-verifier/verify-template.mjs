#!/usr/bin/env node
/*
 * verify-__NAME__.mjs — __PAGE__ の必須チェック（new-verifier のひな形）
 *
 * 「例外0件＝動いている」ではない。__この検査が守る無言の壊れ方を1行で__
 *
 * 使い方:
 *   node scripts/verify-__NAME__.mjs             # 通常検査
 *   node scripts/verify-__NAME__.mjs --inject    # 故障注入: 意図的に壊して ✗ が出ることを確かめる
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PAGE = '__PAGE__';
const INJECT = process.argv.includes('--inject');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; } // 本物の404だけ拾うため黙らせる
  const file = path.join(ROOT, url === '/' ? PAGE : url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [], missing = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
// 資源の読込失敗は console にURL無しで出る。自オリジンは response/requestfailed で拾い、
// 別オリジン（CDN・Webフォント）は環境由来の赤になるので FAIL にしない（外部として表示のみ）
const external = [];
page.on('console', (m) => {
  if (m.type() !== 'error' || /Failed to load resource/.test(m.text())) return;
  errors.push('console: ' + m.text());
});
page.on('requestfailed', (r) => {
  if (r.url().startsWith(BASE)) missing.push(`failed ${r.url()}`); else external.push(r.url());
});
page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });

// 検査用ブリッジを開く（新しい関数・定数を足したらページ側のブリッジにも足す）
await page.addInitScript(() => { window.__TEST = true; try { localStorage.clear(); } catch (e) {} });
await page.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
await page.waitForTimeout(400);

console.log('\n── 1. 起動 ─────────────────────────────');
// GameKit系は update/draw の例外を engine.errors に積んで継続する。pageerror だけ見ると素通りする
const engineErrors = await page.evaluate(() => (window.engine && window.engine.errors) ? window.engine.errors.length : 0);
check('例外0件（pageerror + console.error + engine.errors）', errors.length + engineErrors === 0,
  [...errors.slice(0, 3), engineErrors ? `engine.errors=${engineErrors}` : ''].filter(Boolean).join(' | '));
check('404アセット0件', missing.length === 0, missing.slice(0, 3).join(' | '));
if (external.length) console.log(`  △ 外部の読込失敗 ${external.length} 件（FAILにしない）: ${external[0]}`);

console.log('\n── 2. 守りたい不変条件（ここに「中身」を見る検査を書く）──');
// 悪い例: 「件数が出た」だけ見る → 0件でも『◯件を抽出』と出て素通りする
// 良い例: 抽出した“中身”・描いた“画素”・鳴らした“ピーク値”まで見る
// check('__不変条件__', await page.evaluate(() => /* 実際に値を計算する */ true));

if (INJECT) {
  console.log('\n── 故障注入（この下が ❌ にならなければ、検査は素通りしている）──');
  // 例: await page.evaluate(() => { /* 対象を意図的に壊す */ });
  // check('壊したら検出できる', /* 壊れたことを示す条件 */ false);
}

await browser.close(); server.close();
console.log(`\n==> verify-__NAME__: ${pass} 項目 ✅ / ${fail} 項目 ❌`);
process.exit(fail ? 1 : 0);
