#!/usr/bin/env node
/**
 * apply-castle-layouts.mjs
 * scripts/trace-castle-layout.mjs で保存した castle-layouts.json を sengoku.html へ反映する。
 * 特別城は CASTLE_TRACED_LAYOUTS、城タイプ別4種（siegeHirajiro など）は CASTLE_HEX_LAYOUTS を書き換える。
 *
 * 使い方: node scripts/apply-castle-layouts.mjs <castle-layouts.json> [--dry]
 *   --dry を付けると差分の要約だけ出して書き込まない。
 *   反映後は必ず node scripts/verify-castle-layouts.mjs を実行すること。
 * 依存: なし
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const jsonPath = args.find(a => !a.startsWith('--'));
if (!jsonPath) {
  console.error('使い方: node scripts/apply-castle-layouts.mjs <castle-layouts.json> [--dry]');
  process.exit(2);
}

const HTML = path.join(ROOT, 'sengoku.html');
let src = fs.readFileSync(HTML, 'utf8');
const input = JSON.parse(fs.readFileSync(path.resolve(jsonPath), 'utf8'));

const KINDS = ['keep', 'gate', 'yagura', 'palisade', 'wall', 'stonewall', 'earthwork', 'drymoat', 'moat'];
const PASSABILITY = { moat: 'blocked', gate: 'breakable', palisade: 'breakable', wall: 'breakable', stonewall: 'breakable', earthwork: 'breakable', yagura: 'breakable', drymoat: 'open', keep: 'open' };
// 城タイプ別レイアウトの画像キー → CASTLE_HEX_LAYOUTS のキー
const TYPE_BY_KEY = { siegeHirajiro: 'hirajiro', siegeYamajiro: 'yamajiro', siegeHirayamajiro: 'hirayamajiro', siegeUmajiro: 'umajiro' };

/* ---------- 入力の検証（壊れたデータを sengoku.html へ入れない） ---------- */
const problems = [];
for (const [id, layout] of Object.entries(input)) {
  if (!/^siege[A-Za-z]+$/.test(id)) { problems.push(`${id}: 画像キーの形式ではない`); continue; }
  const seen = new Set();
  for (const [kind, cells] of Object.entries(layout)) {
    if (!KINDS.includes(kind)) { problems.push(`${id}: 未知の種別 ${kind}`); continue; }
    if (!Array.isArray(cells)) { problems.push(`${id}.${kind}: 配列ではない`); continue; }
    for (const cell of cells) {
      if (!Array.isArray(cell) || cell.length !== 2 || !cell.every(Number.isInteger)) { problems.push(`${id}.${kind}: [col,row] ではない要素がある`); break; }
      const [c, r] = cell;
      if (c < 0 || c > 16 || r < 0 || r > 14) { problems.push(`${id}.${kind}: 盤外 [${c},${r}]`); break; }
      const k = c + ',' + r;
      if (seen.has(k)) problems.push(`${id}: [${c},${r}] が複数の種別に属している`);
      seen.add(k);
    }
  }
  const keeps = (layout.keep || []).length;
  if (keeps !== 1) problems.push(`${id}: 天守が${keeps}マス（1マスにする）`);
}
if (problems.length) {
  console.error('入力に問題があるため中止:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

/* ---------- 整形 ---------- */
const fmt = (id, layout, indent) => {
  const pad = ' '.repeat(indent);
  const lines = [`${pad}${id}: {`];
  for (const kind of KINDS) {
    const cells = layout[kind];
    if (!cells || !cells.length) continue;
    const body = cells.map(([c, r]) => `[${c},${r}]`).join(',');
    // 1行が長くなりすぎないよう適当な幅で折り返す
    const chunks = [];
    let line = '';
    for (const part of body.split('],')) {
      const piece = part.endsWith(']') ? part : part + '],';
      if (line.length + piece.length > 96) { chunks.push(line); line = ''; }
      line += piece;
    }
    if (line) chunks.push(line);
    lines.push(`${pad}  ${kind}: [${chunks.join(`\n${pad}    `)}],`);
  }
  lines.push(`${pad}},`);
  return lines.join('\n');
};

/* ---------- CASTLE_TRACED_LAYOUTS（特別城） ---------- */
const special = Object.entries(input).filter(([id]) => !TYPE_BY_KEY[id]);
const types = Object.entries(input).filter(([id]) => TYPE_BY_KEY[id]);

const blockRe = /(const CASTLE_TRACED_LAYOUTS = \{)([\s\S]*?)(\n\};)/;
const m = src.match(blockRe);
if (!m) { console.error('sengoku.html の CASTLE_TRACED_LAYOUTS が見つからない'); process.exit(1); }
// 既存のトレース済みを読み、入力で上書きしてから書き戻す
const existing = new Function('return {' + m[2] + '\n}')();
// 城ごとの説明コメント（エントリ直前の // 行）は書き戻しでも残す
const comments = {};
{
  const lines = m[2].split('\n');
  let buf = [];
  for (const line of lines) {
    const entry = line.match(/^\s{2}(siege[A-Za-z]+):\s*\{/);
    if (entry) { if (buf.length) comments[entry[1]] = buf; buf = []; continue; }
    if (/^\s{2}\/\//.test(line)) buf.push(line.replace(/^\s+/, '  '));
    else if (line.trim() === '') buf = [];
  }
}
const merged = { ...existing };
for (const [id, layout] of special) merged[id] = layout;
const body = Object.entries(merged)
  .map(([id, l]) => (comments[id] ? comments[id].join('\n') + '\n' : '') + fmt(id, l, 2))
  .join('\n');
const nextSrc = src.replace(blockRe, (_, a, __, c) => a + '\n' + body + c);

/* ---------- SPECIAL_CASTLE_KEEP_HEX の同期 ----------
   トレースした天守が正。ここがずれたままだと「トレースを外したときの生成リング」が
   別の場所に城を組み立ててしまい、データが自分自身と矛盾する。 */
let keepSynced = [];
let syncSrc = nextSrc;
for (const [id, layout] of special) {
  const [c, r] = layout.keep[0];
  const re = new RegExp(`(\\b${id}\\s*:\\s*)\\[\\s*\\d+\\s*,\\s*\\d+\\s*\\]`);
  const m2 = syncSrc.match(re);
  if (!m2) continue;                                  // 特別城として登録されていない画像キー
  const before = m2[0];
  const after = `${m2[1]}[${c},${r}]`;
  if (before !== after) { keepSynced.push(`${id} ${before.replace(/\s+/g, '')} → [${c},${r}]`); }
  syncSrc = syncSrc.replace(re, after);
}

/* ---------- CASTLE_HEX_LAYOUTS（城タイプ別4種） ---------- */
let out = syncSrc;
for (const [id, layout] of types) {
  const type = TYPE_BY_KEY[id];
  const re = new RegExp(`(\\n  ${type}: \\{)[\\s\\S]*?(\\n  \\},?)`);
  if (!re.test(out)) { console.error(`CASTLE_HEX_LAYOUTS の ${type} が見つからない`); process.exit(1); }
  out = out.replace(re, '\n' + fmt(type, layout, 2).replace(/,$/, ','));
}

/* ---------- 要約 ---------- */
for (const [id, layout] of Object.entries(input)) {
  const counts = KINDS.filter(k => layout[k] && layout[k].length).map(k => `${k}:${layout[k].length}`).join(' ');
  const blocked = (layout.moat || []).length;
  const breakable = KINDS.filter(k => PASSABILITY[k] === 'breakable').reduce((n, k) => n + ((layout[k] || []).length), 0);
  console.log(`${TYPE_BY_KEY[id] ? '[城タイプ] ' : '[特別城] '}${id.padEnd(22)} 侵入不可${String(blocked).padStart(3)} / 破壊で侵入可${String(breakable).padStart(3)}   ${counts}`);
}
if (keepSynced.length) {
  console.log('\nSPECIAL_CASTLE_KEEP_HEX をトレースの天守に合わせて更新:');
  for (const line of keepSynced) console.log('  ' + line);
}
console.log(`\n特別城 ${special.length}城 / 城タイプ ${types.length}種 を反映${dry ? '（--dry のため書き込まない）' : ''}`);

if (!dry) {
  fs.writeFileSync(HTML, out);
  console.log('sengoku.html を更新した。次に必ず実行: node scripts/verify-castle-layouts.mjs');
}
