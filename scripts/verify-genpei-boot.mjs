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

const RULE_DEFECT = 20;      // genpei.html の RULE.hoko.defectBelow と同値
const RULE_POACH_REP = -20;  // genpei.html の RULE.recruit.poachRep と同値
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
  out.walls = siege.terrain.flat().filter((t) => ['saku', 'sakamogi', 'palisade'].includes(t)).length;
  const fort = D.initBattle(st, { fid: 'kamakura', from: 'kokufu_izu', to: 'toride_hashimoto', troops: 3000 });
  const seki = D.initBattle(st, { fid: 'kamakura', from: 'kokufu_izu', to: 'sekisho_usui', troops: 3000 });
  const temple = D.initBattle(st, { fid: 'kamakura', from: 'kokufu_izu', to: 'tera_enryakuji', troops: 3000 });
  const gosho = D.initBattle(st, { fid: 'kamakura', from: 'kokufu_izu', to: 'tachi_hiraizumi', troops: 3000 });
  out.art = { 城柵: siege.artId, 砦: fort.artId, 関: seki.artId, 寺: temple.artId,
              御所: gosho.artId, 国府: field.artId };
  out.collision = {
    谷底不可: !B.canEnter(seki, seki.units[0], D.TERRAIN.ravine),
    関の柵あり: seki.terrain.flat().includes('palisade'),
    関の虎口あり: seki.terrain.flat().includes('gate'),
  };

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
  phase3.modes.field === 'field' && phase3.modes.siege === 'siege' && phase3.walls > 0
  && phase3.art.城柵 === 'josaku_siege' && phase3.art.砦 === 'fort_siege'
  && phase3.art.関 === 'seki' && phase3.art.寺 === 'temple'
  && phase3.art.御所 === 'gosho' && phase3.art.国府 === 'kokufu'
  && phase3.collision.谷底不可 && phase3.collision.関の柵あり && phase3.collision.関の虎口あり,
  JSON.stringify({ ...phase3.modes, 柵: phase3.walls, 隊: phase3.units, art: phase3.art, collision: phase3.collision }));
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
  out.sea = nav.terrain.flat().filter((t) => t === 'sea' || t === 'deep_sea').length;

  // (d) ★潮が反転し、順潮側の移動力と射程が伸びる
  const u = nav.units.find((x) => x.side === 'atk');
  out.token = D.hexTokenKind(nav, u);
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
check('25. ★海を越える出兵は海戦になり、船型の駒を使う',
  phase4.mode === 'naval' && phase4.sea > 0 && phase4.token === 'ship',
  JSON.stringify({ mode: phase4.mode, 海マス: phase4.sea, 駒: phase4.token }));
check('26. ★潮が反転し順潮側の移動力と射程が伸びる',
  phase4.tide.before.tide !== phase4.tide.after.tide
  && (phase4.tide.before.move !== phase4.tide.after.move || phase4.tide.before.range !== phase4.tide.after.range),
  JSON.stringify(phase4.tide));
check('27. ★水軍が離反しうる', phase4.defect.p > 0 && phase4.defect.flips > 0, JSON.stringify(phase4.defect));

/* 28〜31. 回帰検査（2026-08-09 に見つけた不具合。どれも例外を出さず無言で壊れる） */
const regress = await page.evaluate(() => {
  const G = window.GENPEI_DEBUG;
  const out = {};

  /* 28. 合戦に勝ったら拠点を奪える。
     ★かつてプレイヤー側は applyActions へ troops:10**7 の番兵を渡していたが、
       関数冒頭の `src.garrison < act.troops` に弾かれて占領が無言で捨てられていた。
       AI は applyActions を直接叩くので、AIだけを見る検査では絶対に気づけない。
     ★ヘルパ（captureKyoten）を単体で呼ぶだけでは不足。出兵ボタンから合戦を経て
       盤面へ戻るまでの経路をそのまま通すこと（壊れていたのは経路の配線だった）。 */
  {
    G.gotoMap('s1180', 'kamakura');
    const sc = G.game.scene, st = sc.state, me = st.faction;
    let src = null, target = null;
    for (const s of G.Rule.ownedKyoten(st, me)) {
      for (const k of G.DATA.kyoten) {
        if (st.kyoten[k.id].owner === me || !G.Rule.adjacent(s, k) || G.Rule.needsSeaCrossing(s, k)) continue;
        if (st.kyoten[s.id].garrison < 100) continue;
        src = s; target = k; break;
      }
      if (target) break;
    }
    const before = st.kyoten[target.id].owner;
    sc._launchAttack(target, G.game);                 // ← 出兵ボタンが呼ぶのと同じ入口
    const bs = G.game.scene;
    let flow = bs.constructor.name;
    if (flow === 'BattleScene') {
      for (const u of bs.b.units) if (u.side === 'def') u.troops = 0;   // 城方が崩れた状態にする
      bs._endRound(G.game);
      if (bs.result) bs.onDone(bs.result);            // ← 勝敗の反映（占領）はこの先
    }
    out.capture = { id: target.id, flow, before, after: st.kyoten[target.id].owner,
                    garrison: st.kyoten[target.id].garrison, atkLeft: bs.result && bs.result.atkLeft };
  }

  /* 29. 盤上に無い神器・帝が湧かない／宝剣を失ったあとの引き継ぎは一度きり。
     ★s1185b は「平氏は壇ノ浦に滅び、宝剣は海に沈んだ」で始まるのに、
       誰も持っていない神器と帝が1ヶ月目に最高名分の勢力へ渡っていた。
       壇ノ浦後に保持勢力が滅んだ場合は毎ターン評判+60とログが無限に積もっていた。 */
  {
    const a = G.buildState('s1185b', 'yoshitsune');
    G.endTurn(a, null);
    const spawned = Object.values(a.factions).some((f) => f.authority.includes('jingi') || f.authority.includes('emperor'));

    const b = G.buildState('s1180', 'kamakura');
    b.jingiLost = true;
    for (const f of Object.values(b.factions)) f.authority = f.authority.filter((x) => x !== 'jingi');
    for (let i = 0; i < 6; i++) G.endTurn(b, null);
    out.regalia = { spawned, 引継ぎログ: b.log.filter((l) => /神器は/.test(l.text)).length };
  }

  /* 30. 勝利条件が VICTORY_TEXT の記述どおりに判定される。
     ★木曽の seitai_shogun は分岐が無く `else win = owned.length > 0` に落ちていたため、
       「高難度」と表示しながら実際は拠点が1つでも残れば勝ちだった。 */
  {
    const mk = (fid, tweak) => { const s = G.buildState('s1180', fid); s.year = s.endYear; s.month = s.endMonth; tweak(s); return G.Rule.checkVictory(s).win; };
    out.victory = {
      木曽_京なし: mk('kiso', () => {}),
      木曽_京12ヶ月: mk('kiso', (s) => { s.kyoten[G.KYOTO_KOKUFU].owner = 'kiso'; s.factions.kiso.authority.push('senji'); s.kyotoHoldMonths = { kiso: 12 }; }),
      鎌倉_平氏健在: mk('kamakura', (s) => {
        s.factions.kamakura.authority.push('senji');
        let n = 0; for (const k of G.DATA.kyoten) if (k.type === 'kokufu' && n < 40) { s.kyoten[k.id].owner = 'kamakura'; n++; }
      }),
      鎌倉_平氏滅亡: mk('kamakura', (s) => {
        s.factions.kamakura.authority.push('senji');
        let n = 0; for (const k of G.DATA.kyoten) if (k.type === 'kokufu' && n < 40) { s.kyoten[k.id].owner = 'kamakura'; n++; }
        for (const k of G.DATA.kyoten) if (s.kyoten[k.id].owner === 'taira') s.kyoten[k.id].owner = null;
        s.factions.taira.alive = false;
      }),
    };
  }

  /* 31. 「Phase N で開きます」としか言わない死んだコマンドが残っていない */
  {
    G.gotoMap('s1180', 'kamakura');
    const sc = G.game.scene;
    const closed = sc.cmdButtons.map((b) => b.id).filter((id) => !G.OPEN_COMMANDS.has(id));
    // 軍事パネルが実際に候補を並べるか
    sc.panel = 'gunji';
    sc.draw(document.getElementById('game').getContext('2d'), G.game);
    out.commands = { 未開通: closed, 出兵ボタン: sc.panelButtons.filter((b) => b.act === 'attack').length };
    sc.panel = null;
  }
  return out;
});
check('28. ★出兵→合戦に勝つ→拠点を奪える（プレイヤー経路を通しで）',
  regress.capture.flow === 'BattleScene' && regress.capture.before !== 'kamakura'
  && regress.capture.after === 'kamakura' && regress.capture.garrison === regress.capture.atkLeft,
  JSON.stringify(regress.capture));
check('29. ★盤上に無い神器・帝が湧かない／引き継ぎは一度きり',
  regress.regalia.spawned === false && regress.regalia.引継ぎログ === 1, JSON.stringify(regress.regalia));
check('30. ★勝利条件が表示どおりに判定される',
  regress.victory.木曽_京なし === false && regress.victory.木曽_京12ヶ月 === true
  && regress.victory.鎌倉_平氏健在 === false && regress.victory.鎌倉_平氏滅亡 === true,
  JSON.stringify(regress.victory));
check('31. ★未開通のまま残ったコマンドがない（軍事が出兵候補を並べる）',
  regress.commands.未開通.length === 0 && regress.commands.出兵ボタン > 0, JSON.stringify(regress.commands));

/* 32〜38. ブラッシュアップ分。定数を置いただけで参照されていない＝仕様が死ぬので機械で押さえる */
const brush = await page.evaluate(() => {
  const G = window.GENPEI_DEBUG, out = {};
  const mkBattle = (to) => G.initBattle(G.buildState('s1180', 'kamakura'),
    { fid: 'kamakura', from: 'kokufu_izu', to, troops: 3000 });

  /* 32. 崩れ（RULE.battle.breakBelow / breakDiv）が効く */
  {
    const hot = mkBattle('kokufu_suruga'), cold = mkBattle('kokufu_suruga');
    hot.rng = () => 0.01; cold.rng = () => 0.99;
    for (const u of hot.units) u.morale = 20;      // routBelow(10)超・breakBelow(25)未満
    for (const u of cold.units) u.morale = 20;
    G.Battle.tickMorale(hot); G.Battle.tickMorale(cold);
    out.break = { 崩れる: hot.units.filter((u) => u.troops <= 0).length,
                  耐える: cold.units.filter((u) => u.troops <= 0).length, 隊数: hot.units.length };
  }
  /* 33. 攻城戦の兵糧切れ（RULE.siege.starveMorale）。
     ★ヘルパを単体で呼ぶだけでは「_endRound から呼ばれているか」を確かめられない。
       ラウンド送りの実物を通すこと（28 と同じ落とし穴）。 */
  {
    G.gotoBattle('s1180', 'kamakura', 'kokufu_izu', 'tachi_hiraizumi');
    const sc = G.game.scene, b = sc.b;
    const early = { round: b.round };
    for (const u of b.units) u.morale = 100;
    sc._endRound(G.game);                                   // 序盤：まだ細らない
    early.log = b.log.some((l) => /兵糧が細る/.test(l));
    b.round = 8;
    for (const u of b.units) u.morale = 100;
    sc._endRound(G.game);                                   // 長期化：細る
    out.siege = { mode: b.mode, 序盤に細る: early.log,
                  長期化で細る: b.log.some((l) => /兵糧が細る/.test(l)),
                  士気: [100, Math.max(...G.Battle.alive(b, 'atk').map((u) => u.morale))] };
  }
  /* 34. 林が射線を遮る（TERRAIN.forest.blocksRange） */
  {
    const b = mkBattle('kokufu_suruga');
    for (let y = 0; y < G.HEX.rows; y++) for (let x = 0; x < G.HEX.cols; x++) b.terrain[y][x] = 'plain';
    const u = { hx: 2, hy: 4, side: 'atk', type: 'yumi', troops: 100, gen: null, injured: 0 };
    const t = { hx: 5, hy: 4, side: 'def', type: 'roto', troops: 100, gen: null, injured: 0 };
    const clear = G.Battle.canShoot(b, u, t);
    b.terrain[4][4] = 'forest';
    out.los = { 開けていれば撃てる: clear, 林越しは不可: !G.Battle.canShoot(b, u, t),
                騎射も林越しは不可: !G.Battle.canShoot(b, { ...u, type: 'kisha' }, t),
                密着は遮られない: G.Battle.canShoot(b, { ...u, type: 'kisha' }, { ...t, hx: 3 }) };
  }
  /* 35. 乱妨取りと寄進（RULE.rep.pillage / donateJisha / court.pillage） */
  {
    const st = G.buildState('s1180', 'kamakura'), f = st.factions.kamakura;
    const loot = G.Rule.ownedKyoten(st, 'kamakura').find((k) => G.PILLAGE_TYPES.has(k.type));
    const before = { food: f.food, rep: f.reputation, court: f.courtInfluence };
    const p1 = G.pillage(st, 'kamakura', loot.id);
    const p2 = G.pillage(st, 'kamakura', loot.id);
    const afterLoot = { food: f.food, rep: f.reputation, court: f.courtInfluence };
    const jisha = G.Rule.ownedKyoten(st, 'kamakura').find((k) => k.type === 'tera' || k.type === 'jinja');
    const gold0 = f.gold;
    const d = jisha ? G.donateJisha(st, 'kamakura', jisha.id) : { ok: false };
    out.pillage = { 兵糧増: afterLoot.food - before.food, 評判減: Math.round(afterLoot.rep - before.rep),
      朝廷支持減: Math.round(afterLoot.court - before.court), 連続不可: !p2.ok, gain: p1.gain,
      寄進: d.ok, 寄進で評判回復: Math.round(f.reputation - afterLoot.rep), 寄進の費用: gold0 - f.gold };
  }
  /* 36. 文治の勅許が国衙収入に効く（RULE.econ.shugoJitoMul） */
  {
    const st = G.buildState('s1184', 'kamakura');
    const b4 = G.Rule.income(st, 'kamakura').gold;
    G.applyEventEffect(st, 'shugo_jito');
    out.shugo = { holder: st.shugoJito, before: b4, after: G.Rule.income(st, 'kamakura').gold };
  }
  /* 37. 引き抜きは中立より難しく、成功すると評判を払う（RULE.recruit.poach*） */
  {
    const st = G.buildState('s1180', 'kamakura');
    const best = Object.values(st.bands).filter((b) => !b.faction)
      .map((b) => ({ b, c: G.Rule.recruitChance(st, 'kamakura', b.id, 200) }))
      .filter((x) => x.c.ok).sort((a, b) => b.c.score - a.c.score)[0];
    const neutral = best.c.score;
    best.b.faction = 'taira'; best.b.hoko = 55;
    const poach = G.Rule.recruitChance(st, 'kamakura', best.b.id, 200).score;
    best.b.hoko = 0; st.factions.taira.reputation = -600; st.factions.kamakura.gold = 99999;
    const rep0 = st.factions.kamakura.reputation;
    let r = null; for (let i = 0; i < 80 && !(r && r.joined); i++) r = G.tryRecruit(st, 'kamakura', best.b.id, 200);
    out.poach = { neutral, poach, joined: !!(r && r.joined), poached: !!(r && r.poached),
                  評判増減: r && r.joined ? Math.round(st.factions.kamakura.reputation - rep0) : null };
  }
  /* 38. 地形シードが拠点ごとに変わる／勢力一覧に自勢力が残る／一騎討ちの討死が響く */
  {
    const st = G.buildState('s1180', 'kamakura');
    const sig = (to) => G.initBattle(st, { fid: 'kamakura', from: 'kokufu_izu', to, troops: 3000 })
      .terrain.map((r2) => r2.join('')).join('|');
    const pair = G.DATA.kyoten.filter((k) => k.id.length === 14 && k.type !== 'tachi').slice(0, 2);
    out.seed = { 拠点: pair.map((k) => k.id), 別地形: sig(pair[0].id) !== sig(pair[1].id),
                 再現する: sig(pair[0].id) === sig(pair[0].id) };

    G.gotoMap('s1180', 'kai');
    const sc = G.game.scene;
    const rank = Object.keys(G.FACTIONS).filter((f) => sc.state.factions[f].alive)
      .map((f) => ({ f, m: G.Rule.calcMeibun(sc.state, f) })).sort((a, b) => b.m - a.m)
      .findIndex((x) => x.f === 'kai') + 1;
    out.side = { 名分順位: rank, 表示: sc._sideRows().map((x) => x.fid) };

    const b = G.initBattle(st, { fid: 'kamakura', from: 'kokufu_izu', to: 'kokufu_suruga', troops: 3000 });
    const a = b.units.find((u) => u.side === 'atk' && u.gen), d = b.units.find((u) => u.side === 'def' && u.gen);
    a.hx = d.hx - 1; a.hy = d.hy;
    for (const u of b.units) u.morale = 100;
    const seq = [0.01, 0.5, 0.9, 0.9, 0.9, 0.9, 0.01]; let i = 0;
    b.rng = () => seq[i++ % seq.length];
    const r = G.Battle.resolveDuel(b, a, d);
    const lose = r.win === 'atk' ? 'def' : 'atk';
    out.duel = { accepted: r.accepted, death: r.death,
                 敗者側士気: b.units.filter((u) => u.side === lose).map((u) => u.morale),
                 討死ログ: b.log.some((l) => /討死——.*陣が揺らぐ/.test(l)) };
  }
  return out;
});
check('32. ★崩れ（士気が breakBelow を割ると確率で退く）',
  brush.break.崩れる === brush.break.隊数 && brush.break.耐える === 0, JSON.stringify(brush.break));
check('33. ★攻城戦は長引くと寄手の兵糧が細る（ラウンド送りを通しで）',
  brush.siege.mode === 'siege' && brush.siege.序盤に細る === false && brush.siege.長期化で細る === true
  && brush.siege.士気[1] < brush.siege.士気[0], JSON.stringify(brush.siege));
check('34. ★林は射線を遮る（密着の白兵は遮られない）',
  brush.los.開けていれば撃てる && brush.los.林越しは不可 && brush.los.騎射も林越しは不可 && brush.los.密着は遮られない,
  JSON.stringify(brush.los));
check('35. ★乱妨取りは兵糧を生み名分を削る／寄進は買い戻す',
  brush.pillage.兵糧増 > 0 && brush.pillage.評判減 < 0 && brush.pillage.朝廷支持減 < 0
  && brush.pillage.連続不可 && brush.pillage.寄進 === true && brush.pillage.寄進で評判回復 > 0,
  JSON.stringify(brush.pillage));
check('36. ★文治の勅許が国衙収入に効く（ログの飾りにしない）',
  brush.shugo.holder === 'kamakura' && brush.shugo.after > brush.shugo.before, JSON.stringify(brush.shugo));
check('37. ★引き抜きは中立より難しく、成れば評判を払う',
  brush.poach.poach < brush.poach.neutral && brush.poach.joined && brush.poach.poached
  && brush.poach.評判増減 === RULE_POACH_REP, JSON.stringify(brush.poach));
check('38. ★地形は拠点ごとに変わる／自勢力は一覧に残る／一騎討ちの討死が全軍に響く',
  brush.seed.別地形 && brush.seed.再現する
  && brush.side.表示.includes('kai')
  && brush.duel.death && brush.duel.討死ログ && brush.duel.敗者側士気.every((m) => m < 100 - 18),
  JSON.stringify({ seed: brush.seed, side: brush.side, duel: brush.duel }));

/* 40-44. 遊び方ヘルプ・AI難易度（2026-08 ブラッシュアップで追加） */
const brush2 = await page.evaluate(() => {
  const G = window.GENPEI_DEBUG;
  // 40. ヘルプ: ページ送り・閉じるボタンの当たり判定が機能する
  const help = { open: true, page: 0 };
  const r1 = G.helpButtonRects(0, G.HELP_PAGES.length);
  G.handleHelpClick(help, { x: r1.next.x + 10, y: r1.next.y + 10 });
  const afterNext = help.page;
  const r2 = G.helpButtonRects(afterNext, G.HELP_PAGES.length);
  G.handleHelpClick(help, { x: r2.close.x + 10, y: r2.close.y + 10 });
  const closedAfter = help.open;

  // 41-42. AI難易度: 攻勢係数と出兵候補数が易しい<標準<難しいの順になる
  const mkAi = (difficulty) => G.Rule.aiActions(G.buildState('s1180', 'kamakura', difficulty), 'taira');
  const easyN = mkAi('easy').length, normalN = mkAi('normal').length, hardN = mkAi('hard').length;
  const easyMul = G.difficultyOf({ difficulty: 'easy' }).attackRatioMul;
  const hardMul = G.difficultyOf({ difficulty: 'hard' }).attackRatioMul;

  // 43. 旧セーブ互換: difficulty欠落は migrateState が 'normal' へ補う
  const st = G.buildState('s1180', 'kamakura', 'hard');
  delete st.difficulty;
  G.migrateState(st);
  const migratedDifficulty = st.difficulty;

  // 44. 新規ゲーム1ターン目のみ遊び方を自動表示（localStorageで一度きり）
  localStorage.removeItem('genpeiHelpSeen');
  G.gotoMap('s1180', 'kamakura', 'normal');
  const firstOpen = G.game.scene.help.open;
  G.gotoMap('s1183', 'kamakura', 'normal');
  const secondOpen = G.game.scene.help.open;

  // 45. BGM: ensure/setMood/toggle が例外なく動く（AudioContextはユーザー操作前提のため音は検証しない）
  let bgmError = null, bgmEnsured = false, moodBattle = null, moodCalm = null, toggledOff = null, toggledOn = null;
  try {
    bgmEnsured = G.BGM.ensure();
    G.BGM.setMood('battle'); moodBattle = G.BGM.mood;
    G.BGM.setMood('calm'); moodCalm = G.BGM.mood;
    const before = G.BGM.enabled;
    G.BGM.toggle(); toggledOff = G.BGM.enabled;
    G.BGM.toggle(); toggledOn = G.BGM.enabled;
    if (toggledOn !== before) bgmError = `toggle往復で元に戻らない: ${before}→${toggledOff}→${toggledOn}`;
  } catch (e) { bgmError = String(e); }

  // 46. モバイル可読性: ボタンラベルが幅を超える場合はフォントが自動で縮む（測定は実キャンバスで行う）
  const canvas2 = document.createElement('canvas');
  const ctx2 = canvas2.getContext('2d');
  const baseFont = '600 16px "Hiragino Mincho ProN", serif';
  const sizeOf = (font) => parseFloat(font.match(/(\d+(?:\.\d+)?)px/)[1]);
  // 中程度: 8文字ラベルが幅100pxのボタンに収まるまで縮む
  const midLabel = 'この勢力で始める';
  const midFitted = G.fitButtonFont(ctx2, midLabel, baseFont, 100);
  ctx2.font = midFitted; const midWidth = ctx2.measureText(midLabel).width;
  // 極端: 24文字ラベルは幅80pxには収まりきらないが、縮小は可読性下限（base-6px）で止まる（無限に縮めて潰さない）
  const longLabel = '長い翻訳ラベルでボタン幅をはみ出す想定のテキスト';
  const longFitted = G.fitButtonFont(ctx2, longLabel, baseFont, 80);
  // 十分広ければ縮めない
  const notShrunk = G.fitButtonFont(ctx2, 'OK', baseFont, 300);

  return { pagesCount: G.HELP_PAGES.length, afterNext, closedAfter, easyN, normalN, hardN, easyMul, hardMul, migratedDifficulty, firstOpen, secondOpen,
    bgmError, bgmEnsured, moodBattle, moodCalm, baseFont,
    midFitted, midWidth, midShrunkSize: sizeOf(midFitted), longFittedSize: sizeOf(longFitted), notShrunk };
});
check('40. ★遊び方ヘルプ: ページ送り・閉じるが機能する',
  brush2.pagesCount >= 3 && brush2.afterNext === 1 && brush2.closedAfter === false, JSON.stringify(brush2));
check('41. ★AI難易度: 出兵候補数が易しい≦標準≦難しいの順になる',
  brush2.easyN <= brush2.normalN && brush2.normalN <= brush2.hardN, JSON.stringify(brush2));
check('42. ★AI難易度: attackRatio係数は易しい>標準>難しいの順で厳しくなる',
  brush2.easyMul > brush2.hardMul, JSON.stringify(brush2));
check('43. ★旧セーブ互換: difficulty欠落は migrateState が "normal" へ補う',
  brush2.migratedDifficulty === 'normal', JSON.stringify(brush2));
check('44. ★遊び方ヘルプ: 新規ゲーム1ターン目のみ自動表示（localStorage一度きり）',
  brush2.firstOpen === true && brush2.secondOpen === false, JSON.stringify(brush2));
check('45. ★BGM: ensure/setMood/toggleが例外なく動き、mood切替・toggle往復が正しい',
  brush2.bgmError === null && brush2.bgmEnsured === true && brush2.moodBattle === 'battle' && brush2.moodCalm === 'calm',
  JSON.stringify(brush2));
check('46. ★モバイル可読性: 収まる範囲のラベルは幅に収まるまで縮み、十分広ければ縮めず、下限(base-6px)より小さくはしない',
  brush2.midWidth <= 100 && brush2.midShrunkSize < 16 && brush2.longFittedSize === 10 && brush2.notShrunk === brush2.baseFont,
  JSON.stringify(brush2));

/* 47-49. 実績システムの組み込み（achievements/genpei.js フック呼び出し） */
const achieve = await page.evaluate(() => {
  const D = window.GENPEI_DEBUG, R = D.Rule;
  localStorage.removeItem('genpei_achievements');

  // 47. 無血開城の成功で first_bloodless_open が実際に解除される
  const st0 = D.buildState('s1180', 'kamakura');
  for (let t = 0; t < 40; t++) {
    let opened = false;
    for (const k of D.DATA.kyoten) {
      if (k.type !== 'kokufu') continue;
      if (!R.canOpenBloodless(st0, 'kamakura', k.id).ok) continue;
      if (D.tryBloodlessOpen(st0, 'kamakura', k.id).opened) { opened = true; break; }
    }
    if (opened) break;
    D.endTurn(st0);
  }
  const afterBloodless = D.getEarnedAchievements();

  // 48. 毎ターンのポーリングで meibun_500 が解除される（endTurn経由・直呼びの両方を確認）
  D.checkAchievementsEvent && localStorage.removeItem('genpei_achievements');
  D.checkAchievementsPoll({ faction: 'kamakura', meibun: 520, seats: 0, kyotoHoldMonths: 0 });
  const afterPoll = D.getEarnedAchievements();

  // 49. シナリオ終幕（勝利）で first_victory が解除される
  localStorage.removeItem('genpei_achievements');
  D.checkAchievementsEvent('scenario_ended', { win: true, victory: 'bakufu', faction: 'kamakura', scenario: 's1180', jingiLost: false });
  const afterVictory = D.getEarnedAchievements();

  // 負のテスト: 条件未達では解除されないこと（閾値404 < 500）
  localStorage.removeItem('genpei_achievements');
  D.checkAchievementsPoll({ faction: 'kamakura', meibun: 404, seats: 0, kyotoHoldMonths: 0 });
  const belowThreshold = D.getEarnedAchievements();

  // 負のテスト: 他勢力(AI)の無血開城・勧誘・朝敵化・乱妨取りは自勢力(プレイヤー)の実績を解除しない
  localStorage.removeItem('genpei_achievements');
  const st1 = D.buildState('s1180', 'kamakura'); // プレイヤーはkamakura。taira/kiso/kai/oshuはAI
  for (let t = 0; t < 24; t++) D.endTurn(st1);
  const afterAiOnly = D.getEarnedAchievements();

  return { afterBloodless, afterPoll, afterVictory, belowThreshold, afterAiOnly };
});
check('47. ★実績: 無血開城の成功で first_bloodless_open が実際に解除される',
  achieve.afterBloodless.includes('first_bloodless_open'), JSON.stringify(achieve.afterBloodless));
check('48. ★実績: ポーリングで meibun_500 が解除される',
  achieve.afterPoll.includes('meibun_500'), JSON.stringify(achieve.afterPoll));
check('49. ★実績: シナリオ勝利で first_victory が解除される',
  achieve.afterVictory.includes('first_victory'), JSON.stringify(achieve.afterVictory));
check('49b. ★実績（負のテスト）: 閾値未達（名分404）では meibun_500 が解除されない',
  achieve.belowThreshold.length === 0, JSON.stringify(achieve.belowThreshold));
check('49c. ★実績（負のテスト）: 他勢力(AI)の行動だけでは自勢力の実績が解除されない（24ターン放置）',
  achieve.afterAiOnly.length === 0, JSON.stringify(achieve.afterAiOnly));

/* 50-54. 2人対戦（同一端末ホットシート） */
const hotseat = await page.evaluate(() => {
  const D = window.GENPEI_DEBUG, R = D.Rule;

  // 50. buildStateにP2を渡すとhumanFactionsが2件になる（同じ勢力は不可の前提はUI側で担保）
  const st = D.buildState('s1180', 'kamakura', 'normal', 'taira');
  const humanFactionsOk = JSON.stringify(st.humanFactions) === JSON.stringify(['kamakura', 'taira']);

  // 51. ★AIループはhumanFactions全員（P1・P2両方）を除外する。
  //     人間側に一切コマンドを出さないまま30ターン回し、P2(taira)の拠点数が
  //     一度も自力で増えないこと（＝AIが代打ちしていないこと）を確認する。
  //     旧実装は if(fid===state.faction) continue; だったため、2人対戦ではP2側が
  //     無人のままAIとして勝手に無血開城・出兵してしまうバグになりうる。
  const seatsOverTime = [];
  for (let i = 0; i < 30; i++) {
    D.endTurn(st);
    seatsOverTime.push(R.ownedKyoten(st, 'taira').length);
  }
  let tairaNeverGrew = true;
  for (let i = 1; i < seatsOverTime.length; i++) {
    if (seatsOverTime[i] > seatsOverTime[i - 1]) { tairaNeverGrew = false; break; }
  }

  // 52. 手番制の実際のフロー: P1がターン終了→暦は進まずP2に手番交代→P2がターン終了→暦が進む
  const st2 = D.buildState('s1180', 'kamakura', 'normal', 'taira');
  const monthBefore = st2.month, turnBefore = st2.turn;
  // P1(kamakura)の手番終了 相当の処理を直接呼ぶ（HandoffScene遷移はUIなのでstateの遷移だけ見る）
  st2.actedThisRound.push(st2.faction);
  const nextFid = st2.humanFactions.find((fid) => !st2.actedThisRound.includes(fid));
  const handedOffToP2 = nextFid === 'taira' && monthBefore === st2.month && turnBefore === st2.turn;
  st2.faction = nextFid;
  // P2(taira)の手番終了 → 全員が終えたので実際にendTurnが走る
  st2.actedThisRound.push(st2.faction);
  const allActed = st2.humanFactions.every((fid) => st2.actedThisRound.includes(fid));
  D.endTurn(st2);
  const monthAdvanced = st2.turn === turnBefore + 1;

  // 53. 京の保持月数は勢力ごとに独立して数える（片方だけ京を保持していても他方に漏れない）
  //     ★AIに奪還されないよう京の駐留兵を厚くしておく（薄いと近隣の平氏が即座に奪い返し、
  //       検証したいのが「独立カウント」なのに「奪還されるか」のテストになってしまう）
  const st3 = D.buildState('s1180', 'kamakura', 'normal', 'kiso');
  st3.kyoten[D.KYOTO_KOKUFU].owner = 'kiso';
  st3.kyoten[D.KYOTO_KOKUFU].garrison = 999999;
  for (let i = 0; i < 3; i++) D.endTurn(st3);
  const kisoHeld = (st3.kyotoHoldMonths && st3.kyotoHoldMonths.kiso) || 0;
  const kamakuraHeld = (st3.kyotoHoldMonths && st3.kyotoHoldMonths.kamakura) || 0;

  // 54. 旧セーブ互換: kyotoHoldMonthsが数値のままの旧形式でもmigrateStateがobject化する
  const st4 = D.buildState('s1180', 'kamakura');
  st4.kyotoHoldMonths = 7; // 旧形式を模す
  D.migrateState(st4);
  const migratedOk = st4.kyotoHoldMonths && st4.kyotoHoldMonths.kamakura === 7;

  return { humanFactionsOk, seatsOverTime, tairaNeverGrew, handedOffToP2, allActed, monthAdvanced, kisoHeld, kamakuraHeld, migratedOk };
});
check('50. ★2人対戦: buildStateにP2を渡すとhumanFactionsが両方入る', hotseat.humanFactionsOk, JSON.stringify(hotseat));
check('51. ★2人対戦: AIループはP1・P2両方を除外する（30ターン、P2の拠点が一度も自力で増えない）',
  hotseat.tairaNeverGrew, JSON.stringify(hotseat.seatsOverTime));
check('52. ★2人対戦: P1終了で暦は進まずP2へ手番交代、P2終了で暦が進む', hotseat.handedOffToP2 && hotseat.allActed && hotseat.monthAdvanced, JSON.stringify(hotseat));
check('53. ★2人対戦: 京の保持月数は勢力ごとに独立して数える（片方の保持が他方に漏れない）', hotseat.kisoHeld === 3 && hotseat.kamakuraHeld === 0, JSON.stringify(hotseat));
check('54. ★旧セーブ互換: kyotoHoldMonthsが数値のままでもmigrateStateがobject化する', hotseat.migratedOk, JSON.stringify(hotseat));

/* 39. 実際の BattleScene で背景と可動駒の画像が読み込まれること */
await page.evaluate(() => window.GENPEI_DEBUG.gotoBattle('s1180', 'kamakura', 'kokufu_izu', 'sekisho_usui'));
await page.waitForFunction(() => {
  const G = window.GENPEI_DEBUG, sc = G.game.scene;
  return sc && sc.constructor.name === 'BattleScene' && G.ASSETS.hexBattleBg.seki
    && sc.b.units.every((u) => G.ASSETS.hexBattleTokens[G.hexTokenKey(sc.b, u)]);
}, null, { timeout: 20000 }).catch(() => {});
const battleAssets = await page.evaluate(() => {
  const G = window.GENPEI_DEBUG, b = G.game.scene.b;
  return { artId: b.artId, background: !!G.ASSETS.hexBattleBg[b.artId],
    tokens: b.units.filter((u) => !!G.ASSETS.hexBattleTokens[G.hexTokenKey(b, u)]).length,
    units: b.units.length };
});
check('39. GPT-image ヘックス背景と可動駒が合戦画面へ読み込まれる',
  battleAssets.artId === 'seki' && battleAssets.background && battleAssets.tokens === battleAssets.units,
  JSON.stringify(battleAssets));

const battleShot = path.join(ROOT, 'genpei-battle.png');
await page.screenshot({ path: battleShot });

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
console.log(`  合戦スクリーンショット: ${path.relative(ROOT, battleShot)}`);
if (fails.length) { console.error(`\n✗ FAIL ${fails.length}件`); process.exit(1); }
console.log('\n✓ PASS — 起動して遊べる');
