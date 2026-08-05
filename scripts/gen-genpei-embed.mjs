#!/usr/bin/env node
/*
 * gen-genpei-embed.mjs — genpei.html の埋め込みシードを正本から再生成する
 *
 * genpei.html は provinces.json / kyoten_ichi.csv を fetch し、失敗したら
 * HTML 内の埋め込みシードへ落ちる（要件 M-46。file:// で開いても動くため）。
 *
 * ★ 埋め込みシードの更新を忘れても例外は出ない。正本を編集した端末だけ正しく見え、
 *   file:// で開いた端末は古いデータで動く。データを変えたら必ずこれを実行すること。
 *   verify-genpei-kyoten.mjs が埋め込みと正本の一致を検査する。
 *
 * 使い方: node scripts/gen-genpei-embed.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'genpei.html');
const START = '/* ==GENPEI_EMBED_START==';
const END = '/* ==GENPEI_EMBED_END== */';

const provinces = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/genpei/provinces.json'), 'utf8'));
const csv = fs.readFileSync(path.join(ROOT, 'kyoten_ichi.csv'), 'utf8');

// 埋め込みでは outline を落とす（描画に使っていないうえ容量が大きい）
const slim = { version: provinces.version, provinces: provinces.provinces };

const block = `${START} 以下は自動生成。手で編集しないこと。
   scripts/gen-genpei-embed.mjs が provinces.json と kyoten_ichi.csv から作る。 */
const EMBED = {
  provinces: ${JSON.stringify(slim)},
  kyotenCsv: ${JSON.stringify(csv)},
};
${END}`;

const html = fs.readFileSync(HTML, 'utf8');
const s = html.indexOf(START), e = html.indexOf(END);
if (s < 0 || e < 0) {
  console.error(`✗ genpei.html に埋め込み区画のマーカーが見つかりません（${START} … ${END}）`);
  process.exit(1);
}
fs.writeFileSync(HTML, html.slice(0, s) + block + html.slice(e + END.length), 'utf8');
console.log(`✓ genpei.html の埋め込みシードを更新 — 国 ${slim.provinces.length} / 拠点 ${csv.trim().split('\n').length - 1} / ${(block.length / 1024).toFixed(0)}KB`);
