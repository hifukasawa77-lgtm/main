#!/usr/bin/env node
/*
 * gen-taihei-embed.mjs — taihei.html の埋め込みシードを正本から再生成する
 *
 * taihei.html は assets/taihei/provinces.json を fetch し、失敗したら
 * HTML内の埋め込みシードへ落ちる（file:// で開いても動くため。genpei.html踏襲）。
 *
 * ★ 埋め込みシードの更新を忘れても例外は出ない。assets/taihei/provinces.json を
 *   編集した端末だけ正しく見え、file:// で開いた端末は古いデータで動く。
 *   provinces.json を変えたら必ずこれを実行すること。
 *
 * 使い方: node scripts/gen-taihei-embed.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'taihei.html');
const START = '/* ==TAIHEI_EMBED_START==';
const END = '/* ==TAIHEI_EMBED_END== */';

const provinces = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/taihei/provinces.json'), 'utf8'));

// 埋め込みでは outline を落とす（描画に使っていないうえ容量が大きい）
const slim = { version: provinces.version, provinces: provinces.provinces };

const block = `${START} 以下は自動生成。手で編集しないこと。
   scripts/gen-taihei-embed.mjs が assets/taihei/provinces.json から作る。 */
const EMBED = {
  provinces: ${JSON.stringify(slim)},
};
${END}`;

const html = fs.readFileSync(HTML, 'utf8');
const s = html.indexOf(START), e = html.indexOf(END);
if (s < 0 || e < 0) {
  console.error(`✗ taihei.html に埋め込み区画のマーカーが見つかりません（${START} … ${END}）`);
  process.exit(1);
}
fs.writeFileSync(HTML, html.slice(0, s) + block + html.slice(e + END.length), 'utf8');
console.log(`✓ taihei.html の埋め込みシードを更新 — 国 ${slim.provinces.length} / ${(block.length / 1024).toFixed(0)}KB`);
