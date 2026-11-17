#!/usr/bin/env node
/**
 * トップの作品カタログ用メタデータ（公開日）を git の履歴から作る。
 *
 *   node scripts/gen-catalog-meta.mjs          # data/catalog-meta.json を書き出す
 *   node scripts/gen-catalog-meta.mjs --check  # 書き出さず、全カードに日付があるかだけ見る（無ければ非0）
 *
 * - 「新着順」の正本。日付を手で書かない（捏造しない）。値は「そのファイルがリポジトリに
 *   初めて追加された日（リネームを辿る）」＝公開日の近似。
 * - **浅いクローンでは実行を拒否する**。浅い履歴だと全ファイルが「クローンした日に追加された」
 *   ことになり、例外もエラーも出ずに新着順が全部同じ日付になる。
 *   直し方: git fetch --filter=blob:none --unshallow origin main
 * - 対象はトップの .work-card / .tool-card の href（ページ内リンク・外部URLは除く）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUT = 'data/catalog-meta.json';
const check = process.argv.includes('--check');

const html = readFileSync('index.html', 'utf8');
const hrefs = [...new Set(
  [...html.matchAll(/class="card (?:work|tool)-card[^"]*"[^>]*?href="([^"]+)"|<a[^>]*href="([^"]+)"[^>]*class="card (?:work|tool)-card/g)]
    .map(m => m[1] || m[2])
    .filter(h => h && !h.startsWith('#') && !/^https?:/.test(h))
)];
// tool-card は <div> で、リンクはカード内の .tool-link にある（カード1枚＝最初の tool-link）
for (const part of html.split('class="card tool-card').slice(1)) {
  const link = part.match(/class="tool-link" href="([^"]+)"/);
  const h = link && link[1];
  if (h && !h.startsWith('#') && !/^https?:/.test(h)) hrefs.push(h);
}
const targets = [...new Set(hrefs)];

const toPath = h => {
  let p = decodeURI(h.split(/[?#]/)[0]);
  if (p.endsWith('/')) p += 'index.html';
  return p;
};

if (check) {
  const meta = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { items: {} };
  const missing = targets.filter(h => !meta.items?.[h]?.added);
  if (missing.length) {
    console.error(`❌ catalog-meta: 公開日が無い作品 ${missing.length} 件 → node scripts/gen-catalog-meta.mjs で再生成\n  ` + missing.join('\n  '));
    process.exit(1);
  }
  console.log(`✅ catalog-meta: ${targets.length} 件すべてに公開日あり`);
  process.exit(0);
}

const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim();
if (shallow === 'true') {
  console.error('❌ 浅いクローンでは公開日を正しく出せません（全部がクローンした日になる）。\n   git fetch --filter=blob:none --unshallow origin main を実行してから再実行してください。');
  process.exit(2);
}

const items = {};
const missingFiles = [];
for (const h of targets) {
  const p = toPath(h);
  if (!existsSync(p)) { missingFiles.push(h); continue; }
  const log = args => execFileSync('git', ['log', ...args, '--', p], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  // リネームを辿った「追加」→ 辿らない「追加」→ そのファイルに触れた最古のコミット（マージで入った等）
  let out = log(['--follow', '--diff-filter=A', '--format=%as']);
  if (!out.length) out = log(['--diff-filter=A', '--format=%as']);
  if (!out.length) out = log(['--format=%as']);
  const added = out[out.length - 1];
  if (added) items[h] = { added };
}
if (missingFiles.length) console.warn('△ 実体が無いリンク（日付なし）:', missingFiles.join(', '));

const sorted = Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify({
  _note: 'scripts/gen-catalog-meta.mjs が git 履歴から生成（手編集しない）。added = リポジトリへ初めて追加された日。',
  items: sorted,
}, null, 2) + '\n');
console.log(`✅ ${OUT}: ${Object.keys(sorted).length} / ${targets.length} 件`);
