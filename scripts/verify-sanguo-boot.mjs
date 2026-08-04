#!/usr/bin/env node
/*
 * verify-sanguo-boot.mjs — 三国志・天下三分が「起動して遊べる状態か」を機械検査する
 *
 * 背景: sanguo.html は GameKit を使わない自前ループなので、戦国風雲記のような
 * engine.errors の合算は要らない。ただし「タイトルが出た＝起動成功ではない」という
 * 教訓は同じで、必ずマップ画面まで入り、ターンを回してから判定する。
 * console.error も拾う（描画だけ死んで画面は出る型の障害を見逃さないため）。
 *
 * 検査:
 *   1. 起動〜シナリオ選択〜ストーリー〜勢力選択〜マップ到達
 *   2. 60ターン自動進行で pageerror / console.error / 404 が0件
 *   3. P8 増援：送り元−n・送り先+n・金と兵糧の減少・1巡1回・上限クランプ
 *   4. P11 政務：開始時 apMax=5、消費で減る、残0で各コマンドが塞がる、恩賞のみ通る、
 *      ターン終了で満タンへ戻る（繰り越さない）
 *   5. P9 肖像：名鑑194枚・スロット解決・一騎打ちの名乗りが例外なく描ける
 *   6. P10 AI：占領時に出撃元の武将が全滅しない／増援と目標保持が働く
 *   7. セーブ v2 互換：ap/apMax/aiGoal/reinforceTurn 欠落でも復元できる
 *
 * 使い方: node scripts/verify-sanguo-boot.mjs
 * 終了コード: 全PASS=0 / FAILあり=1
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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
      // ブラウザが勝手に取りに行くもの。404 を返すと console.error が出て検査が常に落ちる。
      if (rel === 'favicon.ico') { res.writeHead(204); res.end(); return; }
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        if(process.env.SANGUO_LOG404) console.log('  [404]', rel);
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

async function run(port) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + (e.message || String(e))));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url().slice(-90)));
  // Chrome の 404 由来 console.error は URL を持たない。応答側でも拾って場所を特定できるようにする。
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url().slice(-90)}`); });

  // SANGUO_DEBUG ブリッジを開ける。チュートリアルは「次のターン」を遮るので抑止しておく。
  await page.addInitScript(() => {
    window.__SANGUO_TEST = true;
    try { localStorage.setItem('sanguoTutorialSeen', '1'); } catch (e) {}
  });

  // --- 1. 起動〜マップ到達（UI を実際にクリックして通す） ---
  await page.goto(`http://127.0.0.1:${port}/sanguo.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.SANGUO_DEBUG, null, { timeout: 60000 });
  await page.click('#startButton');
  await page.waitForSelector('[data-scenario="1"]', { timeout: 15000 });
  await page.click('[data-scenario="1"]');
  await page.waitForSelector('#storyStart', { timeout: 15000 });
  await page.click('#storyStart');
  await page.waitForSelector('[data-fid="wei"]', { timeout: 15000 });
  await page.click('[data-fid="wei"]');
  await page.click('#pickStart');
  await page.waitForTimeout(1200);
  const onMap = await page.evaluate(() => window.SANGUO_DEBUG.state.screen === 'game'
    && !document.getElementById('gameScreen').classList.contains('hidden'));
  check('1. 起動〜マップ画面へ到達', onMap, onMap ? '' : 'マップ画面に入れていない');

  // --- 4a. 政務ポイントの初期値（190年 魏＝2都市・曹操 統96 → 5） ---
  const ap0 = await page.evaluate(() => {
    const S = window.SANGUO_DEBUG.state;
    return { ap: S.ap, apMax: S.apMax, hud: document.getElementById('apText').textContent };
  });
  check('4a. 政務ポイントの初期値が 5/5', ap0.apMax === 5 && ap0.ap === 5 && ap0.hud === '5/5',
    JSON.stringify(ap0));

  // --- 3. 増援 ---
  const reinf = await page.evaluate(() => {
    const D = window.SANGUO_DEBUG, S = D.state, out = {};
    S.selectedCity = 'xu_chang'; D.updateUI();
    const from = D.cityById['xu_chang'], to = D.cityById['he_fei'];
    const b = { from: from.garrison, to: to.garrison, gold: S.gold, food: S.food, ap: S.ap };
    D.doReinforce('xu_chang', 'he_fei', 20);
    out.moved = { dFrom: from.garrison - b.from, dTo: to.garrison - b.to,
                  dGold: S.gold - b.gold, dFood: S.food - b.food, dAp: S.ap - b.ap };
    // 同一巡の2回目は拒否される
    const g2 = from.garrison;
    D.doReinforce('xu_chang', 'he_fei', 20);
    out.secondBlocked = (from.garrison === g2);
    // 上限クランプ：送り先を上限直下にして大量に送っても溢れない
    from.reinforceTurn = 0; from.garrison = 200; to.garrison = 145;
    D.doReinforce('xu_chang', 'he_fei', 100);
    out.capped = to.garrison;
    return out;
  });
  check('3. 増援が兵・金・兵糧・政務を正しく動かす',
    reinf.moved.dFrom === -20 && reinf.moved.dTo === 20 && reinf.moved.dGold === -40
    && reinf.moved.dFood === -12 && reinf.moved.dAp === -1, JSON.stringify(reinf.moved));
  check('3b. 増援は1巡1回', reinf.secondBlocked, '');
  check('3c. 増援は送り先の上限でクランプされる', reinf.capped === 150, `到着側=${reinf.capped}`);

  // --- 4b. 政務ポイントのゲート ---
  const apGate = await page.evaluate(() => {
    const D = window.SANGUO_DEBUG, S = D.state, out = {};
    S.gold = 9999; S.food = 9999; S.ap = 0;             // AP だけが理由になる状態にする
    S.selectedCity = 'xu_chang'; D.updateUI();
    const dis = s => { const e = document.querySelector(s); return e ? e.disabled : null; };
    out.blocked = { agri: dis('[data-policy="agri"]'), grain: dis('[data-buygrain]'),
                    scout: dis('[data-action="scout"]'), reinforce: dis('[data-reinf]'),
                    march: dis('[data-target]') };
    out.rewardEnabled = dis('[data-reward]') === false;
    const gen = D.cityById['xu_chang'].generals[0], before = D.loyOf(gen);
    D.rewardGeneral(gen, 100);
    out.rewardWorks = D.loyOf(gen) > before;            // 恩賞は AP 0 でも通る
    out.reason = document.querySelector('[data-policy="agri"]').title;
    D.endTurn();
    out.afterEndTurn = { ap: S.ap, apMax: S.apMax };
    return out;
  });
  const allBlocked = Object.values(apGate.blocked).every(v => v === true);
  check('4b. 残0で内政・買付・探索・増援・出陣が塞がる', allBlocked, JSON.stringify(apGate.blocked));
  check('4c. 恩賞だけは残0でも通る', apGate.rewardEnabled && apGate.rewardWorks, '');
  check('4d. 不能理由が日英併記', /政務が足りない/.test(apGate.reason) && /Not enough actions/.test(apGate.reason), apGate.reason);
  check('4e. ターン終了で満タンへ戻る（繰り越さない）',
    apGate.afterEndTurn.ap === apGate.afterEndTurn.apMax, JSON.stringify(apGate.afterEndTurn));

  // --- 5. 肖像 ---
  const portrait = await page.evaluate(() => {
    const D = window.SANGUO_DEBUG;
    D.buildRoster();
    const cards = document.querySelectorAll('#rosterGrid .generalCard');
    const withBg = [...cards].filter(c => /background-image/.test(c.querySelector('.portrait').getAttribute('style') || ''));
    return { cards: cards.length, withBg: withBg.length, ids: D.GENERAL_IDS.length };
  });
  check('5. 名鑑が全スロット分の肖像を出す',
    portrait.cards === 194 && portrait.withBg === 194 && portrait.ids === 194, JSON.stringify(portrait));

  // 一騎打ちの名乗りが例外なく描けること（描画は rAF ではなくこの場で直接叩く）
  const duel = await page.evaluate(() => {
    const D = window.SANGUO_DEBUG, S = D.state;
    D.startBattle(D.cityById['xu_chang'], D.cityById['luo_yang']);
    const B = S.battle;
    const a = B.stacks.find(s => s.side === B.playerSide && s.gen);
    const d = B.stacks.find(s => s.side !== B.playerSide && s.gen);
    if (!a || !d) return { ok: false, why: '武将付きの部隊がいない' };
    d.col = a.col; d.row = a.row - 1;
    a.hasActed = false; a.duelDone = false; d.duelDone = false;
    if (!D.bDuelStart(a, d, null)) return { ok: false, why: 'bDuelStart が false' };
    const phases = ['hail', 'name', 'answer', 'clash', 'result'];
    for (const ph of phases) { B.duel.phase = ph; B.duel.t = 10; D.bDuelDraw(); }
    const hasGen = !!(B.duel.aGen && B.duel.dGen);
    D.bBackToMap();
    return { ok: true, hasGen };
  });
  check('5b. 一騎打ちの全フェーズが例外なく描ける', duel.ok && duel.hasGen, JSON.stringify(duel));

  // --- 6. AI（占領時に出撃元の武将が全滅しない／増援と目標保持） ---
  const ai = await page.evaluate(() => {
    const D = window.SANGUO_DEBUG, S = D.state;
    D.startScenario({ id: 'anti_dong_zhuo', title: '反董卓連合軍' }, 'wei', 'normal');
    let drained = 0, reinforceLogs = 0, goalTurns = 0;
    for (let i = 0; i < 50; i++) {
      const before = new Map(D.CITIES.map(c => [c.id, { owner: c.owner, g: (c.generals || []).length }]));
      D.endTurn();
      // 所有者が変わった都市があった巡に、2名以上いた自軍領が0名になっていないか
      const captured = D.CITIES.some(c => before.get(c.id).owner !== c.owner);
      if (captured) {
        D.CITIES.forEach(c => {
          const b = before.get(c.id);
          if (b.owner === c.owner && b.g >= 2 && (c.generals || []).length === 0) drained++;
        });
      }
      if (S.log.some(l => /の兵を送った/.test(l))) reinforceLogs++;
      if (Object.keys(S.aiGoal || {}).length) goalTurns++;
      if (S.over) break;
    }
    const cnt = {}; D.CITIES.forEach(c => cnt[c.owner] = (cnt[c.owner] || 0) + 1);
    const top = Math.max(...Object.values(cnt));
    return { drained, reinforceLogs, goalTurns, top };
  });
  check('6. 占領しても出撃元の武将が全滅しない', ai.drained === 0, `空になった都市=${ai.drained}`);
  check('6b. AIが増援を送る', ai.reinforceLogs > 0, `増援ログのあった巡=${ai.reinforceLogs}`);
  check('6c. AIが攻撃目標を保持する', ai.goalTurns > 0, `目標を持っていた巡=${ai.goalTurns}`);
  // 乱数の種を固定していないので、最大勢力の到達点は試行ごとに 7〜11 都市の幅で揺れる。
  // ここは「盟主が現れる（＝勢力図が拡散したままにならない）」ことだけを保証し、
  // 具体的な到達点はバランス調整の実測（別途トライアルを回す）で見る。
  check(`6d. 50巡で盟主が現れる（実測 ${ai.top}/20 都市）`, ai.top >= 5, `最大勢力=${ai.top}都市`);

  // --- 7. セーブ v2 互換 ---
  const save = await page.evaluate(() => {
    const D = window.SANGUO_DEBUG, S = D.state;
    D.startScenario({ id: 'anti_dong_zhuo', title: '反董卓連合軍' }, 'wei', 'normal');
    D.doPolicy('agri'); D.saveGame();
    const raw = JSON.parse(localStorage.getItem('sanguo_save_v2'));
    const v = raw.v;
    delete raw.ap; delete raw.apMax; delete raw.aiGoal; raw.v = 2;
    raw.cities.forEach(c => delete c.reinforceTurn);
    localStorage.setItem('sanguo_save_v2', JSON.stringify(raw));
    const ok = D.loadGame();
    return { v, ok, ap: S.ap, apMax: S.apMax, reinforceTurn: D.cityById['xu_chang'].reinforceTurn };
  });
  check('7. v2セーブから復元でき、政務が既定値で補われる',
    save.v === 3 && save.ok && save.ap === save.apMax && save.apMax >= 3 && save.reinforceTurn === 0,
    JSON.stringify(save));

  // --- 2. 例外・404（全ステップを通したあとで判定する） ---
  check('2. 例外 / console.error / 404 が0件', errors.length === 0,
    errors.slice(0, 6).join('\n      '));

  await browser.close();
}

const { server, port } = await serve(ROOT);
let failed = false;
try {
  await run(port);
} catch (e) {
  check('検査の実行', false, (e && e.message) || String(e));
} finally {
  server.close();
}

console.log('\n三国志・天下三分 起動＆機能検査\n');
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.ok && r.detail) console.log(`      ${r.detail}`);
  if (!r.ok) failed = true;
}
console.log(`\n${results.filter(r => r.ok).length}/${results.length} PASS\n`);
process.exit(failed ? 1 : 0);
