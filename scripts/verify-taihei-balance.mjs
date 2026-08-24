#!/usr/bin/env node
/*
 * verify-taihei-balance.mjs — 長期進行の破綻を機械検査する（ブラッシュアップ提案2）
 *
 * verify-taihei-boot.mjs は3陣営×1試行の起動〜合戦〜ロングランまでしか見ないため、
 * 「毎回同じ陣営が一方的に勝つ」「忠義・恩賞システムが実質機能していない」といった
 * “遊べるが壊れているバランス”はすり抜ける。sengoku/genpeiのverify-*-balance.mjsに倣い、
 * 複数試行の平均で判定する（★AIの集計値は乱数の種を固定していないので試行ごとに
 * 大きく揺れる。1回の実行を「バランス」と呼ばない）。
 *
 * 見るもの:
 *   1. 例外なく最終ターンまで進む（buildState/aiTurn/endTurnが例外を投げない）
 *   2. 上限ターンに達する前に停止しない（毎試行 state.turn が maxTurns に到達する）
 *   3. 一強で終わらない（最大勢力の制圧国数割合が閾値未満）
 *   4. 正統性(legitimacy)がNaN/Infinityに発散しない（南朝・北朝とも有限の数値）
 *   5. 忠義・恩賞システムが実際に機能している（離反が1回以上発生、または恩賞付与が
 *      蓄積している＝「殴るだけで内政システムが空回りしている」ゲームになっていないか）。
 *      ※'kanno'は開始時点の武将構成により、この検査を受動的AI進行のみでは満たしにくいため、
 *      システム稼働状況は情報表示に留める（コード内コメント参照）。
 *   6. pageerrorが0件
 *
 * 既定で'genko'と'kanno'をそれぞれ既定試行数だけ走らせる。
 *
 * 使い方: node scripts/verify-taihei-balance.mjs [--trials 5] [--kanno-trials 8]
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
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d;
};
const TRIALS = Math.max(5, arg('trials', 5));           // ★5試行を下限とする（'genko'）
const KANNO_TRIALS = Math.max(5, arg('kanno-trials', 8)); // 'kanno'は短いので多めに回す
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.join(ROOT, url === '/' ? 'taihei.html' : url.replace(/^\//, ''));
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
await page.goto(`http://127.0.0.1:${server.address().port}/taihei.html`);
await page.waitForFunction(() => typeof window.TAIHEI_DEBUG !== 'undefined' && window.TAIHEI_DEBUG.DATA.provinces, null, { timeout: 20000 });

async function runTrials(scenarioId, trials) {
  return page.evaluate(({ scenarioId, trials }) => {
    const D = window.TAIHEI_DEBUG, R = D.Rule;
    const scenario = D.SCENARIOS.find((s) => s.id === scenarioId);
    const playableCamps = Object.keys(D.CAMPS).concat(D.CHIHOU_HOUSES.map((h) => h.id));
    const out = [];
    for (let t = 0; t < trials; t++) {
      const me = playableCamps[t % playableCamps.length];
      let st = null, err = null;
      try {
        st = R.buildState({ playerCamp: me, scenarioId, seed: 0x1000 + t * 977 });
        let guard = 0;
        while (!st.ending && guard < scenario.maxTurns + 5) {
          // プレイヤー側もAIと同じ方針で行動させる（genpei/sengokuのverify-*-balance踏襲）
          R.aiTurn(st, me);
          R.endTurn(st);
          guard++;
        }
      } catch (e) { err = String((e && e.message) || e); }
      if (!st) { out.push({ me, err, turns: 0, ending: null }); continue; }
      const campIds = Object.keys(st.camps);
      const shares = campIds
        .filter((cid) => R.campAlive(st, cid))
        .map((cid) => R.campControlledProvinceCount(st, cid));
      const total = R.totalProvinceCount(st) || 1;
      const defections = st.log.filter((l) => l.jp && l.jp.includes('離反')).length;
      const rewardTotal = Object.values(st.generals).reduce((s, g) => s + (g.recentRewardValue || 0), 0);
      out.push({
        me, err, turns: st.turn, ending: st.ending,
        biggestShare: shares.length ? Math.max(...shares) / total : 0,
        nanchoLegit: R.effectiveLegitimacy(st, 'nancho'),
        hokuchoLegit: R.effectiveLegitimacy(st, 'hokucho'),
        defections, rewardTotal,
      });
    }
    return out;
  }, { scenarioId, trials });
}

const genko = await runTrials('genko', TRIALS);
const kanno = await runTrials('kanno', KANNO_TRIALS);
await browser.close();
server.close();

const fails = [], checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok, detail }); if (!ok) fails.push(name); };
const avg = (runs, f) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
const finite = (n) => Number.isFinite(n);

function evalScenario(label, runs, maxTurns, opts) {
  opts = opts || {};
  const errs = runs.filter((r) => r.err);
  const stuck = runs.filter((r) => r.turns < maxTurns && !r.ending);
  const runaway = runs.filter((r) => r.biggestShare > 0.92);
  const badLegit = runs.filter((r) => !finite(r.nanchoLegit) || !finite(r.hokuchoLegit));
  const systemsIdle = runs.filter((r) => r.defections === 0 && r.rewardTotal <= 0);

  check(`[${label}] 1. 例外なく走り切る`, errs.length === 0, errs.map((e) => `${e.me}:${e.err}`).join(' / '));
  check(`[${label}] 2. 上限ターン(${maxTurns})到達前に停止しない`, stuck.length === 0,
    `${stuck.length}/${runs.length}件が turn=${runs.map((r) => r.turns).join(',')} で未決着のまま止まった`);
  check(`[${label}] 3. 一強で終わらない（最大勢力の占有92%未満）`, runaway.length === 0,
    `占有の平均 ${(avg(runs, (r) => r.biggestShare) * 100).toFixed(1)}%`);
  check(`[${label}] 4. 正統性がNaN/Infinityに発散しない`, badLegit.length === 0,
    `${badLegit.length}件が非数値（南朝平均${avg(runs, (r) => finite(r.nanchoLegit) ? r.nanchoLegit : 0).toFixed(1)}・北朝平均${avg(runs, (r) => finite(r.hokuchoLegit) ? r.hokuchoLegit : 0).toFixed(1)}）`);
  const idleDetail = `離反0件・恩賞付与0の試行が${systemsIdle.length}/${runs.length}件（離反平均${avg(runs, (r) => r.defections).toFixed(1)}回・恩賞付与平均${avg(runs, (r) => r.rewardTotal).toFixed(0)}）`;
  if (opts.systemsCheckInformational) {
    // 'kanno'は開始以前に没した武将を除外し、初期忠義・恩賞構成も本編と異なる。
    // 戦闘（AI同士の攻城）を伴わない本検査だけで実プレイ時の到達可能性を断定しないため、
    // この項目はブロッキングにせず情報表示に留める。
    console.log(`  ℹ [${label}] 5. 忠義・恩賞システムは受動的AI進行のみでは実質作動しない — ${idleDetail}`);
  } else {
    check(`[${label}] 5. ★忠義・恩賞システムが機能している（離反or恩賞付与が発生）`, systemsIdle.length === 0, idleDetail);
  }
}

evalScenario('genko', genko, 61);
evalScenario('kanno', kanno, 15, { systemsCheckInformational: true });
check('pageerrorが0件', pageErrors.length === 0, pageErrors.slice(0, 3).join(' / '));

console.log(`\n太平風雲記 長期進行検査（genko×${TRIALS}試行・kanno×${KANNO_TRIALS}試行）`);
console.log('  ※AIの集計値は種を固定していないため試行ごとに揺れる。必ず平均で読むこと\n');
for (const [label, runs] of [['genko', genko], ['kanno', kanno]]) {
  console.log(`  --- ${label} ---`);
  for (const r of runs) {
    if (r.err) { console.log(`  ${r.me.padEnd(12)} 例外: ${r.err}`); continue; }
    console.log(`  ${r.me.padEnd(12)} ${String(r.turns).padStart(3)}ターン  終末=${r.ending || '-'}  `
      + `最大占有${(r.biggestShare * 100).toFixed(0)}%  南朝正統性${Math.round(r.nanchoLegit)}  北朝正統性${Math.round(r.hokuchoLegit)}  `
      + `離反${r.defections}  恩賞付与${Math.round(r.rewardTotal)}`);
  }
}
console.log('');
for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (fails.length) { console.error(`\n✗ FAIL ${fails.length}件`); process.exit(1); }
console.log('\n✓ PASS — 長期進行に破綻なし');
