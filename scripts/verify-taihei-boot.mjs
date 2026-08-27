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
 *  10. シナリオ選択UI（'genko'本編／'kanno'観応の擾乱、ブラッシュアップで追加）:
 *      実クリックでTitle→ScenarioSelectScene→FactionSelectScene→OpeningScene→MapScene
 *      までscenarioIdが正しく引き継がれること、buildState()の'kanno'側で開始年より前に
 *      没した武将がdead:true・史実イベントの誤発火なし・北朝成立補正が効いていること
 *      （'genko'側は非該当のリグレッション確認）、武将肖像(drawGeneralPortrait)の描画で
 *      例外が出ないこと、武将名鑑パネル('roster')が全武将を一覧しクリック選択できること
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
  const battlefieldAsset = await page.evaluate(() => ({
    path: window.TAIHEI_DEBUG.BATTLEFIELD_ASSET,
    ready: window.TAIHEI_DEBUG.ASSETS_RT.battlefieldReady,
    width: window.TAIHEI_DEBUG.ASSETS_RT.battlefield?.naturalWidth || 0,
    height: window.TAIHEI_DEBUG.ASSETS_RT.battlefield?.naturalHeight || 0,
  }));
  check(
    '1b. 合戦フィールド画像を読み込めた',
    battlefieldAsset.ready && battlefieldAsset.width > 0 && battlefieldAsset.height > 0,
    JSON.stringify(battlefieldAsset),
  );

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

  // 拡大後の地図をマウスと1本指の双方でパンできること。
  const panCheck = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG, s = D.game.scene, c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    const toClient = (x, y) => ({ clientX: r.left + x / c.width * r.width, clientY: r.top + y / c.height * r.height });
    const fake = (x, y) => ({ touches: [toClient(x, y)], preventDefault() {} });
    s.cam.zoom = 2; s.cam.cx = 600; s.cam.cy = 330; s._clampCam();
    s._onTouchStart(fake(400, 300)); s._onTouchMove(fake(500, 300)); s._onTouchEnd({ touches: [] });
    const touchMoved = s.cam.cx < 600;
    s.cam.cx = 600; s.cam.cy = 330; s._clampCam();
    return { touchMoved, beforeMouse: s.cam.cx, rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
  });
  const mx1 = panCheck.rect.left + 400 / 1440 * panCheck.rect.width;
  const my = panCheck.rect.top + 300 / 900 * panCheck.rect.height;
  const mx2 = panCheck.rect.left + 500 / 1440 * panCheck.rect.width;
  await page.mouse.move(mx1, my); await page.mouse.down(); await page.mouse.move(mx2, my, { steps: 4 }); await page.mouse.up();
  const mouseAfter = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.cam.cx);
  check('4c. 拡大地図を1本指ドラッグで移動できる', panCheck.touchMoved, JSON.stringify(panCheck));
  check('4d. 拡大地図をマウスドラッグで移動できる', mouseAfter < panCheck.beforeMouse, `before=${panCheck.beforeMouse} after=${mouseAfter}`);

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
  await page.evaluate(() => window.TAIHEI_READY); // BootSceneの遅延完了によるTitleScene上書きを防ぐ

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
  // 90回の操作予算で、月次イベント・カットシーン・早期エンディングを含む安定性を確認する。
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

/*
 * runScenarioChecks — シナリオ選択UI（'genko'本編／'kanno'観応の擾乱）のブラッシュアップ検証。
 *   A. 実クリックでTitle→ScenarioSelectScene→FactionSelectScene→OpeningSceneまでボタン配線を確認
 *      （UI組み込みの正しさを検証。他フローはデバッグブリッジ直接呼び出しで速度優先しているため、
 *      新設シーンの遷移だけは意図的に本物のクリックで通す）
 *   B. buildState()の直接呼び出しで、'kanno'(1350年開始)側のみ:
 *      - 開始年より前に没した武将(後醍醐帝・楠木正成)がdead:trueで初期化されること
 *      - 開始年時点で存命の武将(足利直義)はdead:falseのままであること
 *      - 北朝(hokucho)が開始時点で成立済み(active:true)として補正されること
 *      - シナリオ開始年より前の史実イベント(湊川の戦い等)がturn===0時点で誤発火しないこと
 *        （このガードが無いと、開始年の遅いシナリオでは過去の全イベントが連鎖発火する）
 *      'genko'(1331年開始)側は上記いずれも該当しないことをリグレッションとして確認する
 *   C. 武将肖像(drawGeneralPortrait)がFactionSelectScene描画・MapScene人事パネル描画のいずれでも
 *      例外を出さないこと
 *   D. 武将名鑑パネル('roster')が例外なく描画され、全武将（GENERALS_DEF全件）がクリック可能な
 *      行として存在し、行クリックで選択(rosterSel)が切り替わること
 */
async function runScenarioChecks(port) {
  const browser = await chromium.launch({ executablePath: chromePath, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('pageerror: ' + (e.message || String(e))));
  await page.goto(`http://127.0.0.1:${port}/taihei.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.TAIHEI_DEBUG !== 'undefined', null, { timeout: 60000 });

  const canvas = await page.$('#game');
  async function clickCanvas(cx, cy) {
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width * (cx / 1440), box.y + box.height * (cy / 810));
    await page.waitForTimeout(70);
  }
  const frameErrCount = async () => (await page.evaluate(() =>
    (window.TAIHEI_DEBUG.game.errors || []).map(r => r.count))).reduce((a, b) => a + b, 0);

  // --- A. 実クリックでのシーン遷移 ---
  await page.evaluate(() => { window.TAIHEI_DEBUG.game.changeScene(new window.TAIHEI_DEBUG.TitleScene()); });
  await page.waitForTimeout(120);
  await clickCanvas(720, 499); // TitleScene「新規に始める」ボタン中心
  await page.waitForTimeout(200); // requestAnimationFrame後のchangeScene反映を待つ
  let scene = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.constructor.name);
  check('シナリオUI: 「新規に始める」→ScenarioSelectScene', scene === 'ScenarioSelectScene', `scene=${scene}`);

  await clickCanvas(720, 640); // rows[5]='genchu_itto' 行中心
  await clickCanvas(1230, 752); // 「このシナリオで始める」ボタン中心
  scene = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.constructor.name);
  let scenarioId = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.scenarioId);
  check('シナリオUI: 「元中の一統」選択→FactionSelectScene(scenarioId継承)', scene === 'FactionSelectScene' && scenarioId === 'genchu_itto', `scene=${scene} scenarioId=${scenarioId}`);

  await clickCanvas(270, 234); // FACTION_CHOICES[1]='nancho' 行中心
  await clickCanvas(1230, 752); // 「この陣営で始める」ボタン中心
  scene = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.constructor.name);
  scenarioId = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.scenarioId);
  check('シナリオUI: 陣営決定→OpeningScene(scenarioId継承)', scene === 'OpeningScene' && scenarioId === 'genchu_itto', `scene=${scene} scenarioId=${scenarioId}`);

  await clickCanvas(720, 738); // OpeningScene「陣営を確定する」ボタン中心
  await page.waitForTimeout(300);
  const built = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    const sc = D.game.scene;
    const st = sc.constructor.name === 'MapScene' ? sc.state
      : (sc.constructor.name === 'CutsceneScene' ? sc.state : null);
    return { scene: sc.constructor.name, scenarioId: st ? st.scenarioId : null, year: st ? st.year : null, month: st ? st.month : null };
  });
  check('シナリオUI: 開始確定→MapScene到達・scenarioId="genchu_itto"・1392年9月',
    built.scene === 'MapScene' && built.scenarioId === 'genchu_itto' && built.year === 1392 && built.month === 9,
    JSON.stringify(built));

  // --- B. buildState()のシナリオ別データ整合性（デバッグブリッジ直接呼び出し） ---
  const dataCheck = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    const kanno = D.Rule.buildState({ playerCamp: 'nancho', scenarioId: 'kanno' });
    const genko = D.Rule.buildState({ playerCamp: 'nancho', scenarioId: 'genko' });
    const sixScenarios = D.SCENARIOS.map((s) => ({ id: s.id, year: s.startYear, month: s.startMonth, maxTurns: s.maxTurns }));
    const monthly = D.Rule.buildState({ playerCamp: 'nancho', scenarioId: 'genko' });
    D.Rule.endTurn(monthly);
    const yearRollover = D.Rule.buildState({ playerCamp: 'nancho', scenarioId: 'genko' });
    yearRollover.year = 1331; yearRollover.month = 12;
    D.Rule.endTurn(yearRollover);
    const finale = D.Rule.buildState({ playerCamp: 'nancho', scenarioId: 'genchu_itto' });
    D.Rule.endTurn(finale);
    const kannoOwners = Object.values(kanno.provinces).map((p) => p.owner);
    const kannoAshikagaCount = kannoOwners.filter((o) => o === 'ashikaga').length;
    const kannoTotal = kannoOwners.length;
    return {
      kannoYear: kanno.year,
      kannoGodaigoDead: kanno.generals.godaigo.dead,
      kannoKusunokiDead: kanno.generals.kusunoki_masashige.dead,
      kannoTadayoshiAlive: !kanno.generals.ashikaga_tadayoshi.dead,
      kannoHokuchoActive: kanno.courts.hokucho.active,
      kannoNoEarlyEvents: !kanno.firedEvents.kamakura_bakufu_fall && !kanno.firedEvents.minatogawa && !kanno.firedEvents.engen_no_ran,
      kannoNanchoCore: ['yamato', 'kawachi', 'kii'].every((pid) => kanno.provinces[pid].owner === 'nancho'),
      kannoChihouHomeKept: kanno.provinces.suo.owner === 'ouchi' && kanno.provinces.satsuma.owner === 'shimazu',
      kannoAshikagaMajority: kannoAshikagaCount / kannoTotal,
      kannoTotal,
      kannoAshikagaCourtIsHokucho: kanno.camps.ashikaga.court === 'hokucho',
      kannoNoInstantEnding: kanno.ending === null, // buildState直後（0ターン目）で即エンディング確定していないか
      genkoYear: genko.year,
      genkoGodaigoAlive: !genko.generals.godaigo.dead,
      genkoHokuchoInactive: !genko.courts.hokucho.active,
      genkoNanchoOwnsYamashiro: genko.provinces.yamashiro.owner === 'nancho', // 'kanno'補正が'genko'に混入していないか
      genkoAshikagaCourtIsNancho: genko.camps.ashikaga.court === 'nancho', // 建武期の史実初期値（リグレッション）
      rosterCount: D.GENERALS_DEF.length,
      rosterUniqueIds: new Set(D.GENERALS_DEF.map((g) => g.id)).size,
      genkoYoshimitsuUnborn: genko.generals.ashikaga_yoshimitsu.unborn === true,
      finaleYoshimitsuActive: finale.generals.ashikaga_yoshimitsu.unborn === false && finale.generals.ashikaga_yoshimitsu.dead === false,
      sixScenarios,
      monthlyDate: [monthly.year, monthly.month],
      yearRolloverDate: [yearRollover.year, yearRollover.month],
      finaleDate: [finale.year, finale.month],
      finaleEnding: finale.ending,
      genkoFactionLabels: [D.factionInfo('ashikaga', 'genko').jp, D.factionInfo('nancho', 'genko').jp],
    };
  });
  check('buildState: kanno開始年=1350', dataCheck.kannoYear === 1350, JSON.stringify(dataCheck));
  check('buildState: kannoは後醍醐帝(没1339)が開始時点で故人', dataCheck.kannoGodaigoDead, JSON.stringify(dataCheck));
  check('buildState: kannoは楠木正成(没1336)が開始時点で故人', dataCheck.kannoKusunokiDead, JSON.stringify(dataCheck));
  check('buildState: kannoは足利直義(没1352)が開始時点で存命', dataCheck.kannoTadayoshiAlive, JSON.stringify(dataCheck));
  check('buildState: kannoは北朝が開始時点で成立済み', dataCheck.kannoHokuchoActive, JSON.stringify(dataCheck));
  check('buildState: kannoでシナリオ開始年より前の史実イベントが誤発火しない', dataCheck.kannoNoEarlyEvents, JSON.stringify(dataCheck));
  check('buildState: kannoは南朝が大和・河内・紀伊の3国に縮小している', dataCheck.kannoNanchoCore, JSON.stringify(dataCheck));
  check('buildState: kannoでも地方5家の本国は維持される', dataCheck.kannoChihouHomeKept, JSON.stringify(dataCheck));
  check('buildState: kannoは足利方が全国の過半数を領有している（幕府平定後の近似）', dataCheck.kannoAshikagaMajority > 0.5 && dataCheck.kannoTotal === 66, JSON.stringify(dataCheck));
  check('buildState: genko開始年=1331（リグレッション）', dataCheck.genkoYear === 1331, JSON.stringify(dataCheck));
  check('buildState: genkoは後醍醐帝が開始時点で存命（リグレッション）', dataCheck.genkoGodaigoAlive, JSON.stringify(dataCheck));
  check('buildState: genkoは北朝が開始時点で未成立（リグレッション）', dataCheck.genkoHokuchoInactive, JSON.stringify(dataCheck));
  check('buildState: genkoの領有はkanno補正の影響を受けない（リグレッション）', dataCheck.genkoNanchoOwnsYamashiro, JSON.stringify(dataCheck));
  check('武将データ: 太平風雲記の全200名を一意なIDで登録', dataCheck.rosterCount >= 200 && dataCheck.rosterUniqueIds === dataCheck.rosterCount, JSON.stringify(dataCheck));
  check('武将データ: 1331年時点の足利義満は未登場', dataCheck.genkoYoshimitsuUnborn, JSON.stringify(dataCheck));
  check('武将データ: 1392年時点の足利義満は登場済み', dataCheck.finaleYoshimitsuActive, JSON.stringify(dataCheck));
  check('シナリオ構成: 指定された6本を正しい開始年で登録',
    JSON.stringify(dataCheck.sixScenarios.map((s) => [s.id, s.year])) === JSON.stringify([['genko',1331],['kenmu',1334],['nanboku',1338],['kanno',1350],['yoshimitsu',1378],['genchu_itto',1392]]), JSON.stringify(dataCheck.sixScenarios));
  check('月ターン: 1331年5月→1331年6月（年が進まない）', JSON.stringify(dataCheck.monthlyDate) === '[1331,6]', JSON.stringify(dataCheck));
  check('月ターン: 12月→翌年1月だけ年を繰り上げる', JSON.stringify(dataCheck.yearRolloverDate) === '[1332,1]', JSON.stringify(dataCheck));
  check('最終シナリオ: 1392年9月→10月で南北朝合一エンド', JSON.stringify(dataCheck.finaleDate) === '[1392,10]' && dataCheck.finaleEnding === 'tenka_taihei', JSON.stringify(dataCheck));
  check('1331年陣営名: 北朝・南朝を使わない', dataCheck.genkoFactionLabels[0] === '鎌倉幕府・足利方' && dataCheck.genkoFactionLabels[1] === '後醍醐・倒幕方', JSON.stringify(dataCheck));

  // --- E. エンディング文言のシナリオ対応（endingTextFor）と三種の神器演出（drawSanshuNoJingi） ---
  const endingCheck = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    const kanno = D.Rule.buildState({ playerCamp: 'nancho', scenarioId: 'kanno' });
    kanno.ending = 'nancho_unification';
    const nanchoBody = D.endingTextFor(kanno).body.map((l) => l.jp + l.en).join(' ');
    const genko = D.Rule.buildState({ playerCamp: 'ashikaga', scenarioId: 'genko' });
    genko.ending = 'hokucho_unification';
    const hokuchoBody = D.endingTextFor(genko).body.map((l) => l.jp + l.en).join(' ');
    return {
      kannoUsesGomurakami: nanchoBody.includes('後村上天皇') && !nanchoBody.includes('{'),
      genkoHokuchoUsesKougon: hokuchoBody.includes('光厳天皇') && !hokuchoBody.includes('{'),
    };
  });
  check('endingTextFor: kannoの南朝統一エンディングは後村上天皇を差し込む', endingCheck.kannoUsesGomurakami, JSON.stringify(endingCheck));
  check('endingTextFor: genkoの北朝統一エンディングは光厳天皇のまま（リグレッション）', endingCheck.genkoHokuchoUsesKougon, JSON.stringify(endingCheck));

  // --- C. 武将肖像の描画が例外を出さないこと ---
  let before = await frameErrCount();
  await page.evaluate(() => { window.TAIHEI_DEBUG.game.changeScene(new window.TAIHEI_DEBUG.FactionSelectScene('genko')); });
  await page.waitForTimeout(200);
  let after = await frameErrCount();
  check('武将肖像: FactionSelectScene描画で例外0件', after === before, `before=${before} after=${after}`);

  before = after;
  await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    const st = D.Rule.buildState({ playerCamp: 'nancho', scenarioId: 'genko' });
    D.game.changeScene(new D.MapScene(st));
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => { window.TAIHEI_DEBUG.game.scene.panel = 'personnel'; });
  await page.waitForTimeout(200);
  after = await frameErrCount();
  check('武将肖像: MapScene人事パネル描画で例外0件', after === before, `before=${before} after=${after}`);

  // --- D. 武将名鑑パネル（'roster'）: 200名をページ表示でき、選択クリックで詳細が切り替わること ---
  before = after;
  await page.evaluate(() => { window.TAIHEI_DEBUG.game.scene.panel = 'roster'; });
  await page.waitForTimeout(200);
  after = await frameErrCount();
  check('武将名鑑: パネル描画で例外0件', after === before, `before=${before} after=${after}`);

  const rosterInfo = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    const rows = D.game.scene.buttons.filter((b) => !b.jp);
    const pages = Math.ceil(Math.max(
      D.GENERALS_DEF.filter((g) => g.camp === 'ashikaga').length,
      D.GENERALS_DEF.filter((g) => g.camp === 'nancho').length,
      D.GENERALS_DEF.filter((g) => g.camp !== 'ashikaga' && g.camp !== 'nancho').length,
    ) / 18);
    return { rowCount: rows.length, pages, generalCount: D.GENERALS_DEF.length, selBefore: D.game.scene.rosterSel };
  });
  check('武将名鑑: 200名を複数ページで閲覧できる', rosterInfo.generalCount >= 200 && rosterInfo.pages > 1 && rosterInfo.rowCount > 0, JSON.stringify(rosterInfo));

  // 現在ページの最後の武将行をクリックして選択が切り替わることを確認する
  before = after;
  const lastRowBox = await page.evaluate(() => {
    const b = window.TAIHEI_DEBUG.game.scene.buttons;
    const rows = b.filter((item) => !item.jp);
    const row = rows[rows.length - 1];
    return { x: row.x, y: row.y, w: row.w, h: row.h };
  });
  await clickCanvas(lastRowBox.x + lastRowBox.w / 2, lastRowBox.y + lastRowBox.h / 2);
  const rosterSelAfter = await page.evaluate(() => window.TAIHEI_DEBUG.game.scene.rosterSel);
  after = await frameErrCount();
  check('武将名鑑: 行クリックで選択武将が切り替わる', rosterSelAfter !== rosterInfo.selBefore, `before=${rosterInfo.selBefore} after=${rosterSelAfter}`);
  check('武将名鑑: 選択切り替え後も例外0件', after === before, `before=${before} after=${after}`);

  // --- F. 朝廷パネル（三種の神器演出 drawSanshuNoJingi）が玉座保持あり（南朝）で例外0件、
  //        かつ drawSanshuNoJingi自体が未保持時のグレー配色でも例外を出さないこと ---
  before = after;
  await page.evaluate(() => { window.TAIHEI_DEBUG.game.scene.panel = 'court'; window.TAIHEI_DEBUG.game.scene.courtTab = 'nancho'; });
  await page.waitForTimeout(150);
  after = await frameErrCount();
  check('三種の神器: 朝廷パネル(南朝・玉座保持あり)描画で例外0件', after === before, `before=${before} after=${after}`);

  const jingiUnheldOk = await page.evaluate(() => {
    const D = window.TAIHEI_DEBUG;
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    try { D.drawSanshuNoJingi(ctx, 100, 100, 11, '#475569'); return true; } catch (e) { return false; }
  });
  check('三種の神器: 未保持（グレー配色）でも例外を出さない', jingiUnheldOk, '');

  check('シナリオUI一式: ページ全体の未捕捉例外0件', pageErrors.length === 0, pageErrors.join(' | '));
  await browser.close();
}

async function main() {
  const { server, port } = await serve(ROOT);

  // --- モバイル横画面ゲート ---
  await checkGate(port, '縦画面(Pixel 5)', { ...devices['Pixel 5'] }, true, true);
  await checkGate(port, '横画面(Pixel 5 landscape)', { ...devices['Pixel 5 landscape'] }, false, true);
  await checkGate(port, 'デスクトップ(非タッチ)', { viewport: { width: 1440, height: 900 } }, false, false);

  // --- 起動〜MapScene〜合戦〜ターン終了のフロー ---
  const flow = await runFlow(port);

  // --- シナリオ選択UI（'kanno'観応の擾乱）ブラッシュアップの検証 ---
  await runScenarioChecks(port);

  // --- 3陣営のロングラン（65ターン上限・カットシーン/エンディング到達を含む） ---
  const longPlays = [];
  for (const camp of ['ashikaga', 'nancho', 'ouchi']) {
    longPlays.push(await runLongPlay(port, camp));
  }
  server.close();

  console.log('\n=== ゲート表示条件・シナリオ選択UI ===');
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
  console.log(`\n${totalFail === 0 ? 'PASS' : 'FAIL'}: ゲート/シナリオUI${gateFail}件・フロー${flowFail}件・ロングラン${longPlayFail}件の不合格`);
  process.exit(totalFail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
