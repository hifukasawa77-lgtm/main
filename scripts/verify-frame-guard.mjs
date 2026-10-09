#!/usr/bin/env node
// クリックジャッキング対策（assets/js/frame-guard.js）を実ブラウザで検査する。
//
//   node scripts/verify-frame-guard.mjs           # 検査
//   node scripts/verify-frame-guard.mjs --inject  # frame-guard.js を無効化して ❌ が出ることを確かめる
//
// 「scriptタグが在る」だけの静的検査は security-baseline.mjs が見る。ここでは
//   ①別オリジンの枠に入れられたら抜け出す／操作を遮る ②同じオリジンの枠（taihei-ui-preview）は邪魔しない
//   ③CSPの厳しいページでも読み込みが拒否されない（拒否されても例外は出ず、無言で効かなくなる）
// を実際に開いて確かめる。別オリジンは 127.0.0.1 と localhost の違いで作る（同じポートでも別オリジン）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.execPath, '../../lib/node_modules/playwright'))); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INJECT = process.argv.includes('--inject');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const reports = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__attacker.html') {
    // 攻撃側のページ: 対象を透明に重ねる典型的なクリックジャッキング
    const target = url.searchParams.get('t');
    const sandbox = url.searchParams.has('sandbox') ? ' sandbox="allow-scripts allow-same-origin"' : '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><title>attacker</title><iframe id="f"${sandbox} src="${target}" style="width:800px;height:600px;opacity:.01"></iframe>`);
  }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (url.pathname === '/__report') {
    // Worker の /security/report の代役: 届いた通報を記録する
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => { try { reports.push(JSON.parse(body)); } catch { reports.push({ bad: body }); } res.writeHead(204); res.end(); });
    return;
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  if (INJECT && file.endsWith(path.join('assets', 'js', 'frame-guard.js'))) {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end('/* 故障注入: 何もしない */');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const SITE = `http://127.0.0.1:${port}`;       // 本物のサイト
const EVIL = `http://localhost:${port}`;       // 別オリジン（攻撃側）

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`); };

// 通報先を検査サーバへ向ける（本番では github.io 上のときだけ Worker へ送る）
const REPORT_INIT = () => { window.__SECURITY_REPORT_URL = location.origin.replace('localhost', '127.0.0.1') + '/__report'; };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  console.log('🛡  frame-guard の検査' + (INJECT ? '（故障注入）' : ''));

  // ③ CSPの厳しいページでも frame-guard.js の読み込みが拒否されない
  for (const page of ['index.html', 'agents.html', 'blog.html', 'sengoku.html', 'zero-1-mobile.html', 'shogi.html', 'chess.html']) {
    const p = await browser.newPage();
    const violations = [];
    await p.exposeFunction('__cspViolation', v => violations.push(v));
    await p.addInitScript(() => document.addEventListener('securitypolicyviolation',
      e => window.__cspViolation(e.violatedDirective + ' ' + e.blockedURI)));
    let guardLoaded = false;
    p.on('response', r => { if (r.url().endsWith('/assets/js/frame-guard.js') && r.ok()) guardLoaded = true; });
    await p.goto(`${SITE}/${page}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(300);
    const guardViol = violations.filter(v => /frame-guard/.test(v));
    const blocked = await p.$('#frame-guard-block');
    check(`${page}: 最上位で開くと何も遮らず、frame-guard がCSPで拒否されない`,
      !blocked && guardViol.length === 0 && guardLoaded, guardViol.join(' / '));
    await p.close();
  }

  // ① 別オリジンの枠: 抜け出す（最上位が対象ページへ移る）か、少なくとも操作を全面で遮る
  for (const [label, q] of [['別オリジンの枠', ''], ['sandbox 付きの別オリジンの枠（最上位へは抜け出せない）', '&sandbox=1']]) {
    const p = await browser.newPage();
    await p.addInitScript(REPORT_INIT);
    reports.length = 0;
    await p.goto(`${EVIL}/__attacker.html?t=${encodeURIComponent(SITE + '/chess.html')}${q}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(800);
    const escaped = p.url().startsWith(SITE + '/chess.html');
    let blocked = false;
    if (!escaped) {
      const frame = p.frames().find(f => f.url().startsWith(SITE));
      blocked = !!(frame && await frame.$('#frame-guard-block'));
    }
    check(`${label}: 抜け出す or 操作を遮る`, escaped || blocked, escaped ? '（最上位へ遷移）' : blocked ? '（全面で遮断）' : '（素通し＝クリックジャッキング可能）');
    await p.waitForTimeout(300);
    const framed = reports.find(r => r.kind === 'framed');
    check(`${label}: 攻撃として通報する（埋め込み元のオリジン付き）`, !!framed && framed.framer === EVIL && framed.page === '/chess.html',
      JSON.stringify(reports));
    await p.close();
  }

  // ③' CSPが遮断した注入（XSSの試み）を通報する。拡張機能が差し込むインライン<script>型の雑音は送らない
  {
    const p = await browser.newPage();
    await p.addInitScript(REPORT_INIT);
    reports.length = 0;
    await p.goto(`${SITE}/blog.html`, { waitUntil: 'domcontentloaded' });
    await p.evaluate(() => {
      const img = document.createElement('div');
      img.innerHTML = '<img src="data:," onerror="window.__pwned=1">';      // イベント属性型のXSS
      document.body.appendChild(img);
      const s = document.createElement('script');
      s.src = 'https://evil.example/steal.js';                                  // 外部スクリプトの差し込み
      document.head.appendChild(s);
      const inline = document.createElement('script');
      inline.textContent = 'window.__ext = 1';                                  // 拡張機能風の雑音
      document.head.appendChild(inline);
    });
    await p.waitForTimeout(600);
    const pwned = await p.evaluate(() => window.__pwned === 1 || window.__ext === 1);
    const kinds = reports.map(r => r.kind + ':' + r.directive + ':' + r.blocked);
    check('blog.html: 注入されたイベント属性・外部スクリプトはCSPが遮断し、実行されない', !pwned);
    check('blog.html: 遮断した注入を通報する（イベント属性・外部スクリプトの2件）',
      reports.some(r => r.kind === 'csp-violation' && /script-src-attr/.test(r.directive)) &&
      reports.some(r => r.kind === 'csp-violation' && /evil\.example/.test(r.blocked || '')), kinds.join(' / '));
    check('blog.html: インライン<script>（拡張機能でも起きる雑音）は通報しない',
      !reports.some(r => r.blocked === 'inline' && /^script-src(-elem)?$/.test(r.directive)), kinds.join(' / '));
    await p.close();
  }

  // ② 同じオリジンの枠は邪魔しない（taihei-ui-preview.html が taihei.html を枠で開く）
  {
    const p = await browser.newPage();
    await p.goto(`${SITE}/taihei-ui-preview.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(800);
    const frame = p.frames().find(f => f.url().endsWith('/taihei.html'));
    const blocked = frame ? await frame.$('#frame-guard-block') : null;
    check('同じオリジンの枠（taihei-ui-preview → taihei）は遮らない', p.url().endsWith('/taihei-ui-preview.html') && !!frame && !blocked);
    await p.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n  合計: ${pass} 件合格 / ${fail} 件不合格`);
if (INJECT) {
  // 故障注入では「別オリジンの枠」の遮断2件と通報が必ず落ちること
  if (fail >= 4) console.log('  ✅ 故障注入を検出した'); else { console.log('  ❌ 故障注入がすり抜けた'); process.exitCode = 1; }
} else if (fail) process.exitCode = 1;
