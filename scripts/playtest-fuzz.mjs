#!/usr/bin/env node
/*
 * playtest-fuzz.mjs — ゲームに無作為な入力を浴びせて「固まらないか・反応するか・壊れないか」を見る
 *
 * dynamic-tester は「起動して例外が無いか」しか見ない。ゲームは起動しても、
 *   - 入力しても画面が一度も変わらない（入力が死んでいる／ソフトロック）
 *   - 特定の入力で主スレッドが固まる（無限ループ）
 *   - 操作を始めた途端に例外が出る（描画ループは engine.errors に積んで継続する）
 * ことがある。どれも「タイトル画面が出た」では見つからない（playtester の機械側）。
 *
 * 使い方:
 *   node scripts/playtest-fuzz.mjs zelda_like.html --seconds 10
 *   node scripts/playtest-fuzz.mjs --changed               # git diff で変わったHTMLだけ
 *   node scripts/playtest-fuzz.mjs --all --seconds 4       # 直下の全HTML（遅い。棚卸し用）
 *   node scripts/playtest-fuzz.mjs --inject                # 故障注入（固まる・反応しない・例外のページを検出できるか）
 * 乱数の種は --seed N（既定: 固定）。同じ種なら同じ入力列になる＝落ちたら同じ手順で再現できる。
 *
 * 判定:
 *   ❌ 入力を送ったのに、画面が一度も変わらなかった（キャンバス/本文の指紋が最初から最後まで同じ）
 *   ❌ ページが応答しなくなった（評価の往復が 3 秒を超えた）
 *   ❌ 例外（pageerror / console.error / engine.errors）
 *   ❌ 自オリジンの 404
 * 反応が全く無いのが正しいページ（静的な説明ページ）は対象外にする: キャンバスもキー入力の受け口も無いHTMLは「対象外」と表示して飛ばす。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const INJECT = args.includes('--inject');
const optionValue = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback; };
const SECONDS = optionValue('--seconds', INJECT ? 3 : 8);
const SEED = optionValue('--seed', 20261020);
const HANG_MS = 3_000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

/** 故障注入のページ（メモリ上だけ）。どれも本物のゲームの「やりがちな壊れ方」を最小にしたもの */
const CANVAS = '<canvas id="c" width="200" height="200" style="display:block"></canvas>';
const SYNTHETIC = {
  // 正常: キーで色が変わり続ける
  '/__ok.html': `<!doctype html><body style="margin:0">${CANVAS}<script>
    const c=document.getElementById('c').getContext('2d');let n=0;
    addEventListener('keydown',()=>{n++;});addEventListener('click',()=>{n++;});
    (function loop(){c.fillStyle='hsl('+(n*37%360)+',70%,50%)';c.fillRect(0,0,200,200);requestAnimationFrame(loop);})();</script></body>`,
  // 入力を無視する（画面は一度も変わらない）
  '/__frozen.html': `<!doctype html><body style="margin:0">${CANVAS}<script>
    const c=document.getElementById('c').getContext('2d');c.fillStyle='#246';c.fillRect(0,0,200,200);
    addEventListener('keydown',e=>e.stopImmediatePropagation(),true);</script></body>`,
  // 最初のキー入力で無限ループ（主スレッドが固まる）
  '/__hang.html': `<!doctype html><body style="margin:0">${CANVAS}<script>
    const c=document.getElementById('c').getContext('2d');c.fillStyle='#246';c.fillRect(0,0,200,200);
    addEventListener('keydown',()=>{for(;;){}});addEventListener('click',()=>{for(;;){}});</script></body>`,
  // 最初の入力で例外（描画ループ内。GameKit は捕まえて engine.errors に積んで続ける）
  '/__throws.html': `<!doctype html><body style="margin:0">${CANVAS}<script>
    window.engine={errors:[]};const c=document.getElementById('c').getContext('2d');let n=0;
    addEventListener('keydown',()=>{n++;});addEventListener('click',()=>{n++;});
    (function loop(){try{c.fillStyle='hsl('+(n*37%360)+',70%,50%)';c.fillRect(0,0,200,200);if(n>0)throw new Error('boom');}catch(e){if(!window.__seen){window.engine.errors.push(String(e));window.__seen=true;}}requestAnimationFrame(loop);})();</script></body>`,
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (SYNTHETIC[url]) { res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(SYNTHETIC[url]); return; }
  const file = path.join(ROOT, url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

function pickPages() {
  const named = args.filter((a) => a.endsWith('.html'));
  if (named.length) return named;
  if (args.includes('--all')) return fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
  if (args.includes('--changed')) {
    const out = execSync('git diff HEAD --name-only --diff-filter=AM', { cwd: ROOT, encoding: 'utf8' });
    return out.split('\n').filter((f) => /^[^/]+\.html$/.test(f) && fs.existsSync(path.join(ROOT, f)));
  }
  return [];
}

/** 種付きの乱数（同じ種なら同じ入力列。落ちたら再現できる） */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
/** 固まったページは入力の送信そのものが返ってこない。時間で見切る（返らなければ null） */
const within = (work, ms) => Promise.race([work, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' ', 'Enter', 'z', 'x', 'c', 'e', 'q', '1', '2', '3'];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

let pass = 0, fail = 0, skipped = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`); };

/** 画面の指紋: 一番大きいキャンバスの標本画素＋DOM構造の標本。変わったかどうかだけを見る */
const FINGERPRINT = () => {
  let h = 2166136261;
  const mix = (v) => { h = Math.imul(h ^ (v & 0xffff), 16777619) >>> 0; };
  const canvases = [...document.querySelectorAll('canvas')].filter((c) => c.width > 0 && c.height > 0);
  canvases.sort((a, b) => b.width * b.height - a.width * a.height);
  const canvas = canvases[0];
  if (canvas) {
    try {
      const probe = document.createElement('canvas'); probe.width = 24; probe.height = 24;
      const g = probe.getContext('2d'); g.drawImage(canvas, 0, 0, 24, 24);
      const data = g.getImageData(0, 0, 24, 24).data;
      for (let i = 0; i < data.length; i += 4) { mix(data[i]); mix(data[i + 1]); mix(data[i + 2]); }
    } catch { mix(1); }
  }
  // 盤面をDOMで描くゲーム（将棋など）は、キャンバスも本文も変わらず、クラス・属性だけが変わる。構造ごと見る
  const html = document.body ? document.body.innerHTML : '';
  mix(html.length);
  for (let i = 0; i < Math.min(html.length, 60000); i += 11) mix(html.charCodeAt(i));
  return { hash: h, canvas: Boolean(canvas) };
};

async function playtest(label, urlPath) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [], missing = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) missing.push(`failed ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) missing.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(() => { window.__TEST = true; window.__SANGUO_TEST = true; try { localStorage.clear(); } catch { /* 無くても進む */ } });
  try {
    await page.goto(`${BASE}${urlPath}`, { waitUntil: 'load', timeout: 20_000 });
  } catch (e) { check(`${label}: 開ける`, false, e.message.split('\n')[0]); await context.close(); return; }
  await page.waitForTimeout(500);

  const first = await page.evaluate(FINGERPRINT);
  const hasKeyInput = await page.evaluate(() => Boolean(document.querySelector('canvas, button, [onclick], a[href]')));
  if (!first.canvas && !hasKeyInput) { skipped++; console.log(`  - ${label}: 対象外（キャンバスも操作要素も無い静的ページ）`); await context.close(); return; }

  const random = rng(SEED);
  const seen = new Set([first.hash]);
  let hung = false, sent = 0;
  const end = Date.now() + SECONDS * 1000;
  while (Date.now() < end && !hung) {
    try {
      const burst = 4 + Math.floor(random() * 4);
      for (let i = 0; i < burst; i += 1) {
        const input = random() < 0.8
          ? page.keyboard.press(KEYS[Math.floor(random() * KEYS.length)], { delay: 15 })
          : page.mouse.click(40 + random() * 1200, 40 + random() * 720);
        if ((await within(input.then(() => true), HANG_MS)) === null) { hung = true; break; }
        sent += 1;
      }
      // 応答の往復時間。固まったページはここで返ってこない
      if (hung) break;
      const fp = await within(page.evaluate(FINGERPRINT), HANG_MS);
      if (!fp) { hung = true; break; }
      seen.add(fp.hash);
    } catch (e) {
      if (/Execution context was destroyed|navigat/i.test(e.message)) break; // 遷移した（リンクを踏んだ）だけ
      hung = true;
    }
  }
  const engineErrors = hung ? [] : await page.evaluate(() => (window.engine && Array.isArray(window.engine.errors) ? window.engine.errors.map(String) : [])).catch(() => []);

  check(`${label}: 応答し続ける（${sent}回の入力）`, !hung, hung ? `${HANG_MS / 1000}秒以上応答なし` : '');
  check(`${label}: 入力に画面が反応する`, hung || seen.size > 1, !hung && seen.size <= 1 ? '最初から最後まで画面が同じ（入力が死んでいる／ソフトロック）' : `画面の状態 ${seen.size} 通り`);
  check(`${label}: 例外0件（pageerror + console.error + engine.errors）`, errors.length + engineErrors.length === 0, [...errors, ...engineErrors].slice(0, 2).join(' | '));
  check(`${label}: 404アセット0件`, missing.length === 0, missing.slice(0, 2).join(' | '));
  // 固まったページは閉じる操作も返ってこない。待たずに捨てる（ブラウザごと最後に閉じる）
  await within(context.close().catch(() => {}), 2_000);
}

if (INJECT) {
  console.log(`\n── 故障注入（期待: ok は全て ✅、frozen/hang/throws はそれぞれ ❌ になる。${SECONDS}秒ずつ）──`);
  const counts = {};
  for (const name of ['ok', 'frozen', 'hang', 'throws']) {
    const before = fail;
    await playtest(name, `/__${name}.html`);
    counts[name] = fail - before;
  }
  await within(browser.close(), 5_000); server.close();
  const detected = counts.ok === 0 && counts.frozen >= 1 && counts.hang >= 1 && counts.throws >= 1;
  console.log(`\n  ❌の数: ok=${counts.ok} frozen=${counts.frozen} hang=${counts.hang} throws=${counts.throws}`);
  console.log(detected ? '==> 故障注入: 固まる・反応しない・例外を検出できる ✅' : '==> 故障注入: 検出できていない ❌（この検査は素通りする）');
  process.exit(detected ? 0 : 1);
}

const pages = pickPages();
if (!pages.length) { console.log('検査するページがありません（ページ名か --changed を指定）'); await browser.close(); server.close(); process.exit(0); }
for (const name of pages) {
  console.log(`\n── ${name}（${SECONDS}秒・種${SEED}）──`);
  if (!fs.existsSync(path.join(ROOT, name))) { check(`${name}: 実在する`, false); continue; }
  await playtest(name, `/${name}`);
}
await within(browser.close(), 5_000); server.close();
console.log(`\n==> playtest-fuzz: ${pass} 項目 ✅ / ${fail} 項目 ❌${skipped ? ` / ${skipped} 件 対象外` : ''}`);
process.exit(fail ? 1 : 0);
