#!/usr/bin/env node
/*
 * verify-koma-ken.mjs — koma_ken.html（降魔七星剣・基盤版）の必須チェック
 *
 * 「タイトルが出た＝動いている」ではない。判定の無言のずれ（剣が敵に当たらない・弾が消えない・
 * 相性ダメージが掛からない・穴に落ちても救出されない）は例外もエラーも出さずに起きる。
 * 時刻はゲーム側の step(n) で進めるので、実時間（rAF）に依存しない。
 *
 * 使い方: node scripts/verify-koma-ken.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.join(ROOT, url === '/' ? 'koma_ken.html' : url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`); };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`); });
await page.goto(BASE + '/koma_ken.html');
await page.waitForFunction(() => window.__KOMA && window.__KOMA.assets.summary().total > 0);

// ページ内の小道具: 入力を押して n フレーム進め、離す
const run = (fn, arg) => page.evaluate(fn, arg);
const setup = () => page.evaluate(() => {
  const K = window.KOMA, G = window.__KOMA.game;
  window.H = {
    hold(codes, n) { codes.forEach(c => G.input.set(c, true)); window.__KOMA.step(n); codes.forEach(c => G.input.set(c, false)); },
    tap(code) { G.input.set(code, true); window.__KOMA.step(1); G.input.set(code, false); window.__KOMA.step(1); },
    wait(n) { window.__KOMA.step(n); },
    fresh() { G.start('training'); G.enemies = []; G.pickups = []; G.queue = []; G.stage.respawn = false; G.player.reset(100); G.shots = []; G.eshots = []; },
  };
});
await setup();

console.log('\n[1] 起動・アセット管理');
const sm = await run(() => window.__KOMA.assets.summary());
check('全アセットが読み込み失敗なしで起動（実画像なし＝コード生成のドット絵＋仮描画）', sm.failed === 0 && sm.total >= 30, JSON.stringify(sm));
const st0 = await run(() => window.__KOMA.game.state);
check('タイトルから開始できる', st0 === 'title');
await run(() => { window.H.tap('Enter'); });
check('Enterで訓練場が始まる', (await run(() => window.__KOMA.game.state)) === 'play');

console.log('\n[2] フェーズ1: 移動・ジャンプ・しゃがみ');
await run(() => window.H.fresh());
let r = await run(() => { const p = window.__KOMA.game.player, x0 = p.x; window.H.hold(['ArrowRight'], 30); const dx = p.x - x0; const d2 = p.dir; return { dx, d2 }; });
check('右へ歩ける（30フレームで約33px）', r.dx > 28 && r.dx < 38 && r.d2 === 1, `dx=${r.dx.toFixed(1)}`);
await run(() => window.H.fresh());
r = await run(() => { const p = window.__KOMA.game.player; window.H.hold(['ArrowLeft'], 20); return { dir: p.dir, x: p.x }; });
check('左へ歩くと向きが変わる', r.dir === -1 && r.x < 100);
await run(() => window.H.fresh());
r = await run(() => {
  const G = window.__KOMA.game, p = G.player; const y0 = p.y; let apex = y0, landed = false; const x0 = p.x;
  G.input.set('Space', true); window.__KOMA.step(1); G.input.set('Space', false);
  for (let i = 0; i < 90; i++) { window.__KOMA.step(1); apex = Math.min(apex, p.y); if (p.onGround) { landed = true; break; } }
  return { rise: y0 - apex, landed, dx: p.x - x0 };
});
check('真上ジャンプ: 高さ約50px・着地・横にずれない', r.rise > 40 && r.rise < 60 && r.landed && Math.abs(r.dx) < 0.5, `rise=${r.rise.toFixed(1)} dx=${r.dx.toFixed(2)}`);
await run(() => window.H.fresh());
r = await run(() => {
  const G = window.__KOMA.game, p = G.player; const x0 = p.x;
  G.input.set('ArrowRight', true); G.input.set('Space', true); window.__KOMA.step(1); G.input.set('Space', false);
  let landed = false; for (let i = 0; i < 90; i++) { window.__KOMA.step(1); if (p.onGround) { landed = true; break; } }
  G.input.set('ArrowRight', false);
  return { dx: p.x - x0, landed };
});
check('斜めジャンプ: 前へ進みながら着地', r.landed && r.dx > 30, `dx=${r.dx.toFixed(1)}`);
await run(() => window.H.fresh());
r = await run(() => { const p = window.__KOMA.game.player; window.H.hold(['ArrowDown'], 3); return { h: p.hb.h, vx: p.vx }; });
check('しゃがむと当たり判定が低くなる（28→18）', r.h === 18);

console.log('\n[3] フェーズ1: 七星剣（攻撃・弾消し）');
await run(() => window.H.fresh());
r = await run(() => {
  const G = window.__KOMA.game, p = G.player;
  const e = new window.KOMA.Enemy('plain', p.x + 24); G.enemies.push(e);
  window.H.tap('KeyZ');
  let active = 0, boxes = 0; for (let i = 0; i < 16; i++) { if (p.swordBoxes().length) active++; window.__KOMA.step(1); }
  return { hp: e.hp, active };
});
check('七星剣が敵に当たる（体力6→4＝ダメージ2）', r.hp === 4, `hp=${r.hp}`);
check('刃が出るのは14フレーム中の7フレーム（振り始めと戻りは無防備）', r.active === 7, `active=${r.active}`);
await run(() => window.H.fresh());
r = await run(() => {
  const G = window.__KOMA.game, p = G.player;
  const e = new window.KOMA.Enemy('plain', p.x + 24); G.enemies.push(e);
  G.input.set('KeyZ', true); window.__KOMA.step(1); G.input.set('KeyZ', false);
  window.__KOMA.step(20);
  return { hp: e.hp };
});
check('1回の振りで同じ敵に二重ヒットしない', r.hp === 4, `hp=${r.hp}`);
await run(() => window.H.fresh());
r = await run(() => {
  const G = window.__KOMA.game, p = G.player; const s = new window.KOMA.EShot(p.x + 16, p.y - 20, 0, 0); G.eshots.push(s);
  window.H.tap('KeyZ'); window.__KOMA.step(8);
  return { gone: G.eshots.length === 0, hp: p.hp };
});
check('敵の弾は七星剣に触れると消える（バリア）・被弾しない', r.gone && r.hp === 6);
await run(() => window.H.fresh());
r = await run(() => {
  const G = window.__KOMA.game, p = G.player; const s = new window.KOMA.EShot(p.x + 2, p.y - 20, 0, 0); G.eshots.push(s);
  window.__KOMA.step(2);
  return { hp: p.hp, shots: G.eshots.length };
});
check('剣を振らなければ敵の弾に当たる（対照）', r.hp === 5 && r.shots === 0, `hp=${r.hp}`);

console.log('\n[4] フェーズ1: サブ武器（Bボタン）');
await run(() => window.H.fresh());
r = await run(() => {
  const G = window.__KOMA.game; for (let i = 0; i < 6; i++) { window.H.tap('KeyX'); window.__KOMA.step(12); }
  return { n: G.shots.filter(s => s.sub).length };
});
check('サブ武器が飛ぶ・画面内は最大3発', r.n >= 1 && r.n <= 3, `n=${r.n}`);

console.log('\n[5] フェーズ2: 属性相性ダメージ（純粋関数）');
r = await run(() => {
  const K = window.KOMA, sel = id => K.SELECT.find(s => s.id === id), calc = (id, tags) => K.calcDamage(sel(id), { tags }).mult;
  return {
    snowFire: calc('snow', ['FIRE']), snowPlain: calc('snow', []), flameIce: calc('flame', ['ICE']), thunderArmor: calc('thunder', ['ARMOR']),
    rosaryUndead: calc('rosary', ['UNDEAD']), lightCave: calc('light', ['CAVE']), airWater: calc('air', ['WATER']),
    snowWater: calc('snow', ['WATER']), psy1: calc('psy1', []), psy2: calc('psy2', []), psy2Fire: calc('psy2', ['FIRE']),
    redPierce: sel('red').pierce, psy1Pierce: sel('psy1').pierce, whitePierce: !!sel('white').pierce,
  };
});
check('雪珠→火属性 3倍／無属性 1倍', r.snowFire === 3 && r.snowPlain === 1);
check('火炎弾→氷 3倍', r.flameIce === 3); check('雷閃→鎧 3倍', r.thunderArmor === 3);
check('念珠→死人 3倍', r.rosaryUndead === 3); check('光珠→洞窟 3倍', r.lightCave === 3); check('風弾→水 3倍', r.airWater === 3);
check('相性が違えば等倍（雪珠→水）', r.snowWater === 1);
check('念動波・壱は全敵3倍、念動波・弐は全敵5倍', r.psy1 === 3 && r.psy2 === 5 && r.psy2Fire === 5);
check('紅珠・念動波は貫通、白珠は貫通しない', r.redPierce && r.psy1Pierce && !r.whitePierce);

console.log('\n[6] フェーズ2: ゲーム内で相性が効く・貫通');
const hits = async (sel, type) => run(({ sel, type }) => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player;
  G.inv.selectIndex = window.KOMA.SELECT.findIndex(s => s.id === sel);
  const e = new window.KOMA.Enemy(type, p.x + 60); e.hp = e.maxHp = 100; G.enemies.push(e);
  window.H.tap('KeyX'); window.__KOMA.step(40);
  return 100 - e.hp;
}, { sel, type });
check('雪珠を火鬼へ: 実ダメージ3', (await hits('snow', 'ember')) === 3);
check('雪珠を雑兵へ: 実ダメージ1', (await hits('snow', 'plain')) === 1);
check('雷閃を鎧武者へ: 実ダメージ3', (await hits('thunder', 'knight')) === 3);
check('念動波・弐を雑兵へ: 実ダメージ5', (await hits('psy2', 'plain')) === 5);
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player; G.inv.selectIndex = 1; // 紅珠
  const a = new window.KOMA.Enemy('plain', p.x + 50), b = new window.KOMA.Enemy('plain', p.x + 90); a.hp = a.maxHp = b.hp = b.maxHp = 50; G.enemies.push(a, b);
  window.H.tap('KeyX'); window.__KOMA.step(60); return { a: a.hp, b: b.hp };
});
check('紅珠は貫通して2体に当たる', r.a === 49 && r.b === 49, JSON.stringify(r));
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player; G.inv.selectIndex = 0; // 白珠
  const a = new window.KOMA.Enemy('plain', p.x + 50), b = new window.KOMA.Enemy('plain', p.x + 90); a.hp = a.maxHp = b.hp = b.maxHp = 50; G.enemies.push(a, b);
  window.H.tap('KeyX'); window.__KOMA.step(60); return { a: a.hp, b: b.hp };
});
check('白珠は貫通しない（手前の1体だけ）', r.a === 49 && r.b === 50, JSON.stringify(r));

console.log('\n[7] アイテム（自動・即効・単発）');
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player; G.inv.auto.decoy = 1; p.hp = 1;
  const lives = G.lives; p.hurtBy(); return { hp: p.hp, decoy: G.inv.auto.decoy, lives: G.lives - lives };
});
check('身代わり人形: ミスで1つ消費して復活（残機は減らない）', r.hp === 6 && r.decoy === 0 && r.lives === 0, JSON.stringify(r));
r = await run(() => { window.H.fresh(); const G = window.__KOMA.game, p = G.player; p.hp = 1; const l = G.lives; p.hurtBy(); return { lives: G.lives - l }; });
check('人形なしのミスは残機-1', r.lives === -1);
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player; G.inv.auto.peacock = 1; p.reset(880); p.safeX = 880; const l = G.lives;
  G.input.set('ArrowRight', true); for (let i = 0; i < 200 && G.inv.auto.peacock > 0; i++) window.__KOMA.step(1); G.input.set('ArrowRight', false); window.__KOMA.step(60);
  return { peacock: G.inv.auto.peacock, lives: G.lives - l, x: p.x, grounded: p.onGround && !G.inPit(p.x) };
});
check('金翅鳥: 穴に落ちると1つ消費して救出（残機は減らず、穴の外へ戻る）', r.peacock === 0 && r.lives === 0 && r.grounded && r.x < 900, JSON.stringify(r));
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player; p.reset(880); p.safeX = 880; const l = G.lives;
  G.input.set('ArrowRight', true); window.__KOMA.step(120); G.input.set('ArrowRight', false); window.__KOMA.step(60);
  return { lives: G.lives - l };
});
check('穴に落ちて救出が無ければ残機-1（対照）', r.lives === -1);
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player;
  const a = (() => { const q = G.player; const x0 = q.x; window.H.hold(['ArrowRight'], 20); return q.x - x0; })();
  window.H.fresh(); G.player.fx.speed = 900; const x1 = G.player.x; window.H.hold(['ArrowRight'], 20); const b = G.player.x - x1;
  return { a, b };
});
check('韋駄天: 移動が速くなる（約1.6倍）', r.b / r.a > 1.5 && r.b / r.a < 1.7, `ratio=${(r.b / r.a).toFixed(2)}`);
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player; const e = new window.KOMA.Enemy('plain', p.x + 4); G.enemies.push(e);
  p.fx.dragon = 300; window.__KOMA.step(5); return { hp: p.hp };
});
check('蒼龍変化: 無敵（接触しても体力が減らない）', r.hp === 6);
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player; G.inv.addSingle('wind');
  for (let i = 0; i < 3; i++) G.enemies.push(new window.KOMA.Enemy('knight', p.x + 40 + i * 30));
  G.state = 'pause'; window.H.tap('KeyZ'); return { enemies: G.enemies.length, single: G.inv.single.length, state: G.state };
});
check('ポーズ画面から単発アイテム（疾風の法）を使うと画面内の敵が全滅し、1回で使い切り', r.enemies === 0 && r.single === 0 && r.state === 'play', JSON.stringify(r));
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game; G.inv.addSingle('escape'); G.state = 'pause'; window.H.tap('KeyZ');
  return { single: G.inv.single.length, state: G.state };
});
check('使えない単発アイテム（脱出の法）は消費されない', r.single === 1 && r.state === 'pause');
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player; for (let i = 0; i < 3; i++) G.enemies.push(new window.KOMA.Enemy('plain', p.x + 40 + i * 20));
  G.inv.addSingle('bind'); G.state = 'pause'; window.H.tap('KeyZ'); const e = G.enemies[0], x0 = e.x; window.__KOMA.step(30); return { moved: Math.abs(e.x - x0) };
});
check('縛呪の法: 敵が止まる', r.moved < 0.01);
r = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game;
  G.pickups = [{ cat: 'instant', id: 'speed', x: G.player.x, y: 208, taken: false }, { cat: 'auto', id: 'key', x: G.player.x, y: 208, taken: false }];
  window.__KOMA.step(2); return { speed: G.player.fx.speed > 0, key: G.inv.auto.key };
});
check('アイテムに触れると取得できる（即効・自動）', r.speed && r.key === 1);

console.log('\n[6b] 敵の再出現・弾');
r = await run(() => {
  const G = window.__KOMA.game; G.stage.respawn = true; G.start('training'); const e = G.enemies[0], n = G.enemies.length; G.damageEnemy(e, { dmg: 999 });
  window.__KOMA.step(1); const after = G.enemies.length; window.__KOMA.step(400); return { n, after, back: G.enemies.length };
});
check('訓練場: 倒した敵が一定時間後に再出現する', r.after === r.n - 1 && r.back === r.n, JSON.stringify(r));

// ===================== フェーズ4 =====================
console.log('\n[P4-1] ステージデータ（全13面）');
const sd = await run(() => {
  const K = window.KOMA, out = { ids: K.STAGE_LIST.map(s => s.id), bad: [] };
  K.STAGE_LIST.forEach(s => {
    const st = K.STAGES[s.id], lock = st.lockX;
    if (!(st.width >= 2000)) out.bad.push(s.id + ': 幅');
    if (!K.BOSS_DEFS[s.id]) out.bad.push(s.id + ': ボス定義なし');
    if (!st.gate) out.bad.push(s.id + ': 結界門なし');
    const key = st.pickups.find(p => p.id === 'key'); if (!key || key.x >= st.gate.x) out.bad.push(s.id + ': 鍵が門より手前にない');
    st.pits.forEach(p => { if (p[1] - p[0] > 36) out.bad.push(s.id + ': 穴が広すぎる'); if (p[1] > lock - 80) out.bad.push(s.id + ': 穴がボス部屋に近い'); if (p[0] < 280) out.bad.push(s.id + ': 穴がスタート地点に近い'); });
    st.platforms.forEach(p => { if (p.y !== 168 && p.y !== 136) out.bad.push(s.id + ': 足場の高さ'); });
    st.enemies.forEach(e => { st.pits.forEach(p => { if (e.x > p[0] - 50 && e.x < p[1] + 50 && !['bat', 'ghostfire', 'icicle'].includes(e.type)) out.bad.push(s.id + ': 敵が穴の近く ' + e.type + '@' + e.x); }); if (!K.ENEMY_TYPES[e.type]) out.bad.push(s.id + ': 不明な敵 ' + e.type); if (e.x >= lock - 60) out.bad.push(s.id + ': 敵がボス部屋'); });
    if (st.gate.x >= lock - 100) out.bad.push(s.id + ': 門がボス部屋に近い');
  });
  return out;
});
check('全13面の定義が揃う（R1〜R3×4＋LAST）', sd.ids.length === 13 && sd.ids[0] === 'r1s1' && sd.ids[12] === 'r4s1', sd.ids.join(','));
check('各面: ボス・結界門・鍵・穴(≤36px。ジャンプは約47px)・足場の高さ・敵の配置が妥当', sd.bad.length === 0, sd.bad.slice(0, 4).join(' | '));
check('ステージの連結: r1s1→r1s2→…→r4s1→終わり', await run(() => { const L = window.KOMA.STAGE_LIST; return L[0].next === 'r1s2' && L[11].next === 'r4s1' && L[12].next === null; }));

console.log('\n[P4-2] 全13面を走破（無敵のボットが穴・敵を越えてボス部屋へ着く）');
for (const id of ['r1s1', 'r1s2', 'r1s3', 'r1s4', 'r2s1', 'r2s2', 'r2s3', 'r2s4', 'r3s1', 'r3s2', 'r3s3', 'r3s4', 'r4s1']) {
  const rr = await run((id) => {
    const G = window.__KOMA.game, p = G.player; G.newGame(id); const K = window.KOMA;
    let f = 0, lost = 0, prevLives = G.lives;
    for (; f < 12000 && !G.boss; f++) {
      p.hp = 6; p.inv = Math.max(p.inv, 3);
      const nextPit = (G.stage.pits || []).find(q => q[1] > p.x && q[0] - p.x < 8 && q[0] - p.x > -2);
      const foe = G.enemies.find(e => !e.dead && e.x > p.x && e.x - p.x < 36 && Math.abs(e.y - p.y) < 40 && e.def.ai !== 'drop');
      const nearPit = (G.stage.pits || []).some(q => q[1] > p.x && q[0] - p.x < 70);   // 穴の手前では敵より穴を優先する
      const near = foe && foe.x - p.x < 26 && !nearPit;   // 剣の届く距離まで近づいてから振る（攻撃中は動けないので、遠くから振り続けると詰む）
      G.input.set('ArrowRight', true);
      G.input.set('Space', !!((nextPit || (foe && !near && !nearPit)) && p.onGround));
      G.input.set('KeyZ', !!near && (f & 3) === 0);
      window.__KOMA.step(1);
      if (G.lives < prevLives) lost += prevLives - G.lives; prevLives = G.lives;   // 1UPで増えるのは構わない。減ったら（落下・被弾）数える
    }
    G.input.set('ArrowRight', false); G.input.set('Space', false); G.input.set('KeyZ', false);
    return { x: p.x, lock: G.lockX, boss: !!G.boss, lost, f };
  }, id);
  check(`${id}: ボス部屋まで走破（落下・ミス0）`, rr.boss && rr.lost === 0 && rr.x >= rr.lock, `x=${rr.x | 0}/${rr.lock} frames=${rr.f}`);
}

console.log('\n[P4-3] ボス13体: AIが生きている（900フレーム・例外なし・動く/撃つ）');
for (const id of ['r1s1', 'r1s2', 'r1s3', 'r1s4', 'r2s1', 'r2s2', 'r2s3', 'r2s4', 'r3s1', 'r3s2', 'r3s3', 'r3s4', 'r4s1']) {
  const rr = await run((id) => {
    const G = window.__KOMA.game, p = G.player; G.newGame(id); p.reset(G.lockX + 20); G.minX = G.lockX + 10;
    window.__KOMA.step(2);
    const b = G.boss; if (!b) return { ok: false, why: 'no boss' };
    const x0 = b.x, y0 = b.y; let shots = 0, moved = 0, hurt = 0;
    for (let i = 0; i < 900; i++) { p.hp = 6; p.inv = 3; window.__KOMA.step(1); shots = Math.max(shots, G.eshots.length); moved = Math.max(moved, Math.abs(b.x - x0) + Math.abs(b.y - y0)); }
    return { ok: true, alive: !b.dead && G.boss === b, shots, moved, name: b.name, cam: G.camX === G.lockX };
  }, id);
  check(`${id}: ${rr.name || '?'} が出現し、動く/撃つ（画面固定）`, rr.ok && rr.alive && (rr.shots > 0 || rr.moved > 10) && rr.cam, JSON.stringify(rr));
}

console.log('\n[P4-4] ボスごとの弱点の癖');
const bossSetup = (id, fn) => run(({ id, fn }) => {
  const G = window.__KOMA.game, p = G.player; G.newGame(id); p.reset(G.lockX + 20); G.minX = G.lockX + 10; window.__KOMA.step(2);
  return (new Function('G', 'p', 'K', fn))(G, p, window.KOMA);
}, { id, fn });
let rb = await bossSetup('r1s1', `const b = G.boss; b.dir = -1; p.x = b.x - 40; const h0 = b.hp; G.damageEnemy(b, {dmg:2}, b.x - 10, b.y - 20); const front = h0 - b.hp; p.x = b.x + 40; G.damageEnemy(b, {dmg:2}, b.x + 10, b.y - 20); return { front, back: h0 - b.hp - front };`);
check('鬼面の女: 正面からは効かず、背中なら効く', rb.front === 0 && rb.back === 2, JSON.stringify(rb));
rb = await bossSetup('r1s1', `const b = G.boss; b.st='walk'; p.x = b.x - 60; b.noTurn = 0; b.sc = 151; b.cool = 0; let behind = false; for (let i=0;i<200;i++){ p.hp=6; p.inv=3; window.__KOMA.step(1); if ((p.x - b.x) * b.dir < 0 && b.st === 'walk') { behind = true; break; } } return { behind, st: b.st };`);
check('鬼面の女: 高く跳んで背後へ回り込み、着地後しばらく向き直らない', rb.behind, JSON.stringify(rb));
rb = await bossSetup('r1s2', `const b = G.boss; const h0 = b.hp; b.st = 'spin'; G.damageEnemy(b, {dmg:2}, b.x, b.y - 20); const spin = h0 - b.hp; b.st = 'tired'; G.damageEnemy(b, {dmg:2}, b.x, b.y - 20); return { spin, tired: h0 - b.hp - spin };`);
check('岩坊主: 回転中は無敵、止まれば効く', rb.spin === 0 && rb.tired === 2, JSON.stringify(rb));
rb = await bossSetup('r1s3', `const b = G.boss; const h0 = b.hp; G.damageEnemy(b, {dmg:2}, b.x, b.y - 10); const body = h0 - b.hp; G.damageEnemy(b, {dmg:2}, b.x, b.y - b.h + 10); return { body, head: h0 - b.hp - body };`);
check('門番の金剛: 胴体は効かず、頭だけ効く', rb.body === 0 && rb.head === 2, JSON.stringify(rb));
rb = await bossSetup('r1s4', `const b = G.boss, d = G.enemies.filter(e => e.decoy); const dh = d.length; d.forEach(x => G.damageEnemy(x, {dmg:50}, x.x, x.y - 10)); const alive = G.enemies.filter(e => e.decoy).length; b.st = 'show'; const h0 = b.hp; G.damageEnemy(b, {dmg:2}, b.x, b.y - 10); let touch = false; p.x = d[0].x; window.__KOMA.step(2); touch = p.hp < 6; return { decoys: dh, alive, real: h0 - b.hp, touch };`);
check('闇の導師: 分身は2体いて何を当てても効かず、触れても害がない。本物だけ効く', rb.decoys === 2 && rb.alive === 2 && rb.real === 2 && !rb.touch, JSON.stringify(rb));
rb = await bossSetup('r3s4', `const b = G.boss; b.ring = true; const h0 = b.hp; G.damageEnemy(b, {dmg:2}, b.x, b.y - 10); const barrier = h0 - b.hp; b.ring = false; G.damageEnemy(b, {dmg:2}, b.x, b.y - 10); return { barrier, open: h0 - b.hp - barrier };`);
check('邪鬼の長: 結界の間は無敵、解ければ効く', rb.barrier === 0 && rb.open === 2, JSON.stringify(rb));
rb = await bossSetup('r2s1', `const b = G.boss, snow = K.SELECT.find(s => s.id === 'snow'), white = K.SELECT[0]; const h0 = b.hp; G.damageEnemy(b, snow, b.x, b.y - 10); const a = h0 - b.hp; G.damageEnemy(b, white, b.x, b.y - 10); return { a, b: h0 - b.hp - a };`);
check('炎の邪神: 火属性＝雪珠で3倍（白珠は1倍）', rb.a === 3 && rb.b === 1, JSON.stringify(rb));
rb = await bossSetup('r3s3', `const b = G.boss, th = K.SELECT.find(s => s.id === 'thunder'); const h0 = b.hp; G.damageEnemy(b, th, b.x, b.y - 10); return { a: h0 - b.hp };`);
check('鎧の大将: 鎧属性＝雷閃で3倍', rb.a === 3, JSON.stringify(rb));
rb = await bossSetup('r2s3', `const b = G.boss; b.sc = 89; window.__KOMA.step(1); const beam = G.eshots.find(s => s.solid && s.w >= 200); const warned = true; return { beam: !!beam, h: beam ? beam.h : 0 };`);
check('雪の精: 長い光線(solid)を放つ（剣で消せない）', rb.beam, JSON.stringify(rb));
rb = await bossSetup('r1s1', `const b = G.boss; const s = new K.EShot(p.x + 2, p.y - 20, 0, 0, { solid: true, life: 30, w: 20, h: 16 }); G.eshots.push(s); G.input.set('KeyZ', true); window.__KOMA.step(1); G.input.set('KeyZ', false); window.__KOMA.step(6); return { still: G.eshots.includes(s) || s.dead && p.hp < 6, hp: p.hp };`);
check('solid の斬撃は七星剣で消せず、当たる', rb.hp < 6, JSON.stringify(rb));

console.log('\n[P4-5] ボス撃破→成長→次の面→エンディング');
rb = await run(() => {
  const G = window.__KOMA.game, p = G.player; G.newGame('r1s1'); G.score = 1234; G.lives = 2; G.inv.addSingle('wind'); G.inv.auto.decoy = 1;
  p.reset(G.lockX + 20); G.minX = G.lockX + 10; window.__KOMA.step(2); const sel0 = G.inv.selectIndex, b = G.boss;
  G.damageEnemy(b, { dmg: 999 }, b.x - 10, b.y - 10);
  b.guard = () => true; G.damageEnemy(b, { dmg: 999 }, b.x - 10, b.y - 10);
  const afterKill = { state: G.state, sel: G.inv.selectIndex - sel0, boss: G.boss };
  window.__KOMA.step(270);
  return { afterKill: { state: afterKill.state, sel: afterKill.sel, boss: !!afterKill.boss }, id: G.stage.id, score: G.score, lives: G.lives, single: G.inv.single.length, decoy: G.inv.auto.decoy, hp: p.hp, state: G.state, x: p.x };
});
check('ボスを倒すとクリア表示・セレクトアイテムが1つ成長', rb.afterKill.state === 'clear' && rb.afterKill.sel === 1 && !rb.afterKill.boss, JSON.stringify(rb.afterKill));
check('約4秒後に次の面（r1s2）へ。得点・残機・持ち物を引き継ぎ、体力は全回復', rb.id === 'r1s2' && rb.score >= 1234 + 3000 && rb.lives === 2 && rb.single === 1 && rb.decoy === 1 && rb.hp === 6 && rb.state === 'play' && rb.x < 50, JSON.stringify(rb));
rb = await run(() => {
  const G = window.__KOMA.game, p = G.player; G.newGame('r4s1'); p.reset(G.lockX + 20); G.minX = G.lockX + 10; window.__KOMA.step(2);
  const b = G.boss; b.guard = () => true; G.damageEnemy(b, { dmg: 999 }, b.x, b.y - 10); window.__KOMA.step(270); const st = G.state;
  window.__KOMA.step(130); G.input.set('KeyZ', true); window.__KOMA.step(1); G.input.set('KeyZ', false); return { st, after: G.state };
});
check('最終ボスを倒すとエンディング→Zでタイトルへ戻る', rb.st === 'ending' && rb.after === 'title', JSON.stringify(rb));
rb = await run(() => {
  const G = window.__KOMA.game, p = G.player; G.newGame('r4s1'); p.reset(G.lockX + 20); G.minX = G.lockX + 10; window.__KOMA.step(2); const b = G.boss;
  const phase = []; p.hp = 6; p.inv = 999; b.hp = b.maxHp * 0.4; for (let i = 0; i < 700; i++) { p.hp = 6; p.inv = 3; window.__KOMA.step(1); } const ghoul = G.enemies.some(e => e.type === 'ghoul'); const top = G.eshots.some(s => s.solid && s.y < 120);
  return { ghoul, anyShots: G.eshots.length > 0 };
});
check('黒翁(最終ボス)は体力が半分を切ると第2形態（亡者を呼ぶ）', rb.ghoul, JSON.stringify(rb));

console.log('\n[P4-6] ボス部屋: 画面固定・戻れない／ミスで復帰');
rb = await run(() => {
  const G = window.__KOMA.game, p = G.player; G.newGame('r1s1'); p.reset(G.lockX + 20); window.__KOMA.step(2);
  G.input.set('ArrowLeft', true); window.__KOMA.step(200); G.input.set('ArrowLeft', false);
  const minPos = p.x; p.hp = 1; const lives = G.lives; p.hurtBy(); window.__KOMA.step(2);
  return { minPos, lock: G.lockX, lives: G.lives - lives, x: p.x, bossStill: !!G.boss };
});
check('ボス戦中は左へ戻れない（画面固定）', rb.minPos >= rb.lock + 9, `x=${rb.minPos.toFixed(1)} lock=${rb.lock}`);
check('ボス戦でミスしても、ボス部屋の入口から再開（ボスは残る）', rb.lives === -1 && rb.x >= rb.lock + 20 && rb.bossStill, JSON.stringify(rb));

console.log('\n[P4-7] 結界門（鍵・天界・冥界・隠し報酬）');
const gateRun = (code) => run((code) => { const G = window.__KOMA.game, p = G.player; G.newGame('r1s1'); p.reset(G.stage.gate.x - 4); G.pickups = []; window.__KOMA.step(2); return (new Function('G', 'p', 'K', code))(G, p, window.KOMA); }, code);
rb = await gateRun(`G.inv.auto.key = 0; G.input.set('ArrowUp', true); window.__KOMA.step(1); G.input.set('ArrowUp', false); window.__KOMA.step(2); return { room: G.room, vy: p.vy };`);
check('鍵が無いと結界門に入れない（ジャンプもしない）', rb.room === null, JSON.stringify(rb));
rb = await gateRun(`G.inv.auto.key = 1; G.input.set('ArrowUp', true); window.__KOMA.step(1); G.input.set('ArrowUp', false); window.__KOMA.step(2); return { room: G.room, key: G.inv.auto.key, id: G.stage.id, y: p.y };`);
check('鍵があると入れる（鍵を1つ消費・上キーでジャンプしない）', rb.room === 'hub' && rb.key === 0 && rb.id === 'gate_hub' && rb.y === 208, JSON.stringify(rb));
rb = await gateRun(`G.inv.auto.key = 1; const x0 = G.stage.gate.x; const tap = c => { G.input.set(c, true); window.__KOMA.step(1); G.input.set(c, false); window.__KOMA.step(2); };
  tap('ArrowUp'); p.x = G.stage.doors.find(d => d.to === 'heaven').x; tap('ArrowUp'); const inHeaven = G.room === 'heaven' && !G.stage.dark;
  p.hp = 2; p.x = G.pickups.find(q => q.cat === 'heal').x; window.__KOMA.step(3); const healed = p.hp === 6; const singles0 = G.inv.single.length;
  G.pickups.filter(q => q.cat === 'single').forEach(q => { p.x = q.x; window.__KOMA.step(3); }); const gotSingles = G.inv.single.length - singles0;
  p.x = G.stage.doors.find(d => d.to === 'outside').x; tap('ArrowUp');
  return { inHeaven, healed, gotSingles, back: G.room === null && G.stage.id === 'r1s1', used: G.stage.gate.used, px: Math.abs(p.x - x0) < 2 };`);
check('天界: 体力が全回復し単発アイテムが2個手に入る。出口で外へ戻る（門は使用済み）', rb.inHeaven && rb.healed && rb.gotSingles === 2 && rb.back && rb.used && rb.px, JSON.stringify(rb));
rb = await gateRun(`G.inv.auto.key = 1; const tap = c => { G.input.set(c, true); window.__KOMA.step(1); G.input.set(c, false); window.__KOMA.step(2); };
  tap('ArrowUp'); p.x = G.stage.doors.find(d => d.to === 'hell').x; tap('ArrowUp');
  const hell = { room: G.room, dark: !!G.stage.dark, enemies: G.enemies.length, width: G.stage.width, reward: G.pickups.filter(q => q.cat === 'instant').length, single: G.pickups.filter(q => q.cat === 'single').length };
  G.inv.addSingle('escape'); G.state = 'pause'; G.input.set('KeyZ', true); window.__KOMA.step(1); G.input.set('KeyZ', false); window.__KOMA.step(1);
  return { hell, escaped: G.room === null && G.stage.id === 'r1s1', usedUp: G.inv.single.indexOf('escape') < 0 };`);
check('冥界: 暗闇・敵4体・隠し報酬（1UPか金仏）と単発アイテム', rb.hell.room === 'hell' && rb.hell.dark && rb.hell.enemies === 4 && rb.hell.width === 512 && rb.hell.reward === 1 && rb.hell.single === 1, JSON.stringify(rb.hell));
check('冥界で「脱出の法」を使うと外へ脱出（使い切り）', rb.escaped && rb.usedUp, JSON.stringify(rb));
rb = await gateRun(`G.inv.auto.key = 1; G.inv.auto.torch = 0; const tap = c => { G.input.set(c, true); window.__KOMA.step(1); G.input.set(c, false); window.__KOMA.step(2); };
  tap('ArrowUp'); p.x = G.stage.doors.find(d => d.to === 'hell').x; tap('ArrowUp'); G.state = 'play';
  const cv = document.getElementById('screen'), cx = cv.getContext('2d'); window.__KOMA.step(1); G.draw(); const a = cx.getImageData(240, 120, 1, 1).data; const dark = a[0] + a[1] + a[2] < 30;
  G.inv.auto.torch = 1; G.draw(); const ring = (() => { let n = 0; const d = cx.getImageData(0, 0, 256, 240).data; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] > 30) n++; return n; })();
  G.inv.auto.torch = 0; G.draw(); const ring0 = (() => { let n = 0; const d = cx.getImageData(0, 0, 256, 240).data; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] > 30) n++; return n; })();
  return { dark, ring, ring0 };`);
check('冥界は暗く、松明があると照らす範囲が広がる', rb.dark && rb.ring > rb.ring0, JSON.stringify(rb));
rb = await gateRun(`G.inv.auto.key = 1; const tap = c => { G.input.set(c, true); window.__KOMA.step(1); G.input.set(c, false); window.__KOMA.step(2); };
  tap('ArrowUp'); p.x = G.stage.doors.find(d => d.to === 'hell').x; tap('ArrowUp'); G.inv.auto.decoy = 0; const lives = G.lives; p.hp = 1; p.inv = 0; p.hurtBy(); window.__KOMA.step(2);
  return { lives: G.lives - lives, room: G.room, id: G.stage.id };`);
check('冥界でミスすると外へ戻って再開（残機-1）', rb.lives === -1 && rb.room === null && rb.id === 'r1s1', JSON.stringify(rb));

console.log('\n[P4-8] 新しい雑魚の動き・タイトル');
rb = await run(() => {
  window.H.fresh(); const G = window.__KOMA.game, p = G.player; p.reset(300);
  const h = new window.KOMA.Enemy('hopper', 500), ic = new window.KOMA.Enemy('icicle', 100, 60), sk = new window.KOMA.Enemy('skeleton', 700); G.enemies.push(h, ic, sk);
  let hy = 0; for (let i = 0; i < 200; i++) { p.hp = 6; p.inv = 3; window.__KOMA.step(1); hy = Math.max(hy, 208 - h.y); }
  const x0 = sk.x; window.__KOMA.step(60); const walked = Math.abs(sk.x - x0) > 5;
  p.x = 100; window.__KOMA.step(60); const fell = ic.dead || ic.y >= 200;
  return { hy, walked, fell };
});
check('跳ね鬼は跳ぶ・骸骨は歩く・氷柱は真下に来ると落ちる', rb.hy > 15 && rb.walked && rb.fell, JSON.stringify(rb));
rb = await run(() => {
  const G = window.__KOMA.game; G.state = 'title'; G.menuIdx = 0; window.H.tap('Enter'); const a = G.stage.id;
  G.state = 'title'; G.menuIdx = 0; window.H.tap('ArrowDown'); const m = G.menuIdx; window.H.tap('Enter'); return { a, m, b: G.stage.id };
});
check('タイトル: 「冒険を始める」でR1-1、「訓練場」で訓練場', rb.a === 'r1s1' && rb.m === 1 && rb.b === 'training', JSON.stringify(rb));

const errsBefore = errors.length;
console.log('\n[8] フェーズ3: アセットマネージャー');
r = await run(async () => {
  const A = window.__KOMA.assets;
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#00ff00'; x.fillRect(0, 0, 16, 16);
  const ok = await A.setSource('item', c.toDataURL());
  const has = A.has('item');
  const out = document.createElement('canvas'); out.width = 32; out.height = 32; const g = out.getContext('2d');
  A.drawSprite(g, 'item', 16, 24, { cat: 'auto' }); const px = g.getImageData(16, 14, 1, 1).data;
  const bad = await A.setSource('player', 'does_not_exist.webp');
  let threw = false; try { A.drawSprite(g, 'player', 16, 30, { anim: 'idle', state: { crouch: false, atk: 0 } }); } catch (e) { threw = true; }
  return { ok, has, green: px[1] === 255 && px[0] === 0, bad, status: A.status.player, threw };
});
check('設定の画像を差し替えると、仮描画ではなく画像で描かれる', r.ok && r.has && r.green, JSON.stringify(r));
check('読めない画像は例外を出さず仮描画へ戻り、失敗の理由が残る', r.bad === false && /^failed:/.test(r.status) && !r.threw, r.status);
r = await run(async () => { try { await window.__KOMA.assets.setSource('nope', 'x.webp'); return 'no-error'; } catch (e) { return /unknown asset key/.test(e.message) ? 'clear-error' : 'other'; } });
check('存在しないキーの指定は分かる形で失敗する', r === 'clear-error', r);
// ここまでの失敗読込（does_not_exist.webp の404）は、上の検査が意図して起こしたもの
const expected = errors.splice(errsBefore);
check('意図した失敗は 404 の1件だけ（他の例外が混ざらない）', expected.every(x => /does_not_exist|404/.test(x)), expected.join(' | '));

console.log('\n[9] 描画・例外');
await run(() => { window.H.fresh(); window.__KOMA.game.debug = true; window.__KOMA.step(5); });
const inkd = await run(() => { const c = document.getElementById('screen'); const d = c.getContext('2d').getImageData(0, 0, 256, 240).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n; });
check('画面が実際に描かれている', inkd > 1500, `px=${inkd}`);
check('ページ例外・404・コンソールエラーが0件', errors.length === 0, errors.join(' | '));

await browser.close(); server.close();
console.log(`\n${fail ? '❌' : '✅'} ${pass} 件合格 / ${fail} 件不合格`);
process.exit(fail ? 1 : 0);
