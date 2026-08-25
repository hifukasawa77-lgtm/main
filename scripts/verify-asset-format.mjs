#!/usr/bin/env node
/*
 * verify-asset-format.mjs — アセットの形式方針（原則WebP）を機械で守る
 *
 * 背景: 2026-08-02 に全アセットを WebP 化して 1.6GB → 264MB にしたが、その後 3週間で
 * PNG が 235枚・384MB 戻り、assets が 587MB まで膨らんだ（2026-08-25 に再変換）。
 * CLAUDE.md に方針は書いてあったが、守っているかを確かめる手段が無かったため
 * 誰も気づかないまま増え続けた。方針は文書ではなく検査で守る。
 *
 * 使い方:
 *   node scripts/verify-asset-format.mjs           # assets 全体を監査
 *   node scripts/verify-asset-format.mjs --diff    # 今回の差分で追加された分だけ（release-check 用）
 *   node scripts/verify-asset-format.mjs --json    # 機械可読
 *
 * 終了コード: 違反なし=0 / あり=1
 *
 * 設計のねらい:
 *   小さいアイコンまで指摘すると毎回赤くなって無視されるようになる（＝検査が腐る）。
 *   実際に容量が減るサイズ（既定100KB以上）だけを ✗ にし、それ未満は件数の参考表示に留める。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_DIR = 'assets';
const CONVERTIBLE = new Set(['.png', '.jpg', '.jpeg']);
/** これ未満は変換しても実利が無いので指摘しない（バイト） */
const SIZE_FLOOR = 100 * 1024;

/**
 * 変換してはいけないもの。理由を必ず添えること。
 * 理由の書けない例外は足さない（例外が増えると検査が意味を失うため）。
 */
const EXEMPT = [
  { re: /^assets\/marketing\/ig-.*\.jpe?g$/i, why: 'Instagram Graph API は JPEG しか受け付けない' },
  { re: /^assets\/og\//i,                     why: 'OGP画像。SNS側のWebP対応が不安定' },
  { re: /^assets\/maps\/strategic-japan\.png$/i, why: 'scripts/verify-bakumatsu-map.mjs がパスを直書きで参照' },
  { re: /^assets\/sengoku\/gpt\/[^/]+\.jpe?g$/i, why: '肖像・地形アトラス。合計1.9MBで、source-rect直書き箇所に触る割に合わない' },
];

const exemptionFor = (rel) => EXEMPT.find((e) => e.re.test(rel));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, out);
    else if (CONVERTIBLE.has(path.extname(entry.name).toLowerCase())) out.push(rel);
  }
  return out;
}

/**
 * 今回持ち込まれた画像。
 * 新規アセットは git add 前＝未追跡であることがほとんどなので、`git diff` だけを見ると
 * 本来いちばん捕まえたい対象を素通りする。追跡済みの変更と未追跡ファイルの両方を見る。
 */
function addedInDiff() {
  const collect = (cmd) => {
    try {
      return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).split('\n');
    } catch {
      return [];
    }
  };
  const lines = [
    ...collect('git diff HEAD --name-only --diff-filter=AM'),
    ...collect('git ls-files --others --exclude-standard'),
  ];
  return [...new Set(lines.map((line) => line.trim()))]
    .filter((line) => line.startsWith(`${ASSET_DIR}/`) && CONVERTIBLE.has(path.extname(line).toLowerCase()))
    .filter((line) => fs.existsSync(path.join(ROOT, line)));
}

const args = process.argv.slice(2);
const diffOnly = args.includes('--diff');
const asJson = args.includes('--json');

const files = diffOnly ? addedInDiff() : (fs.existsSync(path.join(ROOT, ASSET_DIR)) ? walk(ASSET_DIR) : []);

const violations = [];
const exempted = [];
let smallCount = 0;
let smallBytes = 0;

for (const rel of files) {
  const size = fs.statSync(path.join(ROOT, rel)).size;
  const exemption = exemptionFor(rel);
  if (exemption) { exempted.push({ rel, size, why: exemption.why }); continue; }
  if (size < SIZE_FLOOR) { smallCount += 1; smallBytes += size; continue; }
  violations.push({ rel, size });
}

violations.sort((a, b) => b.size - a.size);
const totalBytes = violations.reduce((sum, v) => sum + v.size, 0);
const mb = (bytes) => (bytes / 1048576).toFixed(1);

if (asJson) {
  console.log(JSON.stringify({ violations, exempted, smallCount, smallBytes, totalBytes }, null, 2));
  process.exit(violations.length ? 1 : 0);
}

console.log(`=== アセット形式の検査（${diffOnly ? '今回の差分' : 'assets 全体'}） ===`);
console.log(`  方針: 画像は原則WebP（CLAUDE.md「画像アセットの方針」）`);
console.log(`  対象: ${SIZE_FLOOR / 1024}KB 以上の .png/.jpg/.jpeg\n`);

if (!violations.length) {
  console.log(`  ✓ 変換すべき画像なし`);
} else {
  console.log(`  ✗ WebP化されていない画像 ${violations.length}件 / 計 ${mb(totalBytes)}MB`);
  const byDir = new Map();
  for (const v of violations) {
    const dir = path.dirname(v.rel);
    const cur = byDir.get(dir) ?? { count: 0, bytes: 0 };
    byDir.set(dir, { count: cur.count + 1, bytes: cur.bytes + v.size });
  }
  for (const [dir, info] of [...byDir].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 12)) {
    console.log(`     ${mb(info.bytes).padStart(7)}MB ${String(info.count).padStart(4)}件  ${dir}`);
  }
  console.log(`\n  変換手順（解像度は変えないこと。source-rect直書きが壊れる）:`);
  for (const [dir] of [...byDir].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 3)) {
    console.log(`     python3 scripts/optimize-assets.py --dir ${dir} --only png`);
  }
  console.log(`     python3 scripts/fix-webp-refs.py`);
  console.log(`     node scripts/verify-game-assets.mjs   # 必須`);
}

if (smallCount) console.log(`\n  （${SIZE_FLOOR / 1024}KB未満の未変換画像 ${smallCount}件 / 計 ${mb(smallBytes)}MB — 変換しても実利が薄いため対象外）`);
if (exempted.length) {
  console.log(`\n  除外 ${exempted.length}件:`);
  const seen = new Set();
  for (const e of exempted) {
    if (seen.has(e.why)) continue;
    seen.add(e.why);
    console.log(`     ${e.why}`);
  }
}

process.exit(violations.length ? 1 : 0);
