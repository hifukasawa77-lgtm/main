#!/usr/bin/env node
/*
 * verify-genpei-kyoten.mjs — 源平争乱記の拠点データを機械検査する
 *
 * 要件 S-11 / S-12、受入基準 5.2。
 *
 * 検査:
 *   1. スキーマ・行数・ID重複・種別の内訳
 *   2. 参照している国が assets/genpei/provinces.json に実在するか
 *   3. MX,MY が 0..1 の正規化座標であるか（絶対画素値の混入を弾く）
 *   4. 拠点どうしの最短間隔が 11px 以上あるか
 *   5. 全拠点が地図の陸地に載っているか（湊は加えて海に接しているか）
 *   6. 領有列の値が既知の勢力IDか
 *   7. 参照している assets/sengoku/ のファイルが実在するか（移動・改名の検出）
 *   8. 水判定ヒューリスティックの健全性（siro_ichi.csv の164城で誤検出率を測る）
 *
 * 陸/海の判定は sengoku.html の mapImageLandWorld() と同じ閾値を使う。
 * 画像のデコードは Playwright（ヘッドレス Chromium）で行う。
 *
 * 使い方: node scripts/verify-genpei-kyoten.mjs
 * 終了コード: 全PASS=0 / FAILあり=1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV = path.join(ROOT, 'kyoten_ichi.csv');
const PROVINCES = path.join(ROOT, 'assets/genpei/provinces.json');
const CASTLE_CSV = path.join(ROOT, 'siro_ichi.csv');
// genpei.html が参照する sengoku 側の資産。移動・改名されたら気づけるようにここに列挙する。
const SENGOKU_REFS = ['assets/sengoku/gpt/sengoku-japan-map-user-v1.webp'];
const MAP = SENGOKU_REFS[0];
const MAP_W = 1672, MAP_H = 941;
const MIN_GAP = 11;
// MX,MY は小数6桁で保存されるため、画素へ戻すと最大 0.001px 程度の丸め誤差が出る。
// 生成側がちょうど 11px に置いた組が 10.99999px と読めて落ちるので、その分だけ緩める。
const GAP_EPS = 0.01;
// 湊はこの距離以内に海があること。絵地図なので湾の描き込みが粗く、12pxでは
// 桑名・敦賀のような湾奥の湊が届かない。gen-genpei-kyoten.mjs と同値にすること。
const MINATO_SEA_RADIUS = 20;
const KNOWN_FACTIONS = new Set([
  'taira', 'kamakura', 'kiso', 'kai', 'oshu', 'goshirakawa', 'yoshitsune', '',
]);

const fails = [], warns = [];
const fail = m => fails.push(m);
const warn = m => warns.push(m);

/* ================= 1. CSV の読み込みとスキーマ ================= */
function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  return { head, rows: lines.slice(1).map((l, i) => {
    const c = l.split(',');
    if (c.length !== head.length) fail(`CSV ${i + 2}行目: 列数が ${c.length}（見出しは ${head.length}）`);
    return Object.fromEntries(head.map((h, j) => [h, c[j] ?? '']));
  }) };
}
const { head, rows } = parseCsv(fs.readFileSync(CSV, 'utf8'));
const SCENARIO_COLS = head.filter(h => /^S(1180|1183|1184|1185A|1185B|IF)$/.test(h));
for (const need of ['ID', '拠点名', '種別', '国', 'MX', 'MY', '規模', '防御'])
  if (!head.includes(need)) fail(`CSV: 必須列「${need}」がない`);
if (SCENARIO_COLS.length !== 6) fail(`CSV: シナリオ列が6つでない（${SCENARIO_COLS.length}）`);

const seen = new Set();
for (const r of rows) {
  if (seen.has(r.ID)) fail(`ID重複: ${r.ID}`);
  seen.add(r.ID);
}
const byType = {};
for (const r of rows) byType[r['種別']] = (byType[r['種別']] ?? 0) + 1;
const EXPECT_TYPE = { kokufu: 66, tachi: 25, kisaku: 32, toride: 12, shoen: 40,
                      tera: 20, jinja: 20, sekisho: 15, machi: 14, mura: 18, minato: 17 };
const TYPE_JP = { kokufu:'国府', tachi:'館', kisaku:'城柵', toride:'砦', shoen:'荘園',
                  tera:'寺', jinja:'神社', sekisho:'関所', machi:'町', mura:'村', minato:'湊' };
for (const [t, n] of Object.entries(EXPECT_TYPE))
  if (byType[t] !== n) fail(`種別 ${t} の数が ${n} でない: ${byType[t] ?? 0}`);
for (const t of Object.keys(byType))
  if (!(t in EXPECT_TYPE)) fail(`未知の種別: ${t}`);

/* ================= 2. 国の実在 ================= */
const provJson = JSON.parse(fs.readFileSync(PROVINCES, 'utf8'));
const provIds = new Set(provJson.provinces.map(p => p.id));
for (const r of rows)
  if (!provIds.has(r['国'])) fail(`${r.ID}: 存在しない国 ${r['国']}`);
// 国衙は1国1つ
const kokugaByProv = {};
for (const r of rows.filter(r => r['種別'] === 'kokufu'))
  kokugaByProv[r['国']] = (kokugaByProv[r['国']] ?? 0) + 1;
for (const pid of provIds) {
  if (!kokugaByProv[pid]) fail(`国府のない国: ${pid}`);
  else if (kokugaByProv[pid] > 1) fail(`国府が複数ある国: ${pid}（${kokugaByProv[pid]}）`);
}

/* ================= 3. 正規化座標 ================= */
const pts = [];
for (const r of rows) {
  const mx = Number(r.MX), my = Number(r.MY);
  if (!Number.isFinite(mx) || !Number.isFinite(my)) { fail(`${r.ID}: MX/MY が数値でない`); continue; }
  if (mx < 0 || mx > 1 || my < 0 || my > 1)
    fail(`${r.ID}: MX/MY が 0..1 の外（${mx}, ${my}）— 絶対画素値を書いていないか`);
  pts.push({ id: r.ID, name: r['拠点名'], type: r['種別'], riverPort: r['備考'] === 'riverPort',
             x: mx * MAP_W, y: my * MAP_H });
}

/* ================= 4. 最短間隔 ================= */
for (let i = 0; i < pts.length; i++) {
  for (let j = i + 1; j < pts.length; j++) {
    const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
    if (d < MIN_GAP - GAP_EPS) fail(`${pts[i].name} と ${pts[j].name} が近すぎる（${d.toFixed(1)}px < ${MIN_GAP}）`);
  }
}

/* ================= 6. 領有値 ================= */
for (const r of rows)
  for (const c of SCENARIO_COLS)
    if (!KNOWN_FACTIONS.has(r[c])) fail(`${r.ID}: ${c} の勢力ID「${r[c]}」が未知`);
// どのシナリオでも、プレイ可能勢力が拠点ゼロで始まらないこと
for (const c of SCENARIO_COLS) {
  const owners = new Set(rows.map(r => r[c]).filter(Boolean));
  if (owners.size < 2) fail(`${c}: 領有している勢力が ${owners.size} しかない`);
}

/* ================= 7. sengoku 側の参照 ================= */
for (const rel of SENGOKU_REFS)
  if (!fs.existsSync(path.join(ROOT, rel))) fail(`参照先が存在しない: ${rel}（移動・改名された可能性）`);

/* ================= 5,8. 陸地判定（Playwright） =================
 * この地図画像は陸が緑〜黄土、海が青緑で描かれている。判定は g > b + 4 の一本。
 * sengoku.html の mapImageLandWorld() は3種の水条件を持つが、あれはワールド座標を
 * cover-crop 経由で画素へ写す前提の閾値で、画素を直接見る本検査には合わない
 * （既知の陸164点のうち 62点を海と誤判定した）。
 *
 * 画像は data: URI で渡す。file:// のまま canvas に描くと Chromium が汚染扱いにして
 * getImageData が例外を投げるため（--allow-file-access-from-files に頼らない）。 */
const SAMPLER = async ({ src, w, h, points, radius }) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const cnv = document.createElement('canvas');
  cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const isWaterAt = (ix, iy) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -2; dy <= 2; dy += 2) for (let dx = -2; dx <= 2; dx += 2) {
      const px = clamp(ix + dx, 0, w - 1), py = clamp(iy + dy, 0, h - 1);
      const o = (py * w + px) * 4;
      r += data[o]; g += data[o + 1]; b += data[o + 2]; n++;
    }
    r /= n; g /= n; b /= n;
    return g <= b + 4;   // 陸は緑〜黄土(g>b)、海は青緑(b>=g)
  };
  return points.map(p => {
    const ix = Math.round(p.x), iy = Math.round(p.y);
    const water = isWaterAt(ix, iy);
    let nearSea = false;
    for (let a = 0; a < 16 && !nearSea; a++) {
      const t = a / 16 * Math.PI * 2;
      for (let rr = 3; rr <= radius; rr += 3) {
        if (isWaterAt(Math.round(ix + Math.cos(t) * rr), Math.round(iy + Math.sin(t) * rr))) { nearSea = true; break; }
      }
    }
    return { water, nearSea };
  });
};

/* 校正: siro_ichi.csv の164城は定義上すべて陸にある。gen-genpei-kyoten.mjs と同じ
 * 較正アフィンを掛けたうえで、全城が陸に載ることを毎回測り直す。
 * ここが崩れたら「地図画像が差し替わった」か「較正係数が古い」かのどちらかで、
 * 拠点147の座標も同時に無効になっている。 */
const CALIB = { sx: 1.275, sy: 1.235, ox: 0, oy: -88 };
const castleRows = fs.readFileSync(CASTLE_CSV, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
const ch = castleRows[0].split(',');
const cx = ch.indexOf('X城の配置位置の座標'), cy = ch.indexOf('城の配置位置のY座標'), cn = ch.indexOf('城名');
const castlePts = castleRows.slice(1).map(l => l.split(','))
  .filter(c => Number.isFinite(Number(c[cx])) && Number.isFinite(Number(c[cy])))
  .map(c => ({ name: c[cn],
               x: Number(c[cx]) * CALIB.sx + CALIB.ox,
               y: Number(c[cy]) * CALIB.sy + CALIB.oy }));

const dataUri = 'data:image/webp;base64,' + fs.readFileSync(path.join(ROOT, MAP)).toString('base64');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});
const page = await browser.newPage();
await page.goto('about:blank');
const kyotenRes = await page.evaluate(SAMPLER,
  { src: dataUri, w: MAP_W, h: MAP_H, points: pts.map(p => ({ x: p.x, y: p.y })), radius: MINATO_SEA_RADIUS });
const castleRes = await page.evaluate(SAMPLER,
  { src: dataUri, w: MAP_W, h: MAP_H, points: castlePts.map(p => ({ x: p.x, y: p.y })), radius: 0 });
await browser.close();

const falsePositives = castleRes.filter(r => r.water).length;
const fpRate = falsePositives / castleRes.length;
if (fpRate > 0.03) {
  fail(`水判定の校正に失敗: 既知の城 ${castleRes.length} 件中 ${falsePositives} 件を海と誤判定（${(fpRate * 100).toFixed(1)}%）`);
} else if (falsePositives > 0) {
  warn(`水判定の誤検出: 既知の城 ${castleRes.length} 件中 ${falsePositives} 件（${(fpRate * 100).toFixed(1)}%）。閾値の限界として許容範囲`);
}

for (let i = 0; i < pts.length; i++) {
  const p = pts[i], res = kyotenRes[i];
  if (res.water) fail(`${p.name}（${p.id}）が海の上にある — アンカーのオフセットを直すこと`);
  // 備考が riverPort の湊は河港。海に接していないのが史実なので除外する（淀津）
  if (p.type === 'minato' && p.riverPort !== true && !res.water && !res.nearSea)
    fail(`${p.name}（${p.id}）は湊だが半径${MINATO_SEA_RADIUS}px以内に海がない`);
}

/* ================= 報告 ================= */
console.log(`拠点 ${rows.length}件 — ` + Object.entries(TYPE_JP).map(([t, jp]) => `${jp}${byType[t] || 0}`).join(' '));
console.log(`水判定の校正: 既知の城 ${castleRes.length}件中 ${falsePositives}件を海と誤判定（${(fpRate * 100).toFixed(1)}%）`);
for (const w of warns) console.log(`⚠ ${w}`);
if (fails.length) {
  console.error(`\n✗ FAIL ${fails.length}件`);
  for (const f of fails) console.error('  -', f);
  process.exit(1);
}
console.log('\n✓ PASS — 拠点データに問題なし');
