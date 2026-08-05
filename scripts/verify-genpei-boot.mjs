#!/usr/bin/env node
/*
 * verify-genpei-boot.mjs — genpei.html が「起動して遊べるか」を機械検査する
 *
 * 要件 M-50 / 受入基準 5.1。
 *
 * ★ タイトル画面が出た＝起動成功ではない。描画ループの例外は「背景だけ残って
 *   UIが出ない」形で現れ、タイトルは無事に出る。必ずマップ画面まで入って確かめる。
 * ★ GameKit は update/draw の例外を捕捉して継続し engine.errors に積む。
 *   そのため pageerror だけ見る検査は素通りする。必ず両方を合算すること。
 * ★ ブラウザは favicon.ico を勝手に取りに行く。404 を返すと console.error が出て
 *   検査が常に落ちるので 204 を返して黙らせる（本物のアセット404は response で拾う）。
 *
 * 使い方:
 *   node scripts/verify-genpei-boot.mjs           # http 経由（本番相当）
 *   node scripts/verify-genpei-boot.mjs --file    # file:// 経由（埋め込みシード経路）
 * 終了コード: 全PASS=0 / FAILあり=1
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USE_FILE = process.argv.includes('--file');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const RULE_DEFECT = 20;   // genpei.html の RULE.hoko.defectBelow と同値
const fails = [];
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  if (!ok) fails.push(`${name}${detail ? ' — ' + detail : ''}`);
}

/* ---- テストサーバ ---- */
async function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }   // ★204で黙らせる
    const file = path.join(ROOT, url === '/' ? 'genpei.html' : url.replace(/^\//, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  return { server, port: server.address().port };
}

const ctxServer = USE_FILE ? null : await serve();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });

const pageErrors = [], consoleErrors = [], notFound = [];
page.on('pageerror', (e) => pageErrors.push(String(e && (e.stack || e.message) || e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });

const target = USE_FILE
  ? pathToFileURL(path.join(ROOT, 'genpei.html')).href
  : `http://127.0.0.1:${ctxServer.port}/genpei.html`;
await page.goto(target, { waitUntil: 'load' });

/* 1. ブリッジが張られているか */
await page.waitForFunction(() => !!window.GENPEI_DEBUG, null, { timeout: 15000 }).catch(() => {});
check('1. GENPEI_DEBUG ブリッジが露出している', await page.evaluate(() => !!window.GENPEI_DEBUG));

/* 2. データが読めているか */
await page.waitForFunction(() => window.GENPEI_DEBUG && window.GENPEI_DEBUG.DATA.kyoten, null, { timeout: 20000 }).catch(() => {});
const data = await page.evaluate(() => {
  const D = window.GENPEI_DEBUG.DATA;
  return { source: D.source, kyoten: D.kyoten ? D.kyoten.length : 0, provinces: D.provinces ? D.provinces.length : 0 };
});
check('2. 拠点データを読み込めた', data.kyoten >= 200, `${data.kyoten}件 (${data.source})`);
check('3. 令制国データを読み込めた', data.provinces === 66, `${data.provinces}国`);
if (USE_FILE) check('3b. file:// では埋め込みシードへ落ちる', data.source === 'embed', `source=${data.source}`);

/* 4. タイトル画面まで到達 */
await page.waitForFunction(() => window.GENPEI_DEBUG.scene() === 'TitleScene', null, { timeout: 20000 }).catch(() => {});
check('4. タイトル画面へ到達', await page.evaluate(() => window.GENPEI_DEBUG.scene()) === 'TitleScene');

/* 5. ★マップ画面まで入る（タイトルが出た＝起動成功ではない） */
const entered = await page.evaluate(() => window.GENPEI_DEBUG.gotoMap('s1180', 'kamakura'));
await page.waitForTimeout(700);
check('5. マップ画面へ入れた', entered && (await page.evaluate(() => window.GENPEI_DEBUG.scene())) === 'MapScene');

/* 6. 描画が回っているか（数フレーム進めて例外が出ないこと） */
await page.waitForTimeout(900);

/* 7. ターン終了が通る（12ヶ月ぶん） */
const afterYear = await page.evaluate(() => {
  const D = window.GENPEI_DEBUG;
  const st = D.state();
  for (let i = 0; i < 12; i++) D.endTurn(st);
  return { year: st.year, month: st.month, turn: st.turn, log: st.log.length };
});
check('6. ターン終了を12回進められた', afterYear.turn === 13, JSON.stringify(afterYear));

/* 8. 長期進行（シナリオ最終ターンまで） */
const longRun = await page.evaluate(() => {
  const D = window.GENPEI_DEBUG;
  const out = {};
  for (const fid of ['kamakura', 'taira', 'kiso', 'oshu']) {
    const st = D.buildState('s1180', fid);
    let n = 0;
    // ★プレイヤー側も AI と同じ方針で手を打つ。無操作で放置した結果を
    //   「バランス」と呼ぶと、弱小勢力が必ず落第することになる。
    while (!st.result && n < 200) {
      D.applyActions(st, fid, D.Rule.aiActions(st, fid));
      D.endTurn(st); n++;
    }
    out[fid] = { turns: n, sites: D.Rule.ownedKyoten(st, fid).length, win: st.result && st.result.win };
  }
  return out;
});
// ★「1ターンで全滅」を PASS にしない。弱小勢力でも最低2年は戦えること。
const tooShort = Object.entries(longRun).filter(([, v]) => v.turns < 24);
check('7. 最終ターンまで停止せず進行した', Object.values(longRun).every((v) => v.turns < 200), JSON.stringify(longRun));
check('7b. どの勢力も24ターン未満で消えない', tooShort.length === 0, tooShort.map(([k, v]) => `${k}:${v.turns}`).join(', '));

/* 9. 全シナリオ×全プレイ可能勢力で state を作れる */
const allStates = await page.evaluate(() => {
  const D = window.GENPEI_DEBUG;
  const out = [];
  for (const s of D.SCENARIOS) {
    for (const fid of s.playable) {
      try {
        const st = D.buildState(s.id, fid);
        const owned = D.Rule.ownedKyoten(st, fid).length;
        out.push({ s: s.id, f: fid, owned });
      } catch (e) { out.push({ s: s.id, f: fid, error: String(e.message || e) }); }
    }
  }
  return out;
});
const broken = allStates.filter((r) => r.error || r.owned === 0);
check('8. 全シナリオ×勢力で開始できる（拠点0で始まらない）', broken.length === 0,
  broken.map((b) => `${b.s}/${b.f}:${b.error || '拠点0'}`).join(', '));

/* 10. 飢饉が実際に軍事行動を止める（要件 M-39 の骨組み） */
const famine = await page.evaluate(() => {
  const D = window.GENPEI_DEBUG;
  const st = D.buildState('s1180', 'kamakura');
  st.year = 1181; st.month = 8;                       // 飢饉のまっただ中
  const acts = D.Rule.aiActions(st, 'taira').length;
  st.year = 1183; st.month = 8;                       // 飢饉明け
  const acts2 = D.Rule.aiActions(st, 'taira').length;
  return { during: acts, after: acts2 };
});
check('9. 飢饉中は AI が出兵しない', famine.during === 0, JSON.stringify(famine));

/* --- Phase 2: 受入基準 5.3「遊びの成立」を測る --- */
const phase2 = await page.evaluate(() => {
  const D = window.GENPEI_DEBUG, R = D.Rule;
  const out = {};

  // (a) 武士団が起きているか
  const st0 = D.buildState('s1180', 'kamakura');
  out.bands = Object.keys(st0.bands).length;
  out.bandsMine = R.bandsOf(st0, 'kamakura').length;
  out.bandsNeutral = Object.values(st0.bands).filter((b) => !b.faction).length;

  // (b) ★名分だけで国府が開くか（本作の最重要ルール）
  let opened = 0, tried = 0;
  for (let t = 0; t < 40 && opened === 0; t++) {
    for (const k of D.DATA.kyoten) {
      if (k.type !== 'kokufu') continue;
      const c = R.canOpenBloodless(st0, 'kamakura', k.id);
      if (!c.ok) continue;
      tried++;
      if (D.tryBloodlessOpen(st0, 'kamakura', k.id).opened) { opened++; break; }
    }
    D.endTurn(st0);
  }
  out.bloodless = { tried, opened };

  // (c) ★恩賞が尽きると離反するか（安堵も新恩も与えずに放置する）
  const st1 = D.buildState('s1180', 'kamakura');
  const before = R.bandsOf(st1, 'kamakura').length;
  let minHoko = 100;
  for (let t = 0; t < 48; t++) {
    D.endTurn(st1);
    for (const b of R.bandsOf(st1, 'kamakura')) minHoko = Math.min(minHoko, b.hoko);
  }
  out.neglect = { before, after: R.bandsOf(st1, 'kamakura').length, minHoko: Math.round(minHoko),
                  debt: Math.round(R.totalDebt(st1, 'kamakura')) };

  // (d) ★朝敵になると崩れるか（同条件で朝敵ありとなしを比べる）
  const run = (choteki) => {
    const st = D.buildState('s1180', 'kamakura');
    if (choteki) { st.factions.kamakura.choteki = true; st.factions.kamakura.chotekiUntil = 999; }
    for (let t = 0; t < 24; t++) D.endTurn(st);
    const bs = R.bandsOf(st, 'kamakura');
    return { bands: bs.length, hoko: Math.round(bs.reduce((s2, b) => s2 + b.hoko, 0) / Math.max(1, bs.length)),
             meibun: R.calcMeibun(st, 'kamakura') };
  };
  out.choteki = { normal: run(false), outlawed: run(true) };

  // (e) 勧誘が成立するか。
  //     ★贈与は断られても戻らないので、軍資金が尽きると以降は「金が足りない」で
  //       全滅する。検査で見たいのは判定式なので、金は潤沢にして見込みの高い順に試す。
  const st2 = D.buildState('s1180', 'kamakura');
  st2.factions.kamakura.gold = 20000;
  let joined = 0, tried2 = 0;
  const cands = Object.values(st2.bands).filter((b) => !b.faction)
    .map((b) => ({ b, c: R.recruitChance(st2, 'kamakura', b.id, 200) }))
    .filter((x) => x.c.ok).sort((a, b) => b.c.score - a.c.score);
  for (const x of cands) {
    tried2++;
    if (D.tryRecruit(st2, 'kamakura', x.b.id, 200).joined) joined++;
  }
  out.recruit = { tried: tried2, joined, best: cands.length ? cands[0].c.score : null };
  return out;
});
check('14. 武士団が起きている', phase2.bands >= 60 && phase2.bandsNeutral > 0, JSON.stringify({ 総数: phase2.bands, 自勢力: phase2.bandsMine, 中立: phase2.bandsNeutral }));
check('15. ★名分だけで国府が開く（無血開城）', phase2.bloodless.opened > 0, JSON.stringify(phase2.bloodless));
check('16. ★恩賞を配らないと奉公度が崩れる', phase2.neglect.minHoko < RULE_DEFECT, JSON.stringify(phase2.neglect));
// 名分は 0 で下げ止まるので「差が300以上」では測れない。落ち幅と結果の両方を見る
check('17. ★朝敵になると名分が急落し武士団が減る',
  phase2.choteki.outlawed.meibun <= Math.max(0, phase2.choteki.normal.meibun - 300)
  && phase2.choteki.outlawed.bands < phase2.choteki.normal.bands,
  JSON.stringify(phase2.choteki));
check('18. 勧誘が成立する', phase2.recruit.joined > 0, JSON.stringify(phase2.recruit));

/* --- Phase 3: ヘックス合戦（要件 M-27〜M-32） --- */
const phase3 = await page.evaluate(() => {
  const D = window.GENPEI_DEBUG, B = D.Battle;
  const st = D.buildState('s1180', 'kamakura');
  const out = {};

  // (a) 盤面が組めるか（野戦と攻城の両方）
  const field = D.initBattle(st, { fid: 'kamakura', from: 'tachi_kamakura', to: 'kokufu_suruga', troops: 3000 });
  const siege = D.initBattle(st, { fid: 'kamakura', from: 'tachi_kamakura', to: 'kisaku_odawara', troops: 3000 });
  out.modes = { field: field.mode, siege: siege.mode };
  out.units = { field: field.units.length, siege: siege.units.length };
  out.walls = siege.terrain.flat().filter((t) => t === 'saku' || t === 'sakamogi').length;

  // (b) ★騎射の間合い — 距離1の威力が距離2の半分以下に落ちること
  const b = field;
  const k = b.units.find((u) => u.type === 'kisha' && u.side === 'atk');
  const t = b.units.find((u) => u.side === 'def');
  const at = (d) => { k.hx = 0; k.hy = 4; t.hx = d; t.hy = 4; return B.damage(b, k, t); };
  const d1 = [], d2 = [];
  for (let i = 0; i < 40; i++) { d1.push(at(1)); d2.push(at(2)); }
  const avg = (a) => a.reduce((s2, v) => s2 + v, 0) / a.length;
  out.kisha = { melee: Math.round(avg(d1)), ranged: Math.round(avg(d2)) };

  // (c) ★士気で決着すること（全滅を待たずに終わる）
  const runs = [];
  for (let s2 = 0; s2 < 5; s2++) {
    const bb = D.initBattle(st, { fid: 'kamakura', from: 'tachi_kamakura', to: 'kokufu_suruga', troops: 3000 + s2 * 300 });
    let rounds = 0;
    while (!B.over(bb).done && rounds < 40) {
      B.aiTurn(bb, 'atk'); B.aiTurn(bb, 'def'); B.tickMorale(bb);
      for (const u of bb.units) u.acted = false;
      bb.round++; rounds++;
    }
    const o = B.over(bb);
    runs.push({ rounds, winner: o.winner, why: o.why,
                left: bb.units.filter((u) => u.troops > 0).length });
  }
  out.runs = runs;

  // (d) ★名乗りと一騎討ちが成立すること
  const b2 = D.initBattle(st, { fid: 'kamakura', from: 'tachi_kamakura', to: 'kokufu_suruga', troops: 3000 });
  const a = b2.units.find((u) => u.side === 'atk' && u.gen);
  const dfd = b2.units.find((u) => u.side === 'def' && u.gen);
  a.hx = 4; a.hy = 4; dfd.hx = 5; dfd.hy = 4;
  const can = B.canDuel(b2, a, dfd);
  const res = can.ok ? B.resolveDuel(b2, a, dfd) : null;
  out.duel = { can: can.ok, why: can.why, accepted: res && res.accepted, gens: [a.gen, dfd.gen] };
  return out;
});
check('19. 合戦の盤面が組める（野戦・攻城）',
  phase3.modes.field === 'field' && phase3.modes.siege === 'siege' && phase3.walls > 0,
  JSON.stringify({ ...phase3.modes, 柵: phase3.walls, 隊: phase3.units }));
// ★騎射の間合いが効いていること。密着で威力が落ちないなら「近づかせない」戦術が消える
check('20. ★騎射は密着すると威力が落ちる',
  phase3.kisha.melee < phase3.kisha.ranged * 0.6, JSON.stringify(phase3.kisha));
check('21. ★士気で決着し全滅まで行かない',
  phase3.runs.every((r) => r.rounds < 40 && r.winner), JSON.stringify(phase3.runs.slice(0, 3)));
check('22. ★名乗りと一騎討ちが成立する', phase3.duel.can === true, JSON.stringify(phase3.duel));

/* --- Phase 4: 水軍・渡海・潮流（要件 M-33〜M-36） --- */
const phase4 = await page.evaluate(() => {
  const D = window.GENPEI_DEBUG, R = D.Rule, B = D.Battle;
  const out = {};
  const st = D.buildState('s1185a', 'kamakura');

  // (a) 水軍が起きているか
  out.suigun = Object.entries(st.suigun).map(([k, v]) => `${D.SUIGUN[k].jp}:${v.faction || '中立'}`);

  // (b) ★湊を持たない勢力は海を越えられない
  const noPort = D.buildState('s1185a', 'kamakura');
  for (const k of D.DATA.kyoten) if (k.type === 'minato' && noPort.kyoten[k.id].owner === 'kamakura') noPort.kyoten[k.id].owner = 'taira';
  const acrossFrom = D.DATA.kyoten.find((k) => k.type === 'kokufu' && D.islandOf(k.province) === 'honshu' && noPort.kyoten[k.id].owner === 'kamakura');
  const acrossTo = D.DATA.kyoten.find((k) => D.islandOf(k.province) === 'shikoku');
  out.noPort = acrossFrom && acrossTo ? R.canCrossSea(noPort, 'kamakura', acrossFrom.id, acrossTo.id) : null;
  out.withPort = acrossFrom && acrossTo ? R.canCrossSea(st, 'kamakura', acrossFrom.id, acrossTo.id) : null;

  // (c) ★海を越える出兵は海戦になる
  const nav = D.initBattle(st, { fid: 'kamakura', from: acrossFrom.id, to: acrossTo.id, troops: 4000 });
  out.mode = nav.mode;
  out.sea = nav.terrain.flat().filter((t) => t === 'sea').length;

  // (d) ★潮が反転し、順潮側の移動力と射程が伸びる
  const u = nav.units.find((x) => x.side === 'atk');
  const before = { tide: nav.tide, move: B.moveOf(nav, u), range: B.rangeOf(nav, u)[1] };
  nav.round = 1 + 4; B.tickTide(nav);
  const after = { tide: nav.tide, move: B.moveOf(nav, u), range: B.rangeOf(nav, u)[1] };
  out.tide = { before, after };

  // (e) ★水軍が離反しうる（名分差が開いた劣勢側から寝返る）
  const st2 = D.buildState('s1185a', 'taira');
  for (const sid of Object.keys(D.SUIGUN)) st2.suigun[sid].faction = 'taira';
  st2.factions.taira.choteki = true;               // 名分を落として差を作る
  const p = R.suigunDefectChance(st2, 'suigun_awa', 'taira', 'kamakura', 0.8);
  out.defect = { p: Number(p.toFixed(3)) };
  const nb = D.initBattle(st2, { fid: 'kamakura', from: acrossFrom.id, to: acrossTo.id, troops: 4000 });
  let flips = 0;
  for (let i = 0; i < 30; i++) { B.tickSuigunDefect(nb, st2); flips = nb.defected.length; if (flips) break; }
  out.defect.flips = flips;
  return out;
});
check('23. 水軍が起きている', phase4.suigun.length === 4, phase4.suigun.join(' / '));
check('24. ★湊を持たない勢力は海を越えられない',
  phase4.noPort && phase4.noPort.ok === false && phase4.withPort && phase4.withPort.ok === true,
  JSON.stringify({ 湊なし: phase4.noPort, 湊あり: phase4.withPort }));
check('25. ★海を越える出兵は海戦になる', phase4.mode === 'naval' && phase4.sea > 0,
  JSON.stringify({ mode: phase4.mode, 海マス: phase4.sea }));
check('26. ★潮が反転し順潮側の移動力と射程が伸びる',
  phase4.tide.before.tide !== phase4.tide.after.tide
  && (phase4.tide.before.move !== phase4.tide.after.move || phase4.tide.before.range !== phase4.tide.after.range),
  JSON.stringify(phase4.tide));
check('27. ★水軍が離反しうる', phase4.defect.p > 0 && phase4.defect.flips > 0, JSON.stringify(phase4.defect));

/* 11. ★例外の合算（pageerror だけでは素通りする） */
const engineErrors = await page.evaluate(() => window.GENPEI_DEBUG.errors().map((e) => `${e.key} ×${e.count}`));
check('10. pageerror が0件', pageErrors.length === 0, pageErrors.slice(0, 3).join(' / '));
check('11. engine.errors が0件（描画ループの例外）', engineErrors.length === 0, engineErrors.slice(0, 3).join(' / '));
check('12. console.error が0件', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' / '));
check('13. 404 のアセットがない', notFound.length === 0, notFound.slice(0, 3).join(' / '));

/* スクリーンショット */
const shot = path.join(ROOT, 'genpei-boot.png');
await page.screenshot({ path: shot });

await browser.close();
if (ctxServer) ctxServer.server.close();

console.log(`\n源平争乱記 起動検査（${USE_FILE ? 'file://' : 'http'}）`);
for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
console.log(`  スクリーンショット: ${path.relative(ROOT, shot)}`);
if (fails.length) { console.error(`\n✗ FAIL ${fails.length}件`); process.exit(1); }
console.log('\n✓ PASS — 起動して遊べる');
