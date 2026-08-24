#!/usr/bin/env node
/*
 * gen-taihei-provinces.mjs — 太平風雲記の国データを生成する
 *
 * 南北朝時代(1331-1392)の国境は源平争乱記(平安末期)と同一のため、
 * assets/genpei/provinces.json（12世紀令制国66）をそのまま複製し、
 * フィールド名だけ taihei_spec.md 3.3節の Province 構造へ合わせる
 * （nameJP→jp / nameEN→en / neighbors→adjacency / tasu→koku）。
 * owner/facility/garrison はランタイム状態なので静的JSONには含めない
 * （buildState() が実行時に初期化する）。
 *
 * x/y（論理座標0..1000 x 0..650）は令制国の隣接グラフの位相を持つだけで、
 * 実際の地図画像（taihei-japan-map.webp = sengoku/genpei と同一の絵地図）とは
 * 一切キャリブレーションされていない。国マーカーをこの絵地図に重ねて描く際は、
 * 代わりに genpei.html に埋め込まれた拠点CSV（kyotenCsv）の「国府」座標
 * （MX,MY・0..1正規化・実際の絵地図に対して手で位置合わせ済み）を国ごとに1件
 * 引いて mx/my として持たせる（taihei.html の provScreenXY はこちらを使う）。
 * ★ 2026-08-19: 国マーカーが地図から大きくずれるバグの修正で追加
 *   （x/yをそのまま絵地図の画素座標として使っていたのが原因）。
 *
 * ★ assets/genpei/ は読むだけで、書き戻さない。
 * ★ id は据え置く。変えると adjacency の参照が無言で切れる。
 *
 * 使い方: node scripts/gen-taihei-provinces.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/genpei/provinces.json');
const GENPEI_HTML = path.join(ROOT, 'genpei.html');
const OUT = path.join(ROOT, 'assets/taihei/provinces.json');

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));

/* ---- genpei.html の kyotenCsv から「国府」(kokufu_<provinceId>) のMX,MYを抽出する ---- */
function loadProvinceMxMy() {
  const html = fs.readFileSync(GENPEI_HTML, 'utf8');
  const m = html.match(/kyotenCsv:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) throw new Error('genpei.html から kyotenCsv が見つからない（フィールド名の変更を確認）');
  const csv = JSON.parse(`"${m[1]}"`); // JS文字列リテラルのエスケープを復元
  const lines = csv.split(/\r\n|\n/).filter(Boolean);
  const header = lines[0].split(',');
  const col = (name) => header.indexOf(name);
  const iType = col('種別'), iProv = col('国'), iMx = col('MX'), iMy = col('MY');
  if ([iType, iProv, iMx, iMy].some((i) => i < 0)) {
    throw new Error('kyotenCsv のヘッダー列（種別/国/MX/MY）が見つからない');
  }
  const out = {};
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    if (cells[iType] !== 'kokufu') continue;
    out[cells[iProv]] = { mx: parseFloat(cells[iMx]), my: parseFloat(cells[iMy]) };
  }
  return out;
}
const mxmyByProvince = loadProvinceMxMy();

const provinces = src.provinces.map((p) => {
  const site = mxmyByProvince[p.id];
  return {
    id: p.id,
    jp: p.nameJP,
    en: p.nameEN,
    circuit: p.circuit,
    region: p.region,
    x: p.x,
    y: p.y,
    mx: site ? site.mx : null,
    my: site ? site.my : null,
    terrain: p.terrain,
    koku: p.tasu,
    adjacency: [...p.neighbors].sort(),
  };
});

/* ---- 整合チェック（壊れたまま書き出さない） ---- */
const ids = new Set(provinces.map((p) => p.id));
const errors = [];
if (provinces.length !== 66) errors.push(`国数が66でない: ${provinces.length}`);
for (const p of provinces) {
  if (p.mx == null || p.my == null) errors.push(`${p.id}: 絵地図座標(mx/my)が見つからない（genpei.html の kokufu_${p.id} を確認）`);
  for (const n of p.adjacency) {
    if (!ids.has(n)) errors.push(`${p.id}: 存在しない隣国 ${n}`);
  }
  if (p.adjacency.includes(p.id)) errors.push(`${p.id}: 自己参照`);
}
for (const p of provinces) {
  for (const n of p.adjacency) {
    const other = provinces.find((q) => q.id === n);
    if (other && !other.adjacency.includes(p.id)) errors.push(`${p.id} ⇔ ${n}: 隣接が片方向`);
  }
}
if (errors.length) {
  console.error('✗ 生成を中止しました:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  version: 2,
  note: '南北朝期(1331-1392)の令制国66。国境は源平争乱記と同一のため assets/genpei/provinces.json を'
      + 'scripts/gen-taihei-provinces.mjs でフィールド名だけ変換して複製した（jp/en/adjacency/koku）。'
      + 'x/y は論理座標(0..1000 x 0..650、隣接グラフの位相用・絵地図とは非キャリブレーション)。'
      + 'mx/my は絵地図(taihei-japan-map.webp、sengoku/genpei と同一画像)に対して0..1正規化した実座標'
      + '（genpei.html の kyotenCsv 内 kokufu_<id> 拠点の座標を流用）。国マーカーの描画・当たり判定は'
      + '必ず mx/my を使うこと（x/yを画素座標として使うと地図から大きくずれる）。'
      + 'owner/facility/garrison はランタイム状態のためJSONに含めない。',
  generatedFrom: 'assets/genpei/provinces.json + genpei.html kyotenCsv(kokufu)',
  logicalWidth: src.logicalWidth,
  logicalHeight: src.logicalHeight,
  outline: src.outline,
  provinces,
}, null, 1) + '\n', 'utf8');

console.log(`✓ ${path.relative(ROOT, OUT)} — ${provinces.length}国（mx/my付き）`);
