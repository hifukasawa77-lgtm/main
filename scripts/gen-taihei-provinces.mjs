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
const OUT = path.join(ROOT, 'assets/taihei/provinces.json');

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const provinces = src.provinces.map((p) => ({
  id: p.id,
  jp: p.nameJP,
  en: p.nameEN,
  circuit: p.circuit,
  region: p.region,
  x: p.x,
  y: p.y,
  terrain: p.terrain,
  koku: p.tasu,
  adjacency: [...p.neighbors].sort(),
}));

/* ---- 整合チェック（壊れたまま書き出さない） ---- */
const ids = new Set(provinces.map((p) => p.id));
const errors = [];
if (provinces.length !== 66) errors.push(`国数が66でない: ${provinces.length}`);
for (const p of provinces) {
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
  version: 1,
  note: '南北朝期(1331-1392)の令制国66。国境は源平争乱記と同一のため assets/genpei/provinces.json を'
      + 'scripts/gen-taihei-provinces.mjs でフィールド名だけ変換して複製した（jp/en/adjacency/koku）。'
      + 'x/y は論理座標(0..1000 x 0..650)。owner/facility/garrison はランタイム状態のためJSONに含めない。',
  generatedFrom: 'assets/genpei/provinces.json',
  logicalWidth: src.logicalWidth,
  logicalHeight: src.logicalHeight,
  outline: src.outline,
  provinces,
}, null, 1) + '\n', 'utf8');

console.log(`✓ ${path.relative(ROOT, OUT)} — ${provinces.length}国`);
