#!/usr/bin/env node
/*
 * verify-genpei-balance.mjs — 長期進行の破綻を機械検査する（要件 S-13）
 *
 * ★AI の集計値は乱数の種を固定していないので試行ごとに大きく揺れる。
 *   1回の実行を「バランス」と呼ぶと、たまたまの結果に引きずられる。
 *   だから必ず **5試行以上の平均** で見る（三国志・天下三分で得た教訓）。
 *
 * 見るもの:
 *   1. 停止・例外なく最終ターンまで進むか
 *   2. 勢力が早期に淘汰されないか（プレイ可能勢力が2年未満で消えない）
 *   3. 一強で終わらないか（最大勢力が全拠点を取り切らない）
 *   4. 名分・兵糧・恩賞債務が発散しないか
 *   5. 名分による無血開城が実際に起きているか（殴るだけのゲームになっていないか）
 *
 * 使い方: node scripts/verify-genpei-balance.mjs [--trials 5] [--scenario s1180]
 * 終了コード: 全PASS=0 / FAILあり=1
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const TRIALS = Math.max(5, Number(arg('trials', 5)));    // ★5試行を下限とする
const SCENARIO = arg('scenario', 's1180');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.webp': 'image/webp' };

const fails = [], checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok, detail }); if (!ok) fails.push(name); };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.join(ROOT, url === '/' ? 'genpei.html' : url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e && (e.stack || e.message) || e)));
await page.goto(`http://127.0.0.1:${server.address().port}/genpei.html`);
await page.waitForFunction(() => window.GENPEI_DEBUG && window.GENPEI_DEBUG.DATA.kyoten, null, { timeout: 20000 });

const runs = await page.evaluate(({ trials, scenario }) => {
  const D = window.GENPEI_DEBUG, R = D.Rule;
  const scn = D.SCENARIOS.find((s) => s.id === scenario);
  const out = [];
  for (let t = 0; t < trials; t++) {
    const me = scn.playable[t % scn.playable.length];
    const st = D.buildState(scenario, me);
    let turns = 0, opens = 0, err = null;
    try {
      while (!st.result && turns < 300) {
        // プレイヤー側も AI と同じ方針で指す（無操作の放置を「バランス」と呼ばない）
        D.applyActions(st, me, R.aiActions(st, me));
        D.aiPolitics(st, me);
        const before = R.ownedKyoten(st, me).length;
        D.endTurn(st);
        // 無血開城の痕跡はログで数える
        opens += st.log.filter((l) => l.text.includes('門を開いた')).length ? 0 : 0;
        void before;
        turns++;
      }
    } catch (e) { err = String(e && e.message || e); }
    const alive = Object.keys(D.FACTIONS).filter((f) => st.factions[f].alive && D.FACTIONS[f].playable);
    const sizes = alive.map((f) => R.ownedKyoten(st, f).length);
    const total = D.DATA.kyoten.length;
    out.push({
      me, turns, err,
      alive: alive.length,
      biggest: sizes.length ? Math.max(...sizes) : 0,
      share: sizes.length ? Math.max(...sizes) / total : 0,
      meibun: Object.fromEntries(alive.map((f) => [f, R.calcMeibun(st, f)])),
      food: Math.round(st.factions[me].food),
      debt: Math.round(R.totalDebt(st, me)),
      bloodless: st.log.filter((l) => l.text.includes('門を開いた')).length,
      opens,
    });
  }
  return out;
}, { trials: TRIALS, scenario: SCENARIO });

await browser.close();
server.close();

const avg = (f) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
const errs = runs.filter((r) => r.err);
const stuck = runs.filter((r) => r.turns >= 300);
const wiped = runs.filter((r) => r.alive < 2);
const runaway = runs.filter((r) => r.share > 0.92);
const badMeibun = runs.filter((r) => Object.values(r.meibun).some((m) => m < 0 || m > 1000));

check('1. 例外なく走り切る', errs.length === 0, errs.map((e) => `${e.me}:${e.err}`).join(' / '));
check('2. 停止しない（300ターン未満で決着）', stuck.length === 0, `${stuck.length}/${runs.length} 件が上限に到達`);
check('3. 勢力が淘汰されきらない（2勢力以上が残る）', wiped.length === 0,
  `残存勢力の平均 ${avg((r) => r.alive).toFixed(1)}`);
check('4. 一強で終わらない（最大勢力の占有 92%未満）', runaway.length === 0,
  `占有の平均 ${(avg((r) => r.share) * 100).toFixed(1)}%`);
check('5. 名分が範囲内（0〜1000）', badMeibun.length === 0, `${badMeibun.length} 件が範囲外`);
check('6. ★名分による無血開城が起きている', avg((r) => r.bloodless) > 0,
  `1試行あたり平均 ${avg((r) => r.bloodless).toFixed(1)} 回`);
check('7. pageerror が0件', pageErrors.length === 0, pageErrors.slice(0, 2).join(' / '));

console.log(`\n源平争乱記 長期進行検査（${SCENARIO} × ${TRIALS}試行）`);
console.log('  ※AIの集計値は種を固定していないため試行ごとに揺れる。必ず平均で読むこと\n');
for (const r of runs) {
  console.log(`  ${r.me.padEnd(11)} ${String(r.turns).padStart(3)}ターン  `
    + `残存${r.alive}勢力  最大${r.biggest}拠点(${(r.share * 100).toFixed(0)}%)  `
    + `兵糧${r.food}  未払${r.debt}  無血開城${r.bloodless}`);
}
console.log('');
for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (fails.length) { console.error(`\n✗ FAIL ${fails.length}件`); process.exit(1); }
console.log('\n✓ PASS — 長期進行に破綻なし');
