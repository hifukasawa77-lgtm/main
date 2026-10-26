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
check('全アセットが仮描画で起動（読込失敗0）', sm.failed === 0 && sm.placeholder === sm.total && sm.total >= 30, JSON.stringify(sm));
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
