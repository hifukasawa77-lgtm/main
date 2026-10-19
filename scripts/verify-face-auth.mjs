#!/usr/bin/env node
/*
 * verify-face-auth.mjs — face-auth.html（顔認証 / Face Unlock）の必須チェック
 *
 * 顔認証の壊れ方は、ほぼ全部「例外もエラーも出ない」:
 *   - 生体確認を飛ばしても画面は普通に「解除しました」と出る（写真で通るようになる）
 *   - 確認の後の照合を消しても同じ（まばたきの後に写真へ差し替えて通る）
 *   - 2人映っていても通る／登録に別人が混じっても登録できてしまう
 *   - カメラを止め忘れても画面は何も言わない
 * なので「起動して例外0件」では何も分からない。推定層（face-api）を合成データへ差し替え
 * （window.__FACEAUTH_SOURCE_FACTORY）、時刻も明示して 登録→解除→攻撃 を通しで流す。
 *
 *   1. 判定層（Node）: 目の縦横比・顔の向きの符号・中央値判定・登録の一貫性・検疫・ロックの倍化
 *   2. 静的: importmap の integrity の長さ（sha384=48バイト）と版の一致・CSP・innerHTML/eval 不使用
 *   3. 画面: 登録→本人で解除／写真（動かない）・別人・そっくりさん・確認後の差し替え・2人・見失い
 *            ・連続失敗のロック・起動失敗の理由・カメラの停止・壊れた保存データ・通信なし
 *
 * 使い方: node scripts/verify-face-auth.mjs [--inject]
 *   --inject … 防御を1つずつ壊したコピーで画面検査を流し、該当の ❌ が出ることを確かめる（偽の緑の防止）
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INJECT = process.argv.includes('--inject');
const PAGE = 'face-auth.html';
const CORE = 'assets/js/face-auth-core.js';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.json': 'application/json' };

let overrides = {};
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || PAGE;
  if (url === 'favicon.ico') { res.writeHead(204); res.end(); return; }
  if (overrides[url] != null) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(url)] || 'text/plain' }); res.end(overrides[url]); return;
  }
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let quiet = false;
let results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, ok: !!cond });
  if (!quiet) console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`);
};
const section = (t) => { if (!quiet) console.log(`\n■ ${t}`); };

/* ================= 1. 判定層（Node） ================= */
function pureTests() {
  section('判定層 / core logic');
  const require = createRequire(import.meta.url);
  const C = require(path.join(ROOT, CORE));
  const lm = synthLandmarks({ x: 100, y: 100, width: 200, height: 260 }, { ear: 0.3, yaw: 0 });
  const p0 = C.poseFromLandmarks(lm);
  check('目の縦横比（EAR）が作った値どおり', Math.abs(p0.ear - 0.3) < 1e-6, p0.ear.toFixed(3));
  const pl = C.poseFromLandmarks(synthLandmarks({ x: 100, y: 100, width: 200, height: 260 }, { ear: 0.3, yaw: 0.5 }));
  check('本人が左を向く（生の映像で鼻が右へ寄る）と向きが正', pl.yaw > 0.4, pl.yaw.toFixed(3));

  const A = person(1), B = person(2);
  const t = C.buildTemplate([0, 1, 2, 3, 4].map((i) => noisy(A, 0.12, 10 + i)), 1000);
  check('同じ人の5枚から型を作れる', t.ok && t.template.d.length === 128);
  const mix = C.buildTemplate([noisy(A, 0.1, 1), noisy(A, 0.1, 2), noisy(B, 0.1, 3), noisy(A, 0.1, 4), noisy(A, 0.1, 5)], 1000);
  check('登録に別人が混じったら型を作らない', !mix.ok && mix.code === 'inconsistent');
  const few = C.buildTemplate([noisy(A, 0.1, 1)], 1000);
  check('枚数が足りなければ作らない', !few.ok && few.code === 'too-few');

  const th = C.DEFAULTS.threshold.standard;
  const self = C.decide(t.template.d, [noisy(A, 0.12, 50), noisy(A, 0.12, 51), noisy(A, 0.12, 52)], th);
  check('本人は標準の閾値で通る', self.ok, 'd=' + self.distance.toFixed(3));
  const other = C.decide(t.template.d, [noisy(B, 0.12, 60), noisy(B, 0.12, 61), noisy(B, 0.12, 62)], th);
  check('別人は落ちる', !other.ok, 'd=' + other.distance.toFixed(3));
  // 3枚中1枚だけ偶然一致しても中央値なら落ちる
  const fluke = C.decide(t.template.d, [noisy(A, 0.05, 70), noisy(B, 0.1, 71), noisy(B, 0.1, 72)], th);
  check('1枚だけの偶然の一致では通らない（中央値で判定）', !fluke.ok);

  check('壊れた保存データは null（例外を投げない）', C.sanitizeTemplate('{oops') === null && C.sanitizeTemplate({ v: 1, d: [1, 2] }) === null
    && C.sanitizeTemplate({ v: 1, d: new Array(128).fill('x') }) === null && C.sanitizeTemplate(null) === null);
  check('正しい保存データは読める', !!C.sanitizeTemplate(JSON.stringify(t.template)));

  let lock = null;
  for (let i = 0; i < 5; i++) lock = C.recordFailure(lock, 0);
  const l1 = C.lockState(lock, 0);
  for (let i = 0; i < 5; i++) lock = C.recordFailure(lock, 40000);
  const l2 = C.lockState(lock, 40000);
  check('5回失敗でロック・2回目のロックは時間が倍', l1.locked && l1.remainMs === 30000 && l2.remainMs === 60000, `${l1.remainMs}→${l2.remainMs}`);
  check('壊れたロック情報は「ロック無し」へ落ちる', !C.lockState('garbage', 0).locked);

  const orders = new Set();
  let seed = 1; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) orders.add(C.pickChallenges(rand).join(','));
  check('生体確認の順番がランダム（4通りすべて出る）', orders.size === 4, [...orders].join(' / '));

  const multi = C.assessFrame({ width: 640, height: 480, faces: [{ box: { x: 200, y: 100, width: 200, height: 240 } }, { box: { x: 10, y: 10, width: 200, height: 240 } }] });
  check('顔が2つなら照合に使わない', !multi.ok && multi.code === 'multi');
  const small = C.assessFrame({ width: 640, height: 480, faces: [{ box: { x: 300, y: 200, width: 40, height: 50 } }] });
  check('顔が小さすぎれば使わない', !small.ok && small.code === 'small');
}

/* ================= 合成データ ================= */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }
function unit(v) { const n = Math.hypot(...v); return v.map((x) => x / n); }
function person(seed) { const r = rng(seed * 7919); return unit(Array.from({ length: 128 }, () => gauss(r))); }
function noisy(v, mag, seed) { const r = rng(seed * 104729 + 3); const n = unit(Array.from({ length: 128 }, () => gauss(r))); return v.map((x, i) => x + n[i] * mag); }
function towards(a, b, dist) { const d = b.map((x, i) => x - a[i]); const u = unit(d); return a.map((x, i) => x + u[i] * dist); }
function synthLandmarks(box, { ear, yaw }) {
  const pts = Array.from({ length: 68 }, () => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }));
  for (let i = 0; i <= 16; i++) pts[i] = { x: box.x + (box.width * i) / 16, y: box.y + box.height * 0.5 + Math.sin((i / 16) * Math.PI) * box.height * 0.4 };
  const mid = box.x + box.width / 2;
  pts[30] = { x: mid + (yaw * box.width) / 2, y: box.y + box.height * 0.55 };
  const eye = (cx, cy) => {
    const w = box.width * 0.16, h = ear * w;
    return [{ x: cx - w / 2, y: cy }, { x: cx - w / 6, y: cy - h / 2 }, { x: cx + w / 6, y: cy - h / 2 }, { x: cx + w / 2, y: cy }, { x: cx + w / 6, y: cy + h / 2 }, { x: cx - w / 6, y: cy + h / 2 }];
  };
  eye(box.x + box.width * 0.32, box.y + box.height * 0.38).forEach((p, i) => { pts[36 + i] = p; });
  eye(box.x + box.width * 0.68, box.y + box.height * 0.38).forEach((p, i) => { pts[42 + i] = p; });
  return pts;
}

/* ================= 2. 静的 ================= */
function staticTests() {
  section('静的 / static');
  const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
  const im = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  const url = im.imports['face-api'];
  const integ = im.integrity && im.integrity[url];
  const bytes = integ && integ.startsWith('sha384-') ? Buffer.from(integ.slice(7), 'base64').length : 0;
  check('importmap の integrity が sha384 の正しい長さ（48バイト）', bytes === 48, `${bytes}バイト`);
  const ver = (url.match(/face-api@([\d.]+)\//) || [])[1];
  const modelVer = (html.match(/MODEL_BASE = '[^']*face-api@([\d.]+)\//) || [])[1];
  check('版が固定されていて、本体とモデルの版が一致', !!ver && ver === modelVer, `${ver} / ${modelVer}`);
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  check('CSP: media-src に blob:（無いとカメラ映像が止まる）', /media-src[^;]*blob:/.test(csp));
  check('CSP: connect-src に cdn.jsdelivr.net（無いとモデルが取れない）', /connect-src[^;]*https:\/\/cdn\.jsdelivr\.net/.test(csp));
  const script = html.slice(html.indexOf('<script type="module">'));
  check('画面のスクリプトで innerHTML / eval / new Function を使っていない', !/innerHTML|\beval\s*\(|new Function/.test(script));
  check('getUserMedia で facingMode を exact で要求していない（PCのカメラで掴めなくなる）', !/facingMode\s*:\s*\{\s*exact/.test(html));
}

/* ================= 3. 画面 ================= */
const FAKE = `
(() => {
  window.__FACEAUTH_TEST = true;
  window.__FACEAUTH_MANUAL = true;
  window.__fa = { frame: null, starts: 0, stops: 0, startError: null, startDelay: 0, descReq: 0 };
  window.__FACEAUTH_SOURCE_FACTORY = () => ({
    async start() {
      window.__fa.starts++;
      if (window.__fa.startDelay) await new Promise((r) => setTimeout(r, window.__fa.startDelay));
      if (window.__fa.startError) throw window.__fa.startError;
    },
    async detect({ descriptor }) {
      const f = window.__fa.frame || { width: 640, height: 480, faces: [] };
      if (descriptor) window.__fa.descReq++;
      return { width: f.width, height: f.height, faces: f.faces.map((x) => ({ box: x.box, landmarks: x.landmarks, descriptor: descriptor ? x.descriptor : null })) };
    },
    stop() { window.__fa.stops++; },
  });
})();`;

async function browserTests(browser) {
  section('画面 / page');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(FAKE);
  const page = await ctx.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForFunction(() => window.FACE_AUTH);

  check('起動: 未登録で「顔で解除」は押せない', await page.$eval('#btnUnlock', (b) => b.disabled) && (await page.textContent('#regStatus')).includes('未登録'));

  const BOX = { x: 200, y: 110, width: 240, height: 290 };
  let T = 1_000_000;
  const setFrame = (desc, pose = { ear: 0.3, yaw: 0 }, extraFaces = 0) => page.evaluate(([d, lm, box, n]) => {
    const faces = d ? [{ box, landmarks: lm, descriptor: d }] : [];
    for (let i = 0; i < n; i++) faces.push({ box: { x: 10, y: 10, width: 200, height: 240 }, landmarks: lm, descriptor: d });
    window.__fa.frame = { width: 640, height: 480, faces };
  }, [desc, synthLandmarks(BOX, pose), BOX, extraFaces]);
  const step = (dt = 100) => { T += dt; return page.evaluate((t) => window.FACE_AUTH.step(t), T); };
  const phase = () => page.evaluate(() => window.FACE_AUTH.session && window.FACE_AUTH.session.phase);
  let seed = 100;
  const A = person(1), B = person(2);

  async function enroll(who) {
    await page.click('#btnEnroll');
    for (let i = 0; i < 5; i++) { await setFrame(noisy(who, 0.12, seed++)); await step(400); }
  }
  /** 認証を流す。opts で攻撃の形を変える */
  async function auth({ pre = A, live = A, post = A, moves = true, loseFor = 0 } = {}) {
    await page.click('#btnUnlock');
    if (!(await page.evaluate(() => !!window.FACE_AUTH.session))) return 'no-session';
    for (let i = 0; i < 3; i++) { await setFrame(noisy(pre, 0.12, seed++)); await step(); }
    if (await phase() !== 'live') return 'skipped-live:' + (await phase());
    const ch = await page.evaluate(() => window.FACE_AUTH.session.live.challenges);
    for (const c of ch) {
      if (loseFor) { await setFrame(null); await step(loseFor); if (await phase() === 'pre') return 'reset'; }
      if (!moves) { for (let i = 0; i < 100 && await phase() === 'live'; i++) { await setFrame(noisy(live, 0.12, seed++)); await step(100); } break; }
      if (c === 'blink') {
        for (const ear of [0.3, 0.31, 0.29, 0.3, 0.12, 0.3]) { await setFrame(noisy(live, 0.12, seed++), { ear, yaw: 0 }); await step(); }
      } else {
        const s = c === 'left' ? 1 : -1;
        for (const yaw of [0, 0.2 * s, 0.45 * s]) { await setFrame(noisy(live, 0.12, seed++), { ear: 0.3, yaw }); await step(); }
      }
    }
    for (let i = 0; i < 3 && await phase(); i++) { await setFrame(noisy(post, 0.12, seed++)); await step(); }
    return await page.evaluate(() => document.getElementById('unlocked').classList.contains('show') ? 'unlocked' : 'denied');
  }
  const fails = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('face_auth_lock_v1') || '{}').fails || 0; } catch (_) { return -1; } });

  // --- 登録 ---
  await page.click('#btnEnroll');
  await setFrame(noisy(A, 0.12, seed++), undefined, 1); await step(400);
  await setFrame(noisy(A, 0.12, seed++), undefined, 1); await step(400);
  check('登録: 2人映っている間は撮影しない', (await page.evaluate(() => window.FACE_AUTH.session.samples.length)) === 0);
  await page.click('#btnCancel');
  await page.click('#btnEnroll');
  for (const who of [A, A, B, A, A]) { await setFrame(noisy(who, 0.1, seed++)); await step(400); }
  check('登録: 別人が混じったら保存しない', await page.evaluate(() => localStorage.getItem('face_auth_template_v1') === null)
    && (await page.textContent('#result')).includes('登録できませんでした'));
  await enroll(A);
  const saved = await page.evaluate(() => localStorage.getItem('face_auth_template_v1') || '');
  check('登録: 128個の数字だけを保存（写真を保存しない）', (() => { try { const o = JSON.parse(saved); return o.d.length === 128 && saved.length < 4000 && !/data:|base64/.test(saved); } catch (_) { return false; } })(), `${saved.length}文字`);
  check('登録: 終わったらカメラを止める', await page.evaluate(() => window.__fa.stops >= window.__fa.starts));
  check('登録後「顔で解除」が押せる', !(await page.$eval('#btnUnlock', (b) => b.disabled)));

  // --- 本人 ---
  const r1 = await auth();
  check('本人: まばたき・首振りのあと解除できる', r1 === 'unlocked', r1);
  check('本人: 顔の違い（距離）を表示する', /顔の違い 0\.\d{3}/.test(await page.textContent('#result')));
  check('本人: 終わったらカメラを止める', await page.evaluate(() => window.__fa.stops >= window.__fa.starts));

  // --- 攻撃 ---
  const r2 = await auth({ moves: false });
  check('写真（まばたきも首振りもしない）は時間切れで落ちる', r2 === 'denied' && (await page.textContent('#result')).includes('動きが確認できません'), r2);
  check('失敗は回数に数える', (await fails()) === 1);
  const r3 = await auth({ pre: B, live: B, post: B });
  check('別人は落ちる', r3 === 'denied', r3);
  const C = towards(A, B, 0.55);
  const r4 = await auth({ pre: C, live: C, post: C });
  check('そっくりさん（距離0.55）は標準でも落ちる', r4 === 'denied', r4);
  // 実測で別人の中央値は0.436。ここを通すと別人の半数が通る（閾値を0.45へ戻す退行を捕まえる）
  const D = towards(A, B, 0.4);
  const r4b = await auth({ pre: D, live: D, post: D });
  check('別人の典型的な距離（0.40）は落ちる', r4b === 'denied', r4b);
  const r5 = await auth({ post: B });
  check('生体確認の後に別の顔（写真）へ差し替えると落ちる', r5 === 'denied', r5);
  // 攻撃で失敗が5回に達してロックがかかるので、ここで一度戻す（ロック自体は後段で検査する）
  await page.evaluate(() => localStorage.removeItem('face_auth_lock_v1'));
  const r6 = await auth({ loseFor: 1800 });
  check('途中で顔を見失ったら最初からやり直す', r6 === 'reset', r6);
  await page.click('#btnCancel');
  // 2人目が途中で入る
  await page.click('#btnUnlock');
  for (let i = 0; i < 3; i++) { await setFrame(noisy(A, 0.12, seed++)); await step(); }
  await setFrame(noisy(A, 0.12, seed++), undefined, 1); await step();
  check('生体確認の途中で2人目が映ったら最初からやり直す', (await phase()) === 'pre');
  await page.click('#btnCancel');

  // --- ロック ---
  const before = await fails();
  for (let i = before; i < 5; i++) await auth({ pre: B, live: B, post: B });
  const startsBefore = await page.evaluate(() => window.__fa.starts);
  const r7 = await auth();
  check('5回続けて失敗するとロック（本人でもしばらく解除できない）', r7 === 'no-session' && (await page.textContent('#result')).includes('お待ちください'), r7);
  check('ロック中はカメラを起動しない', (await page.evaluate(() => window.__fa.starts)) === startsBefore);
  await page.evaluate(() => localStorage.setItem('face_auth_lock_v1', JSON.stringify({ fails: 0, until: 0, level: 1 })));
  const r8 = await auth();
  check('ロックが明けたら本人は解除でき、失敗回数が戻る', r8 === 'unlocked' && (await fails()) === 0, r8);

  // --- カメラの後始末 ---
  await page.click('#btnUnlock');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  check('画面を離れたらカメラを止める', await page.evaluate(() => !window.FACE_AUTH.session && window.__fa.stops >= window.__fa.starts));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
  await page.evaluate(() => { window.__fa.startDelay = 300; });
  await page.click('#btnUnlock');
  await page.click('#btnCancel');
  await page.waitForTimeout(400);
  check('起動中に止めてもカメラが残らない', await page.evaluate(() => !window.FACE_AUTH.session && window.__fa.stops >= window.__fa.starts));
  await page.evaluate(() => { window.__fa.startDelay = 0; window.__fa.startError = Object.assign(new Error('camera'), { stage: 'camera', cause: { name: 'NotAllowedError' } }); });
  await page.click('#btnUnlock');
  check('カメラを拒否されたら理由と次の一手を出す', (await page.textContent('#err')).includes('許可') && await page.isVisible('#err'));
  await page.evaluate(() => { window.__fa.startError = Object.assign(new Error('lib'), { stage: 'lib' }); });
  await page.click('#btnUnlock');
  check('ライブラリが読めないときも理由を出す', (await page.textContent('#err')).includes('integrity'));
  check('起動に失敗したらボタンが戻る（押せないまま固まらない）', !(await page.$eval('#btnUnlock', (b) => b.disabled)));
  await page.evaluate(() => { window.__fa.startError = null; });

  // --- 削除 ---
  await page.click('#btnDelete');
  check('「消去」で登録データが消える', await page.evaluate(() => localStorage.getItem('face_auth_template_v1') === null) && await page.$eval('#btnUnlock', (b) => b.disabled));

  check('通信はこのサイトの中だけ（顔の特徴量を外へ送らない）', requests.every((u) => u.startsWith(BASE)), `${requests.length}件`);
  check('ページ例外・コンソールエラー 0件', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();

  // --- 壊れた保存領域 ---
  const ctx2 = await browser.newContext();
  await ctx2.addInitScript(FAKE);
  await ctx2.addInitScript(() => { try { localStorage.setItem('face_auth_template_v1', '{"v":1,"d":[1,2,"x"]}'); localStorage.setItem('face_auth_lock_v1', 'zzz'); } catch (_) {} });
  const p2 = await ctx2.newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(String(e)));
  await p2.goto(`${BASE}/${PAGE}`); await p2.waitForFunction(() => window.FACE_AUTH);
  check('壊れた保存データでも起動し、未登録として扱う', e2.length === 0 && (await p2.textContent('#regStatus')).includes('未登録'));
  await ctx2.close();
  const ctx3 = await browser.newContext();
  await ctx3.addInitScript(FAKE);
  await ctx3.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } }); });
  const p3 = await ctx3.newPage(); const e3 = []; p3.on('pageerror', (e) => e3.push(String(e)));
  await p3.goto(`${BASE}/${PAGE}`); await p3.waitForFunction(() => window.FACE_AUTH);
  check('localStorage が使えない端末（シークレット等）でも起動する', e3.length === 0);
  await ctx3.close();
}

/* ================= 実行 ================= */
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});
let exitCode = 0;
try {
  if (!INJECT) {
    console.log('顔認証 / Face Unlock の検査');
    pureTests(); staticTests(); await browserTests(browser);
    const bad = results.filter((r) => !r.ok).length;
    console.log(`\n結果: ${results.length - bad}/${results.length} 合格`);
    exitCode = bad ? 1 : 0;
  } else {
    console.log('故障注入 / fault injection（防御を壊して ❌ が出るか）');
    const page = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
    const core = fs.readFileSync(path.join(ROOT, CORE), 'utf8');
    const cases = [
      ['生体確認を飛ばす', { [CORE]: core.replace('if (idx >= list.length) return info();', 'return Object.assign(info(), { done: true });') }, '写真（まばたきも首振りもしない）は時間切れで落ちる'],
      ['確認後の照合をやめる', { [PAGE]: page.replace('if (a.ok && b.ok)', 'if (a.ok)') }, '生体確認の後に別の顔（写真）へ差し替えると落ちる'],
      ['2人映っても通す', { [CORE]: core.replace('if (faces.length > 1)', 'if (false)') }, '生体確認の途中で2人目が映ったら最初からやり直す'],
      ['登録の一貫性検査をやめる', { [CORE]: core.replace('if (spread > o.enrollMaxSpread)', 'if (false)') }, '登録: 別人が混じったら保存しない'],
      ['閾値を甘い通説値（0.45）へ戻す', { [CORE]: core.replace('standard: 0.30', 'standard: 0.45') }, '別人の典型的な距離（0.40）は落ちる'],
      ['ロックを効かせない', { [CORE]: core.replace('if (l.fails >= o.maxFailures)', 'if (false)') }, '5回続けて失敗するとロック（本人でもしばらく解除できない）'],
      ['画面を離れてもカメラを止めない', { [PAGE]: page.replace('if (document.hidden && session) { end();', 'if (false) { end();') }, '画面を離れたらカメラを止める'],
    ];
    let missed = 0;
    for (const [name, ov, expect] of cases) {
      overrides = ov; results = []; quiet = true;
      // 壊し方が雑で検査ごと落ちた場合は「検出」と数えない（狙った検査が赤くなったかだけを見る）
      try { await browserTests(browser); } catch (e) { console.log(`    （検査が途中で落ちた: ${String(e).slice(0, 120)}）`); }
      quiet = false;
      const hit = results.find((r) => r.name === expect);
      const caught = hit && !hit.ok;
      if (!caught) missed++;
      console.log(`  ${caught ? '✅' : '❌'} ${name} → 「${expect}」が ${caught ? '❌ になった' : '緑のまま（すり抜け）'}`);
    }
    overrides = {};
    console.log(`\n結果: ${cases.length - missed}/${cases.length} 件を検出`);
    exitCode = missed ? 1 : 0;
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
