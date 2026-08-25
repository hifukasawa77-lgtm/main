#!/usr/bin/env node
/*
 * verify-bakumatsu-map.mjs — 幕末風雲記の拠点が地図の正しい場所に載っているか機械検査する
 *
 * ★ 拠点のずれは例外もエラーも出さない。「起動して例外0件」の検査は素通りするので、
 *   実際に描かれた拠点の画面座標を地図画像へ逆写像して陸/海を確かめるところまでやる。
 * ★ 地図の切り取り位置は CSS の background-position と game.js の MAP_FOCUS の
 *   二箇所にある。片方だけ直すと拠点だけが無言で地図から浮くので、一致を機械検査する。
 *
 * 検査:
 *   1. game.js の MAP_FOCUS と bakumatsu.css の background-position が一致するか
 *   2. 全拠点が地図画像の陸に載っているか（絵地図の陸/海判定はブロック平均で行う）
 *   3. 港（kind:'港'）は海に接しているか
 *   4. 実際にページを開いて描かれた拠点の画面座標が、上と同じ陸判定を通るか
 *      （projectPoint と CSS のズレ・切り取りの取り違えはここでしか出ない）
 *   5. 全拠点が表示領域の内側に十分な余白を持って収まっているか（フレームでの見切れ）
 *   6. 拠点どうしのラベルが重なりすぎていないか（警告のみ）
 *
 * 陸判定は絵地図（写実CG）向けのヒューリスティック。北西の雲は陸と誤判定するが、
 * 拠点は一つもその領域に無いので実害はない。閾値を触ったら検査4の結果で校正すること。
 *
 * 使い方: node scripts/verify-bakumatsu-map.mjs
 * 終了コード: 全PASS=0 / FAILあり=1
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP = 'assets/maps/strategic-japan.png';
const MAP_W = 1672, MAP_H = 941;
const EDGE_MARGIN_PX = 14;   // .strategic-map:after の内枠と同値。ここより外は見切れ扱い
const MIN_LABEL_GAP_PX = 8;  // ラベル矩形どうしの許容余白（下回ったら警告）
const PORT_SEA_RADIUS = 40;  // 港はこの画素距離以内に海があること（絵地図の湾は描き込みが粗い）

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.json': 'application/json; charset=utf-8',
};

const fails = [], warns = [];
const fail = m => fails.push(m);
const warn = m => warns.push(m);

/* ============ ソースから拠点座標と切り取り位置を読み出す ============ */
const gameJs = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'bakumatsu.css'), 'utf8');

const regionsSrc = gameJs.match(/const regions=\[([\s\S]*?)\n {2}\];/);
if (!regionsSrc) { console.error('✗ game.js の regions 配列を読み取れない'); process.exit(1); }
const regions = [...regionsSrc[1].matchAll(
  /\{id:'([^']+)',name:'([^']+)',area:'[^']*',x:([\d.]+),y:([\d.]+),[^}]*?kind:'([^']+)'/g)]
  .map(m => ({ id: m[1], name: m[2], x: +m[3], y: +m[4], kind: m[5] }));
if (regions.length === 0) { console.error('✗ 拠点を1件も読み取れない'); process.exit(1); }

/* ---- 検査1: MAP_FOCUS と background-position の一致 ---- */
const focusM = gameJs.match(/const MAP_FOCUS=\{x:([\d.]+),y:([\d.]+)\}/);
if (!focusM) fail('game.js に MAP_FOCUS がない');
const focus = focusM ? { x: +focusM[1], y: +focusM[2] } : { x: 0.5, y: 0.5 };
const bgM = css.match(/url\('assets\/maps\/strategic-japan\.png'\)\s*([^;]*?)\/cover/);
if (!bgM) fail('bakumatsu.css の .strategic-map の背景指定を読み取れない');
if (bgM) {
  const pos = bgM[1].trim();                       // 例: "38% center"
  const [px = 'center', py = 'center'] = pos.split(/\s+/);
  const toRatio = v => v === 'center' ? 0.5 : v === 'left' || v === 'top' ? 0
    : v === 'right' || v === 'bottom' ? 1 : /%$/.test(v) ? parseFloat(v) / 100 : NaN;
  const cssFocus = { x: toRatio(px), y: toRatio(py) };
  if (!(Math.abs(cssFocus.x - focus.x) < 1e-6 && Math.abs(cssFocus.y - focus.y) < 1e-6))
    fail(`切り取り位置の不一致: CSS は ${pos}（${cssFocus.x}, ${cssFocus.y}）だが `
       + `game.js の MAP_FOCUS は (${focus.x}, ${focus.y}) — 拠点だけ地図から浮く`);
}

/* ============ 地図画像の陸/海判定（ブロック平均） ============ */
const SAMPLER = ({ src, w, h, points, radius }) => new Promise(resolve => {
  const im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const BL = 6;
    // 絵地図なので画素単位では谷影・街道・河川が海色に落ちる。必ずブロック平均で判定する。
    const isLand = (cx, cy) => {
      let r = 0, gg = 0, b = 0, n = 0;
      for (let y = cy - BL; y <= cy + BL; y++) for (let x = cx - BL; x <= cx + BL; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
      }
      if (!n) return false;
      r /= n; gg /= n; b /= n;
      return (gg - b >= 8) && (gg >= r - 14);   // 陸は緑～黄土、海は青緑
    };
    resolve(points.map(p => {
      const cx = Math.round(p.x), cy = Math.round(p.y);
      let land = 0, n = 0;
      for (let dy = -12; dy <= 12; dy += 6) for (let dx = -12; dx <= 12; dx += 6) {
        n++; if (isLand(cx + dx, cy + dy)) land++;
      }
      let seaPx = Infinity;
      for (let rr = 4; rr <= radius && seaPx === Infinity; rr += 4)
        for (let a = 0; a < 32; a++) {
          const x = Math.round(cx + rr * Math.cos(a / 32 * 2 * Math.PI));
          const y = Math.round(cy + rr * Math.sin(a / 32 * 2 * Math.PI));
          if (!isLand(x, y)) { seaPx = rr; break; }
        }
      return { landRatio: land / n, seaPx };
    }));
  };
  im.onerror = () => resolve(null);
  im.src = src;
});

const dataUri = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, MAP)).toString('base64');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});

/* ---- 検査2・3: データ上の座標が陸に載っているか ---- */
const probe = await browser.newPage();
await probe.goto('about:blank');
const dataRes = await probe.evaluate(SAMPLER, {
  src: dataUri, w: MAP_W, h: MAP_H, radius: PORT_SEA_RADIUS,
  points: regions.map(r => ({ x: r.x / 100 * MAP_W, y: r.y / 100 * MAP_H })),
});
await probe.close();
if (!dataRes) fail('地図画像を読み込めない');
else regions.forEach((r, i) => {
  const { landRatio, seaPx } = dataRes[i];
  if (landRatio < 0.7)
    fail(`${r.name}（${r.id}）が陸に載っていない: x=${r.x} y=${r.y}（陸率 ${landRatio.toFixed(2)}）`);
  if (r.kind === '港' && !(seaPx <= PORT_SEA_RADIUS))
    fail(`${r.name}（${r.id}）は港だが半径${PORT_SEA_RADIUS}px以内に海がない`);
});

/* ---- 検査4・5・6: 実際に描かれた拠点で確かめる ---- */
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(204).end(); return; }   // 本物のアセット404だけ拾うため黙らせる
  const f = path.join(ROOT, u === '/' ? '/bakumatsu.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

const page = await browser.newPage({ viewport: { width: 1220, height: 860 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('response', r => { if (r.status() >= 400) pageErrors.push(`HTTP ${r.status()} ${r.url()}`); });
await page.goto(`http://127.0.0.1:${port}/bakumatsu.html`, { waitUntil: 'networkidle' });
await page.click('#title-start');
await page.click('[data-s="boshin"]');
await page.click('[data-f="aizu"]');
await page.click('[data-d="hard"]');
await page.waitForSelector('#map .node');
const drawn = await page.evaluate(() => {
  const map = document.getElementById('map');
  const mr = map.getBoundingClientRect();
  return {
    map: { w: map.clientWidth, h: map.clientHeight },
    nodes: [...map.querySelectorAll('.node')].map(n => {
      const r = n.getBoundingClientRect();
      const mark = n.querySelector('i').getBoundingClientRect();
      return {
        name: n.querySelector('span').firstChild.textContent,
        markX: mark.left + mark.width / 2 - mr.left, markY: mark.top + mark.height / 2 - mr.top,
        left: r.left - mr.left, top: r.top - mr.top, right: r.right - mr.left, bottom: r.bottom - mr.top,
      };
    }),
  };
});
await browser.close();
srv.close();

if (pageErrors.length) fail(`ページ読み込みで異常: ${pageErrors.slice(0, 3).join(' / ')}`);
if (drawn.nodes.length !== regions.length)
  fail(`描かれた拠点が ${drawn.nodes.length} 件（データは ${regions.length} 件）`);

// 画面座標 → 地図画像座標へ逆写像（projectPoint の逆。CSS の cover と同じ）
const scale = Math.max(drawn.map.w / MAP_W, drawn.map.h / MAP_H);
const rw = MAP_W * scale, rh = MAP_H * scale;
const ox = (drawn.map.w - rw) * focus.x, oy = (drawn.map.h - rh) * focus.y;
const back = drawn.nodes.map(n => ({ x: (n.markX - ox) / scale, y: (n.markY - oy) / scale }));

const probe2 = await (await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
})).newPage();
await probe2.goto('about:blank');
const drawnRes = await probe2.evaluate(SAMPLER, { src: dataUri, w: MAP_W, h: MAP_H, points: back, radius: 0 });
await probe2.context().browser().close();

drawn.nodes.forEach((n, i) => {
  if (drawnRes && drawnRes[i].landRatio < 0.7)
    fail(`描画位置が陸から外れている: ${n.name}（陸率 ${drawnRes[i].landRatio.toFixed(2)}）`);
  if (n.left < EDGE_MARGIN_PX || n.top < EDGE_MARGIN_PX
      || n.right > drawn.map.w - EDGE_MARGIN_PX || n.bottom > drawn.map.h - EDGE_MARGIN_PX)
    fail(`${n.name} のラベルが表示領域からはみ出す（左${n.left.toFixed(0)} 上${n.top.toFixed(0)} `
       + `右余${(drawn.map.w - n.right).toFixed(0)} 下余${(drawn.map.h - n.bottom).toFixed(0)}px）`);
});

for (let i = 0; i < drawn.nodes.length; i++)
  for (let j = i + 1; j < drawn.nodes.length; j++) {
    const a = drawn.nodes[i], b = drawn.nodes[j];
    const gapX = Math.max(a.left - b.right, b.left - a.right);
    const gapY = Math.max(a.top - b.bottom, b.top - a.bottom);
    if (Math.max(gapX, gapY) < MIN_LABEL_GAP_PX)
      warn(`ラベルが近接: ${a.name} と ${b.name}（余白 ${Math.max(gapX, gapY).toFixed(0)}px）`);
  }

/* ================= 報告 ================= */
console.log(`拠点 ${regions.length}件 — 切り取り位置 MAP_FOCUS(${focus.x}, ${focus.y})`);
console.log(`表示領域 ${drawn.map.w}×${drawn.map.h}px / 地図の可視範囲 `
  + `x ${((-ox) / rw * 100).toFixed(1)}%〜${((drawn.map.w - ox) / rw * 100).toFixed(1)}%`);
if (dataRes) console.log('陸率: ' + regions.map((r, i) => `${r.name}${dataRes[i].landRatio.toFixed(2)}`).join(' '));
for (const w of warns) console.log(`⚠ ${w}`);
if (fails.length) {
  console.error(`\n✗ FAIL ${fails.length}件`);
  for (const f of fails) console.error('  -', f);
  process.exit(1);
}
console.log('\n✓ PASS — 拠点の位置に問題なし');
