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
 *   7. 隣国への出兵→BattleSceneでヘックス合戦を最大10ラウンド消化→MapSceneへ帰還
 *   8. 3陣営（足利方・南朝方・地方勢力1家）それぞれ最大65ターン自動進行させ、
 *      CutsceneScene（年代記イベント演出）・EndingScene（南北朝合一エンディング）への
 *      到達を含めて例外が出ないか確認する
 *   9. 上記すべてで例外が0件（ページ全体の未捕捉例外＋GameKitがフレーム内で捕捉した例外）
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

  n = await total();
  const battleSetup = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    const st = D.Rule.buildState({ playerCamp: 'nancho' });
    D.game.changeScene(new D.MapScene(st));
    const player = st.playerCamp;
    const mine = Object.values(st.provinces).find(pv => pv.owner === player);
    const provDef = D.DATA.provById[mine.id];
    const enemyNeighborId = (provDef.adjacency || []).find(id => st.provinces[id] && st.provinces[id].owner !== player);
    if (!enemyNeighborId) return { ok: false };
    D.game.scene._launchAttack(D.game, mine.id, enemyNeighborId);
    return { ok: true, scene: D.game.scene.constructor.name };
  });
  await page.waitForTimeout(400);
  step(`6. 出兵→BattleSceneへ突入（${JSON.stringify(battleSetup)}）`, n, await total());

  n = await total();
  const battleOutcome = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    let rounds = 0;
    while (!D.game.scene.result && rounds < 12) { D.game.scene._endRound(D.game); rounds++; }
    const result = D.game.scene.result;
    if (result) D.game.scene.onDone(result);
    return { rounds, result, finalScene: D.game.scene.constructor.name };
  });
  await page.waitForTimeout(800);
  step(`7. 合戦を消化しMapSceneへ帰還（rounds=${battleOutcome.rounds}, finalScene=${battleOutcome.finalScene}）`, n, await total());
  check('7b. 合戦からMapSceneへ帰還できた', battleOutcome.finalScene === 'MapScene', JSON.stringify(battleOutcome));

  const finalScene = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.constructor.name);
  const framed = await frameErrors();
  await browser.close();
  return { steps, errors: errors.concat(framed.map(r => `${r.key}（${r.count}回）`)), finalScene };
}

async function runLongPlay(port, camp) {
  const browser = await chromium.launch({ executablePath: chromePath, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push((e.stack || String(e)).split('\n').slice(0, 3).join(' | ')));
  await page.goto(`http://127.0.0.1:${port}/taihei.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.TAIHEI_DEBUG !== 'undefined', null, { timeout: 60000 });

  const canvas = await page.$('#game');
  async function clickCanvas(cx, cy) {
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width * (cx / 1440), box.y + box.height * (cy / 810));
    await page.waitForTimeout(50);
  }
  const frameErrors = async () => page.evaluate(() =>
    (window.TAIHEI_DEBUG.game.errors || []).map(r => ({ key: r.key, count: r.count }))).catch(() => []);

  await page.evaluate((camp) => {
    const D = window.TAIHEI_DEBUG;
    const st = D.Rule.buildState({ playerCamp: camp });
    D.game.changeScene(new D.MapScene(st));
  }, camp);
  await page.waitForTimeout(100);

  let turns = 0, cutscenes = 0, endingReached = false, stuckOn = null;
  // イテレーション予算はターン進行だけでなくカットシーンの送りクリックも1回として消費するため、
  // シナリオ上限(61ターン)へ確実に到達できるよう61より十分大きい値にしてある
  // （2026-08-18 AIの朝廷工作バグ修正後、全陣営で史実イベントが均等に発火するようになり、
  // 旧予算65では一部陣営がターン61到達前に打ち切られていた）。
  for (let i = 0; i < 90; i++) {
    const name = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.constructor.name);
    if (name === 'MapScene') {
      await page.evaluate(() => window.TAIHEI_DEBUG.game.scene._endTurn(window.TAIHEI_DEBUG.game));
      await page.waitForTimeout(70);
      turns++;
    } else if (name === 'CutsceneScene') {
      cutscenes++;
      let guard = 0;
      while ((await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.constructor.name)) === 'CutsceneScene' && guard < 30) {
        await clickCanvas(720, 742); // 「次へ」ボタン中央（1クリック目は文字送りスキップも兼ねる）
        guard++;
      }
    } else if (name === 'EndingScene') {
      endingReached = true;
      break;
    } else {
      stuckOn = name;
      break;
    }
  }
  const finalScene = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.constructor.name);
  const framed = await frameErrors();
  await browser.close();
  return {
    camp, turns, cutscenes, endingReached, stuckOn, finalScene,
    errors: errors.concat(framed.map(r => `${r.key}（${r.count}回）`)),
  };
}

async function main() {
  const { server, port } = await serve(ROOT);

  // --- モバイル横画面ゲート ---
  await checkGate(port, '縦画面(Pixel 5)', { ...devices['Pixel 5'] }, true, true);
  await checkGate(port, '横画面(Pixel 5 landscape)', { ...devices['Pixel 5 landscape'] }, false, true);
  await checkGate(port, 'デスクトップ(非タッチ)', { viewport: { width: 1440, height: 900 } }, false, false);

  // --- 起動〜MapScene〜合戦〜ターン終了のフロー ---
  const flow = await runFlow(port);

  // --- 3陣営のロングラン（65ターン上限・カットシーン/エンディング到達を含む） ---
  const longPlays = [];
  for (const camp of ['ashikaga', 'nancho', 'ouchi']) {
    longPlays.push(await runLongPlay(port, camp));
  }
  server.close();

  console.log('\n=== ゲート表示条件 ===');
  results.forEach(r => console.log(`  ${r.ok ? '[PASS]' : '[FAIL]'} ${r.name}${r.ok ? '' : '  ' + r.detail}`));

  console.log('\n=== 起動〜合戦フロー ===');
  flow.steps.forEach(s => console.log(`  ${s.count === 0 ? '[PASS]' : '[FAIL]'} ${s.name}${s.count ? `  例外${s.count}件` : ''}`));
  console.log(`  最終シーン: ${flow.finalScene}`);
  if (flow.errors.length) {
    console.log(`  --- 例外 ${flow.errors.length}件 ---`);
    [...new Set(flow.errors)].slice(0, 8).forEach(e => console.log('   ✗ ' + e));
  }

  console.log('\n=== 3陣営ロングラン ===');
  longPlays.forEach(r => {
    const ok = r.errors.length === 0 && !r.stuckOn;
    console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${r.camp}: turns=${r.turns} cutscenes=${r.cutscenes} endingReached=${r.endingReached} stuckOn=${r.stuckOn || '-'} finalScene=${r.finalScene}`);
    if (r.errors.length) [...new Set(r.errors)].slice(0, 5).forEach(e => console.log('     ✗ ' + e));
  });

  const gateFail = results.filter(r => !r.ok).length;
  const flowFail = flow.steps.reduce((a, s) => a + (s.count > 0 ? 1 : 0), 0) + (flow.errors.length ? 1 : 0);
  const longPlayFail = longPlays.reduce((a, r) => a + (r.errors.length > 0 || r.stuckOn ? 1 : 0), 0);
  const totalFail = gateFail + flowFail + longPlayFail;
  console.log(`\n${totalFail === 0 ? 'PASS' : 'FAIL'}: ゲート${gateFail}件・フロー${flowFail}件・ロングラン${longPlayFail}件の不合格`);
  process.exit(totalFail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
