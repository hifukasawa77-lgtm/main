#!/usr/bin/env node
/*
 * agent-evolve-check.mjs — 案内エージェントのデータ整合チェック（日次自己進化の品質ゲート）
 *
 * 検査:
 *   1. GAMES: 必須フィールド・href先ファイルの実在・slug重複
 *   2. INTENT_DICT: [文字列, 数値] 型lint・言語内での重複キーワード
 *   3. KB: ja/en 両方の存在
 *   4. data/agent-news.json: スキーマ・期限切れエントリの検出
 *   5. site-knowledge.js の drift（gen-agent-knowledge.mjs --check と同等）
 *
 * 終了コード: 問題なし=0 / 問題あり=1（期限切れnewsは警告のみ）
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = require(path.join(ROOT, 'assets', 'js', 'agent-data.js'));

let fail = 0, warn = 0;
const ok = (m) => console.log('  ✓ ' + m);
const ng = (m) => { console.log('  ✗ ' + m); fail++; };
const wa = (m) => { console.log('  △ ' + m); warn++; };

console.log('== 1. GAMES 整合 ==');
{
  const slugs = new Set();
  let bad = 0;
  for (const g of data.GAMES) {
    if (!g.slug || !g.href || !g.cat || !g.title || !g.title.ja || !g.desc || !g.aliases) { ng(`必須フィールド欠落: ${g.slug || JSON.stringify(g).slice(0, 40)}`); bad++; continue; }
    if (slugs.has(g.slug)) { ng(`slug重複: ${g.slug}`); bad++; }
    slugs.add(g.slug);
    const href = g.href.split('#')[0].split('?')[0];
    if (href && !existsSync(path.join(ROOT, href))) { ng(`href先が存在しない: ${g.slug} → ${g.href}`); bad++; }
  }
  if (!bad) ok(`GAMES ${data.GAMES.length}本 OK（slug一意・href実在）`);
  for (const slug of data.RECOMMENDS) {
    if (!data.GAMES.some(g => g.slug === slug)) ng(`RECOMMENDS に存在しない slug: ${slug}`);
  }
}

console.log('== 2. INTENT_DICT 型・重複 ==');
{
  let bad = 0;
  for (const lang of Object.keys(data.INTENT_DICT)) {
    const seen = new Map();
    for (const [intent, arr] of Object.entries(data.INTENT_DICT[lang])) {
      if (!Array.isArray(arr)) { ng(`${lang}.${intent}: 配列でない`); bad++; continue; }
      for (const pair of arr) {
        if (!Array.isArray(pair) || typeof pair[0] !== 'string' || typeof pair[1] !== 'number') {
          ng(`${lang}.${intent}: [文字列, 数値] でないエントリ ${JSON.stringify(pair)}`); bad++; continue;
        }
        const kw = pair[0].toLowerCase();
        if (seen.has(kw) && seen.get(kw) !== intent) { wa(`${lang}: キーワード「${pair[0]}」が ${seen.get(kw)} と ${intent} で重複（意図的なら可）`); }
        seen.set(kw, intent);
      }
    }
  }
  if (!bad) ok('INTENT_DICT 型OK');
}

console.log('== 3. KB 日英ペア ==');
{
  let bad = 0;
  for (const [key, v] of Object.entries(data.KB)) {
    if (!v || typeof v.ja !== 'string' || typeof v.en !== 'string') { ng(`KB.${key}: ja/en が揃っていない`); bad++; }
  }
  if (!bad) ok(`KB ${Object.keys(data.KB).length}項目 OK（日英ペア）`);
}

console.log('== 4. agent-news.json ==');
{
  const p = path.join(ROOT, 'data', 'agent-news.json');
  if (!existsSync(p)) {
    wa('data/agent-news.json なし（プロアクティブお知らせは無効のまま動作）');
  } else {
    try {
      const arr = JSON.parse(readFileSync(p, 'utf8'));
      if (!Array.isArray(arr)) throw new Error('配列でない');
      const ids = new Set();
      let bad = 0;
      const now = Date.now();
      for (const n of arr) {
        if (!n.id || !n.date || (!n.ja && !n.en)) { ng(`newsエントリ不備: ${JSON.stringify(n).slice(0, 60)}`); bad++; continue; }
        if (ids.has(n.id)) { ng(`news id重複: ${n.id}`); bad++; }
        ids.add(n.id);
        if (n.expires && !(Date.parse(n.expires) > 0)) { ng(`news expires が日付でない: ${n.id}`); bad++; }
        else if (n.expires && Date.parse(n.expires) <= now) wa(`期限切れnews（削除推奨）: ${n.id}`);
      }
      if (!bad) ok(`news ${arr.length}件 OK`);
    } catch (e) {
      ng('agent-news.json のパース失敗: ' + e.message);
    }
  }
}

console.log('== 5. worker知識 drift ==');
try {
  execFileSync('node', [path.join(ROOT, 'scripts', 'gen-agent-knowledge.mjs'), '--check'], { stdio: 'pipe' });
  ok('site-knowledge.js は agent-data.js と一致');
} catch (e) {
  ng('site-knowledge.js が乖離。実行: node scripts/gen-agent-knowledge.mjs');
}

console.log('');
console.log(fail === 0
  ? `==> agent-evolve-check: 問題なし ✅${warn ? `（△警告 ${warn}件）` : ''}`
  : `==> agent-evolve-check: 問題あり ❌（✗ ${fail}件 / △ ${warn}件）`);
process.exit(fail === 0 ? 0 : 1);
