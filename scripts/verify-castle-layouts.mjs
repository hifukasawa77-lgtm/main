#!/usr/bin/env node
/**
 * verify-castle-layouts.mjs
 * 全城（城タイプ別4＋特別城35）の攻城レイアウトが「遊べる形」になっているかを機械検査する。
 * CASTLE_TRACED_LAYOUTS に城を1つ足すたびに実行すること。
 *
 * 検査項目:
 *   1) 天守が盤内にあり、ちょうど1マスであること
 *   2) 全塁が無傷なら、攻め手のスポーン(最下2行)から天守へ到達できないこと
 *      （＝防衛線が閉じている。素通りで落城しない）
 *   3) 破壊可能な塁（城門・柵・城壁・石垣・土塁・櫓）をすべて破れば天守へ到達できること
 *      （＝水堀や盤端で完全に封じられておらず、落城可能）
 *   4) 城内に守備隊を置ける空きマスが十分あること
 *
 * 使い方: node scripts/verify-castle-layouts.mjs
 *   sengoku.html をヘッドレスChromiumで読み、ページ内の実際の定義を使って検査する。
 *   失敗があれば終了コード1。
 * 依存: playwright（グローバル導入を想定。PLAYWRIGHT_PKG で場所を上書き可）
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_PW = path.join(ROOT, 'node_modules', 'playwright', 'index.js');
const PW = process.env.PLAYWRIGHT_PKG || (fs.existsSync(LOCAL_PW) ? LOCAL_PW : '/opt/node22/lib/node_modules/playwright/index.js');
const PW_SPECIFIER = path.isAbsolute(PW) ? pathToFileURL(PW).href : PW;
const { chromium } = (await import(PW_SPECIFIER)).default ?? await import(PW_SPECIFIER);

/* sengoku.html は同一オリジンから画像を読むので、簡易HTTPサーバで配信する */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.csv': 'text/csv' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(`${base}/sengoku.html`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof buildSpecialCastleLayout === 'function', null, { timeout: 30000 });

const results = await page.evaluate(() => {
  // レイアウト（kind→[[c,r]...]）を castleCells 相当へ展開する
  const toCells = (spec) => {
    const cells = {};
    for (const kind in spec) for (const [c, r] of spec[kind]) {
      if (cells[c + ',' + r] && cells[c + ',' + r].kind === 'keep') continue;
      cells[c + ',' + r] = { kind, destroyed: false };
    }
    if (spec.keep && spec.keep[0]) cells[spec.keep[0].join(',')] = { kind: 'keep', destroyed: false };
    return cells;
  };
  // 攻め手スポーン(最下2行)から到達できるマス。breakAll=true で破壊可能な塁を破った状態
  const reachable = (cells, breakAll) => {
    const blocked = (c, r) => {
      const cell = cells[c + ',' + r];
      if (!cell) return false;
      const pass = castleCellPassability(breakAll ? { ...cell, destroyed: true } : cell);
      return pass !== 'open';
    };
    const seen = {}, q = [];
    for (let c = 0; c < HEX.cols; c++) for (const r of [HEX.rows - 1, HEX.rows - 2]) {
      const k = c + ',' + r;
      if (!blocked(c, r) && !seen[k]) { seen[k] = 1; q.push([c, r]); }
    }
    for (let i = 0; i < q.length; i++) for (const [nc, nr] of hexNeighbors(q[i][0], q[i][1])) {
      const k = nc + ',' + nr;
      if (seen[k] || blocked(nc, nr)) continue;
      seen[k] = 1; q.push([nc, nr]);
    }
    return seen;
  };

  const targets = [];
  for (const t of ['hirajiro', 'yamajiro', 'hirayamajiro', 'umajiro']) {
    targets.push({ id: t, source: 'CASTLE_HEX_LAYOUTS', spec: CASTLE_HEX_LAYOUTS[t] });
  }
  for (const [key, keep] of Object.entries(SPECIAL_CASTLE_KEEP_HEX)) {
    const drawn = CASTLE_TRACED_LAYOUTS[key];
    // ゲーム(_buildCastleCells)と同じ補修を通した後の姿を検査する
    const spec = drawn ? ensureKeepSealed(JSON.parse(JSON.stringify(drawn)), drawn.keep[0])
      : buildSpecialCastleLayout(keep);
    targets.push({ id: key, source: drawn ? 'CASTLE_TRACED_LAYOUTS(トレース済み)' : '生成リング(トレース未了)', spec });
  }

  return targets.map(({ id, source, spec }) => {
    const issues = [];
    const keeps = spec.keep || [];
    if (keeps.length !== 1) issues.push(`天守が${keeps.length}マス（1マスであること）`);
    const [kc, kr] = keeps[0] || [-1, -1];
    if (!(kc >= 0 && kc < HEX.cols && kr >= 0 && kr < HEX.rows)) issues.push(`天守が盤外 (${kc},${kr})`);
    const cells = toCells(spec);
    const kk = kc + ',' + kr;
    if (issues.length === 0) {
      if (reachable(cells, false)[kk]) issues.push('無傷のまま天守へ到達できる（防衛線が開いている）');
      if (!reachable(cells, true)[kk]) issues.push('全塁を破っても天守へ到達できない（落城不能）');
    }
    let inside = 0;
    for (let r = 0; r < HEX.rows; r++) for (let c = 0; c < HEX.cols; c++) {
      const cell = cells[c + ',' + r];
      if ((!cell || cell.kind === 'keep') && hexDist(c, r, kc, kr) <= 4) inside++;
    }
    if (inside < 6) issues.push(`城内の空きマスが少なすぎる (${inside})`);
    const counts = {};
    for (const k in cells) counts[cells[k].kind] = (counts[cells[k].kind] || 0) + 1;
    return { id, source, keep: [kc, kr], inside, counts, issues };
  });
});

let ng = 0;
for (const r of results) {
  const tag = r.issues.length ? 'NG' : 'ok';
  if (r.issues.length) ng++;
  const cnt = Object.entries(r.counts).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`${tag} ${r.id.padEnd(22)} 天守[${r.keep}] ${r.source.padEnd(28)} ${cnt}`);
  for (const m of r.issues) console.log(`     - ${m}`);
}
const traced = results.filter(r => r.source.startsWith('CASTLE_TRACED')).length;
console.log(`\n${results.length}城を検査 / 失敗 ${ng} / トレース済み ${traced} / 未了 ${results.length - 4 - traced}`);
if (pageErrors.length) console.log('pageerror:', pageErrors.slice(0, 3));

await browser.close();
server.close();
process.exit(ng || pageErrors.length ? 1 : 0);
