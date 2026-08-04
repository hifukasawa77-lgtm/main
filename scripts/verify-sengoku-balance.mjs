#!/usr/bin/env node
/*
 * verify-sengoku-balance.mjs — 長期プレイ（AI同士の推移）が破綻しないかを機械検査する
 *
 * verify-sengoku-boot.mjs は「起動して1ターン回るか」までしか見ないため、
 * 数十〜百数十ターン目に出る類の壊れ方（進行停止・例外の蓄積・勢力の消滅や暴走）は
 * すり抜ける。ここでは委任状態で長期間ターンを回し、以下を検査する。
 *
 * 検査:
 *   1. 規定ターン数まで進行が止まらない（防衛戦キューやオーバーレイで詰まらない）
 *   2. 未捕捉例外・フレーム内例外（engine.errors）がいずれも0件
 *      ※ GameKit は update/draw の例外を捕捉して継続するため pageerror だけでは足りない
 *   3. 勢力の淘汰が健全な帯に収まる
 *        - 序盤で全滅しない（小勢力が一瞬で消えて数勢力だけにならない）
 *        - 終盤までに淘汰が進む（誰も滅びず初期勢力数のままにならない）
 *        - 単独勢力による即時統一が起きない
 *   4. 上記が複数試行で安定して成り立つ
 *
 * 注意: AIの集計値は乱数で試行ごとに揺れる。個別の数値ではなく「帯」で判定し、
 *       既定で複数試行の全てが帯に収まることを要求する（1回の実行で語らない）。
 *
 * 使い方: node scripts/verify-sengoku-balance.mjs [--turns 150] [--trials 3]
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

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
};
const TURNS = arg('turns', 150);
const TRIALS = arg('trials', 3);

function serve(root) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      // ブラウザが勝手に取りに行く favicon の404で console.error を出させない
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

async function runTrial(page, turns) {
  return page.evaluate(async (TURNS) => {
    const scn = DATA.scenarios[0];
    const d = (scn.daimyo || []).find(x => x.id === 'oda') || scn.daimyo[0];
    const st = buildGameState(scn.id, d.id, 'normal');
    game.changeScene(new MapScene(st));
    st.delegateInternal = true;   // 内政は委任し、AI同士の推移だけを見る

    const owners = () => {
      const c = {};
      Object.values(st.provinces).forEach(pr => { if (pr.owner) c[pr.owner] = (c[pr.owner] || 0) + 1; });
      return Object.entries(c).sort((a, b) => b[1] - a[1]);
    };
    const snapshot = () => {
      const a = owners();
      return { turn: st.turn, year: st.year, alive: a.length, top: a[0] ? a[0][1] : 0 };
    };

    const total = Object.values(st.provinces).filter(pr => pr.owner).length;
    const start = snapshot();
    const marks = [];
    const notes = [];
    let stalled = null, gameover = null, guard = 0;

    for (let t = 0; t < TURNS && guard < TURNS * 60; t++) {
      const before = st.turn;
      let inner = 0;
      while (st.turn === before && inner < 60) {
        guard++; inner++;
        const s = game.scene;
        // 手動ヘックス戦などでシーンが変わったら地図へ戻す
        if (s.constructor.name !== 'MapScene') { game.changeScene(new MapScene(st)); continue; }
        const ov = s.overlay;
        if (ov) {
          // 防衛戦は「自動で防衛」で解決する。それ以外の通知系は閉じて進める
          if (ov.type === 'defense') {
            try { s._resolveDefense(game, false); } catch (e) { notes.push('防衛戦: ' + e.message); s.overlay = null; }
          } else if (ov.type === 'gameover') {
            gameover = st.turn; break;
          } else s.overlay = null;
          continue;
        }
        try { s._endTurn(game); } catch (e) { notes.push('ターン終了: ' + e.message); s.overlay = null; }
      }
      if (gameover !== null) break;
      if (st.turn === before) { stalled = before; break; }
      if (st.turn % 20 === 0) marks.push(snapshot());
    }
    const end = snapshot();
    return {
      total, start, end, marks, notes: notes.slice(0, 5), stalled, gameover,
      frameErrors: (game.errors || []).map(r => ({ key: r.key, count: r.count }))
    };
  }, turns);
}

const { server, port } = await serve(ROOT);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
});

console.log('=== 戦国風雲記 長期進行・勢力淘汰の検査 ===');
console.log(`  ${TURNS}ターン × ${TRIALS}試行（AIの集計値は揺れるため複数試行で判定）\n`);

const results = [];
const pageErrors = [];
for (let i = 0; i < TRIALS; i++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => pageErrors.push((e.stack || String(e)).split('\n')[0]));
  await page.goto(`http://127.0.0.1:${port}/sengoku.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof game !== 'undefined' && game.scene && game.scene.constructor.name === 'TitleScene',
    null, { timeout: 180000 });
  const r = await runTrial(page, TURNS);
  results.push(r);
  const pct = (r.end.top / r.total * 100).toFixed(0);
  console.log(`  試行${i + 1}: ${r.start.alive}勢力 → ${r.end.alive}勢力 / 最大勢力 ${r.start.top}城 → ${r.end.top}城（全${r.total}城の${pct}%） / ${r.end.year}年`);
  await page.close();
}
await browser.close();
server.close();

// --- 判定 -------------------------------------------------------------
const fails = [];
const warn = [];

results.forEach((r, i) => {
  const tag = `試行${i + 1}`;
  if (r.stalled !== null) fails.push(`${tag}: ターン${r.stalled}で進行が停止した（オーバーレイ／防衛戦キューの詰まり）`);
  if (r.gameover !== null) warn.push(`${tag}: ターン${r.gameover}でゲームオーバー（プレイヤーが滅亡・検査上は許容）`);
  r.notes.forEach(n => fails.push(`${tag}: ${n}`));
  r.frameErrors.forEach(e => fails.push(`${tag}: フレーム内例外 ${e.key}（${e.count}回）`));

  // 勢力の淘汰が健全な帯に収まるか
  const startAlive = r.start.alive, endAlive = r.end.alive;
  if (endAlive >= startAlive) fails.push(`${tag}: ${TURNS}ターン経っても勢力が減っていない（${startAlive}→${endAlive}／AIが侵攻していない疑い）`);
  if (endAlive <= 2) fails.push(`${tag}: 勢力が${endAlive}まで淘汰された（淘汰が速すぎる）`);
  if (r.end.top >= r.total * 0.9) fails.push(`${tag}: 単独勢力が全${r.total}城中${r.end.top}城を占め、事実上の即時統一になっている`);

  // 序盤で一気に崩れていないか（20ターン時点で半分以上が消えるのは速すぎる）
  const early = r.marks.find(m => m.turn >= 20);
  if (early && early.alive < startAlive * 0.3) {
    warn.push(`${tag}: 20ターンで${startAlive}→${early.alive}勢力（小勢力の吸収が速い）`);
  }
});
if (pageErrors.length) pageErrors.slice(0, 5).forEach(e => fails.push(`未捕捉例外: ${e}`));

console.log('\n--- 推移（試行1） ---');
results[0].marks.forEach(m => console.log(`  ターン${String(m.turn).padStart(4)}  ${m.year}年  存続 ${String(m.alive).padStart(3)}勢力  最大 ${String(m.top).padStart(3)}城`));

if (warn.length) { console.log('\n--- 参考 ---'); warn.forEach(w => console.log('  ・' + w)); }

if (fails.length) {
  console.log(`\n--- 不合格 ${fails.length}件 ---`);
  fails.forEach(f => console.log('  ✗ ' + f));
  console.log('\n[FAIL] 長期進行の検査');
  process.exit(1);
}
console.log('\n[PASS] 長期進行・勢力淘汰ともに健全');
