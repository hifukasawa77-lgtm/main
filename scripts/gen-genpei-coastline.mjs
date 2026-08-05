#!/usr/bin/env node
/*
 * gen-genpei-coastline.mjs — 地図画像から海岸線と山地の輪郭を抽出する
 *
 * 背景: 地図素材 sengoku-japan-map-user-v1.webp は 1672×941 しかない。
 * 国の拡大図では横 0.06 相当（＝約100px）を 726px に伸ばすので 7倍以上の拡大になり、
 * どう描いてもぼやける。より大きな素材はリポジトリに存在しない。
 *
 * よって拡大図は写真を引き伸ばすのをやめ、**輪郭線から描き起こす**。
 * 線とベタ塗りは何倍に拡大しても鮮明なので、拡大するほど破綻する問題が消える。
 * 全国図は等倍に近いので写真のまま使う（そちらは写真の方が美しい）。
 *
 * 出力: assets/genpei/coastline.json
 *   { w, h, land: [...], relief: [ [輪郭...], [輪郭...] ] }   // 座標は 0..1 の正規化・小数4桁
 *   relief は明度で切った標高帯（丘陵・山地）。ベタ塗りを重ねて起伏を出す。
 *
 * 使い方: node scripts/gen-genpei-coastline.mjs [--tol 1.2]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP = 'assets/sengoku/gpt/sengoku-japan-map-user-v1.webp';
const OUT = path.join(ROOT, 'assets/genpei/coastline.json');
const MAP_W = 1672, MAP_H = 941;
const TOL = Number((process.argv.find((a) => a.startsWith('--tol=')) || '--tol=1.1').split('=')[1]);
const MIN_AREA = 26;      // これ未満の島は落とす（画素^2）

/* ---- 1. マスクの取得（陸／高地） ---- */
const dataUri = 'data:image/webp;base64,' + fs.readFileSync(path.join(ROOT, MAP)).toString('base64');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});
const page = await browser.newPage();
await page.goto('about:blank');
const masks = await page.evaluate(async ({ src, w, h }) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const land = new Array(w * h).fill(0);
  const lum = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // 陸/海の判定は verify-genpei-kyoten.mjs と同一規則（3×3近傍平均の g > b+4）
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -2; dy <= 2; dy += 2) for (let dx = -2; dx <= 2; dx += 2) {
      const o = (clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1)) * 4;
      r += d[o]; g += d[o + 1]; b += d[o + 2]; n++;
    }
    r /= n; g /= n; b /= n;
    const i = y * w + x;
    land[i] = g > b + 4 ? 1 : 0;
    // この衛星風の地図では、標高が上がるほど明るい岩肌になる。
    // 明度を標高の代わりに使い、分位点で帯に切って起伏を作る。
    lum[i] = land[i] ? 0.30 * r + 0.60 * g + 0.10 * b : -1;
  }
  // 陸の明度の分位点で2段の標高帯をつくる
  const vals = [];
  for (let i = 0; i < lum.length; i += 3) if (lum[i] >= 0) vals.push(lum[i]);
  vals.sort((a, b) => a - b);
  const q = (p) => vals[Math.floor(vals.length * p)];
  const t1 = q(0.42), t2 = q(0.74);
  const hill = new Array(w * h).fill(0), mount = new Array(w * h).fill(0);
  for (let i = 0; i < lum.length; i++) {
    if (lum[i] < 0) continue;
    if (lum[i] >= t1) hill[i] = 1;
    if (lum[i] >= t2) mount[i] = 1;
  }
  return { land, hill, mount, t1, t2 };
}, { src: dataUri, w: MAP_W, h: MAP_H });
await browser.close();

/* ---- 2. 輪郭追跡（Moore近傍） ---- */
function trace(mask, w, h, minArea) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);
  const seen = new Uint8Array(w * h);
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const out = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!at(x, y) || at(x - 1, y) || seen[y * w + x]) continue;   // 左が海＝輪郭の開始点
      // Moore近傍追跡
      const pts = [];
      let cx = x, cy = y, dir = 6, guard = 0;
      do {
        pts.push([cx, cy]);
        seen[cy * w + cx] = 1;
        let found = false;
        for (let k = 0; k < 8; k++) {
          const nd = (dir + 6 + k) % 8;
          const nx = cx + dirs[nd][0], ny = cy + dirs[nd][1];
          if (!at(nx, ny)) continue;
          cx = nx; cy = ny; dir = nd; found = true; break;
        }
        if (!found) break;
      } while ((cx !== x || cy !== y) && ++guard < 400000);
      if (pts.length < 8) continue;
      // 多角形の面積で小島を落とす
      let a = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
      }
      if (Math.abs(a / 2) < minArea) continue;
      out.push(pts);
    }
  }
  return out;
}

/* ---- 3. 間引き（Douglas–Peucker） ---- */
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const sq = tol * tol;
  const dist2 = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    return (p[0] - x) ** 2 + (p[1] - y) ** 2;
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let idx = -1, max = sq;
    for (let i = s + 1; i < e; i++) {
      const d = dist2(pts[i], pts[s], pts[e]);
      if (d > max) { max = d; idx = i; }
    }
    if (idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const landPolys = trace(masks.land, MAP_W, MAP_H, MIN_AREA).map((p) => simplify(p, TOL));
// 標高帯は輪郭が細かくなりやすい。小片を落とし、間引きを強めて数を抑える
const hillPolys = trace(masks.hill, MAP_W, MAP_H, MIN_AREA).map((p) => simplify(p, TOL * 2.0));
const mountPolys = trace(masks.mount, MAP_W, MAP_H, MIN_AREA).map((p) => simplify(p, TOL * 2.0));

const enc = (polys) => polys.map((p) => {
  const flat = [];
  for (const [x, y] of p) { flat.push(Number((x / MAP_W).toFixed(4)), Number((y / MAP_H).toFixed(4))); }
  return flat;
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const json = {
  version: 1,
  note: '地図画像から抽出した海岸線と山地の輪郭。座標は 0..1 の正規化。'
      + '拡大図・周辺図は写真を引き伸ばさずこの輪郭から描き起こす（拡大してもぼやけないため）。'
      + 'scripts/gen-genpei-coastline.mjs で再生成する。',
  source: MAP, w: MAP_W, h: MAP_H,
  land: enc(landPolys),
  relief: [enc(hillPolys), enc(mountPolys)],
};
fs.writeFileSync(OUT, JSON.stringify(json), 'utf8');

const pts = (a) => a.reduce((s, p) => s + p.length / 2, 0);
console.log(`✓ ${path.relative(ROOT, OUT)}`);
console.log(`   海岸線 ${landPolys.length}本 / ${pts(json.land)}点`);
console.log(`   丘陵   ${hillPolys.length}本 / ${pts(json.relief[0])}点`);
console.log(`   山地   ${mountPolys.length}本 / ${pts(json.relief[1])}点  (閾値 ${masks.t1.toFixed(0)} / ${masks.t2.toFixed(0)})`);
console.log(`   ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB（tol=${TOL}）`);
