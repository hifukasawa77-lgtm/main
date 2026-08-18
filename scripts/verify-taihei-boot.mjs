#!/usr/bin/env node
/*
 * verify-taihei-boot.mjs — 太平風雲記が「起動して遊べる状態か」＋「モバイル横画面ゲート」を機械検査する
 *
 * 背景: sengoku.html と同じく GameKit のフレームループは例外を捕捉して継続するため、
 * pageerror だけを見る検査はタイトルが出た時点で素通りする。必ず game.errors（捕捉済み）
 * も合算し、MapScene まで実際に入ってフレームを回して確認する。
 * 加えて本検査は「モバイル横画面ゲート」（2026-08-18 追加）の表示条件を確認する:
 *   タッチ端末×縦画面でのみ landscapeGate が表示され、横画面では非表示になること。
 *
 * 検査:
 *   1. 起動〜タイトル画面へ到達
 *   2. モバイル縦画面（タッチエミュレーション）でゲートが表示される
 *   3. モバイル横画面でゲートが非表示になる
 *   4. デスクトップ（非タッチ）ではゲートに taihei-touch クラスが付かず常時非表示
 *   5. 陣営選択→オープニング→MapScene まで到達しフレームを回す
 *   6. ターン終了を1回通す
 *   7. 上記すべてで例外が0件（ページ全体の未捕捉例外＋GameKitがフレーム内で捕捉した例外）
 *
 * 使い方: node scripts/verify-taihei-boot.mjs
 * 終了コード: 全PASS=0 / FAILあり=1
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

function serve(root) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      if (rel === 'favicon.ico') { res.writeHead(204); res.end(); return; }
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); };
const chromePath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

async function checkGate(port, label, contextOpts, expectGateVisible, expectTouchClass) {
  const browser = await chromium.launch({ executablePath: chromePath, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + (e.message || String(e))));
  await page.goto(`http://127.0.0.1:${port}/taihei.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.TAIHEI_DEBUG !== 'undefined', null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => {
    const g = document.getElementById('landscapeGate');
    return {
      gateVisible: getComputedStyle(g).display !== 'none',
      hasTouchClass: document.body.classList.contains('taihei-touch'),
    };
  });
  await browser.close();
  check(`${label}: ゲート表示=${expectGateVisible}`, state.gateVisible === expectGateVisible, JSON.stringify(state));
  if (expectTouchClass !== undefined) {
    check(`${label}: タッチクラス=${expectTouchClass}`, state.hasTouchClass === expectTouchClass, JSON.stringify(state));
  }
  check(`${label}: 例外0件`, errors.length === 0, errors.join(' | '));
}

async function runFlow(port) {
  const browser = await chromium.launch({ executablePath: chromePath, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push((e.stack || String(e)).split('\n').slice(0, 3).join(' | ')));

  const frameErrors = async () => page.evaluate(() =>
    (typeof window.TAIHEI_DEBUG !== 'undefined' && window.TAIHEI_DEBUG.game && window.TAIHEI_DEBUG.game.errors)
      ? window.TAIHEI_DEBUG.game.errors.map(r => ({ key: r.key, count: r.count }))
      : []).catch(() => []);
  const total = async () => {
    const fe = await frameErrors();
    return errors.length + fe.reduce((a, r) => a + r.count, 0);
  };
  const steps = [];
  const step = (name, before, now) => steps.push({ name, count: now - before });

  await page.goto(`http://127.0.0.1:${port}/taihei.html`, { waitUntil: 'domcontentloaded' });
  let n = 0;
  await page.waitForFunction(
    () => typeof window.TAIHEI_DEBUG !== 'undefined' && window.TAIHEI_DEBUG.game.scene
      && window.TAIHEI_DEBUG.game.scene.constructor.name === 'TitleScene',
    null, { timeout: 60000 });
  await page.waitForTimeout(500);
  step('1. タイトル画面へ到達', n, await total());

  n = await total();
  const entered = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    D.game.changeScene(new D.FactionSelectScene());
    return D.game.scene.constructor.name;
  });
  await page.waitForTimeout(300);
  step(`2. 陣営選択画面へ（scene=${entered}）`, n, await total());

  n = await total();
  const opened = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    D.game.changeScene(new D.OpeningScene('nancho'));
    return D.game.scene.constructor.name;
  });
  await page.waitForTimeout(500);
  step(`3. オープニング演出へ（scene=${opened})`, n, await total());

  n = await total();
  const mapEntered = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    const st = D.Rule && D.Rule.buildState ? D.Rule.buildState({ playerCamp: 'nancho' }) : null;
    if (!st) return 'no-buildState';
    D.game.changeScene(new D.MapScene(st));
    return D.game.scene.constructor.name;
  });
  await page.waitForTimeout(3000); // 遅延アセット（地図画像等）が届く間もフレームを回す
  step(`4. MapScene で描画（scene=${mapEntered}）`, n, await total());
  check('4b. MapScene に到達できた', mapEntered === 'MapScene', `scene=${mapEntered}`);

  n = await total();
  const endedOk = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG, s = D.game.scene;
    if (typeof s._endTurn === 'function') { s._endTurn(D.game); return 'ok:_endTurn'; }
    if (typeof s.endTurn === 'function') { s.endTurn(D.game); return 'ok:endTurn'; }
    return 'no-endTurn-method';
  });
  await page.waitForTimeout(1500);
  step(`5. ターン終了を1回（${endedOk}）`, n, await total());

  const finalScene = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.constructor.name);
  const framed = await frameErrors();
  await browser.close();
  return { steps, errors: errors.concat(framed.map(r => `${r.key}（${r.count}回）`)), finalScene };
}

async function main() {
  const { server, port } = await serve(ROOT);

  // --- モバイル横画面ゲート ---
  await checkGate(port, '縦画面(Pixel 5)', { ...devices['Pixel 5'] }, true, true);
  await checkGate(port, '横画面(Pixel 5 landscape)', { ...devices['Pixel 5 landscape'] }, false, true);
  await checkGate(port, 'デスクトップ(非タッチ)', { viewport: { width: 1440, height: 900 } }, false, false);

  // --- 起動〜MapScene〜ターン終了のフロー ---
  const flow = await runFlow(port);
  server.close();

  console.log('\n=== ゲート表示条件 ===');
  results.forEach(r => console.log(`  ${r.ok ? '[PASS]' : '[FAIL]'} ${r.name}${r.ok ? '' : '  ' + r.detail}`));

  console.log('\n=== 起動フロー ===');
  flow.steps.forEach(s => console.log(`  ${s.count === 0 ? '[PASS]' : '[FAIL]'} ${s.name}${s.count ? `  例外${s.count}件` : ''}`));
  console.log(`  最終シーン: ${flow.finalScene}`);
  if (flow.errors.length) {
    console.log(`  --- 例外 ${flow.errors.length}件 ---`);
    [...new Set(flow.errors)].slice(0, 8).forEach(e => console.log('   ✗ ' + e));
  }

  const gateFail = results.filter(r => !r.ok).length;
  const flowFail = flow.steps.reduce((a, s) => a + (s.count > 0 ? 1 : 0), 0) + (flow.errors.length ? 1 : 0);
  const totalFail = gateFail + flowFail;
  console.log(`\n${totalFail === 0 ? 'PASS' : 'FAIL'}: ゲート${gateFail}件・フロー${flowFail}件の不合格`);
  process.exit(totalFail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
