#!/usr/bin/env node
/*
 * legal-lookup.mjs — 法令コーパスから条文を引く（リーガルチェッカーが手で使う道具）。
 *
 * 「覚えている条文」をそのまま報告に書かない。**引いてから書く**ための入口。
 * コーパス（legal/corpus/）は大きい（4MB超）ので Read せず、必ずこのスクリプトで必要な条だけ出す
 * （CLAUDE.md「コンテキスト節約のルール」）。
 *
 * 使い方:
 *   node scripts/legal-lookup.mjs 著作権法 32                  条文を出す
 *   node scripts/legal-lookup.mjs 著作権法 30条の4 --para 1    第1項だけ
 *   node scripts/legal-lookup.mjs 民法 548条の2 548条の4        複数条
 *   node scripts/legal-lookup.mjs 民法 709..711                範囲（同じ枝番なしの連番）
 *   node scripts/legal-lookup.mjs 刑法 --toc                   章・節の目次（論点から条を探す入口）
 *   node scripts/legal-lookup.mjs --search 不正指令電磁的記録     全法令を語で探す
 *   node scripts/legal-lookup.mjs --search 引用 --law 著作権法 --caption   見出しだけ
 *   node scripts/legal-lookup.mjs --list                       取り込み済みの法令と版
 * 法令名は正式名のほか通称（景表法・個情法・特商法・不競法・情プラ法 等）も使える。
 */
import { LAWS, lawByName, loadLaw, loadManifest, parseArticleNum, formatArticle, searchCorpus, displayArticleNum } from './legal-lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] ?? true) : null; };
const has = (name) => args.includes(name);

function list() {
  const m = loadManifest();
  if (!m) { console.log('コーパスが無い。node scripts/legal-corpus.mjs --fetch'); return 1; }
  console.log(`取得 ${m.fetched_at}（基準日 ${m.as_of}）`);
  for (const l of m.laws) {
    const e = LAWS.find(x => x.slug === l.slug);
    const alias = e?.aliases.length ? `（${e.aliases.join('・')}）` : '';
    console.log(`  ${l.title}${alias}  ${l.articles}条  版${l.enforcement_date}${l.upcoming.length ? `  ⏩改正予定${l.upcoming.length}` : ''}`);
  }
  return 0;
}

function toc(name) {
  const L = loadLaw(name);
  if (!L) { console.log(`法令が見つからない/未取得: ${name}`); return 1; }
  const first = new Map();
  for (const a of L.articles) if (!first.has(a.s)) first.set(a.s, a.n);
  L.sections.forEach((s, i) => console.log(`${displayArticleNum(first.get(i) ?? '?').padEnd(8)}  ${s}`));
  return 0;
}

function lookup(name, refs) {
  const L = loadLaw(name);
  if (!L) { console.log(`法令が見つからない/未取得: ${name}（--list で一覧）`); return 1; }
  const para = flag('--para') ? Number(flag('--para')) : null;
  let code = 0;
  const nums = [];
  for (const r of refs) {
    const range = /^(\d+)\.\.(\d+)$/.exec(r);
    if (range) { for (let i = Number(range[1]); i <= Number(range[2]); i++) nums.push(String(i)); continue; }
    const n = parseArticleNum(r);
    if (!n) { console.log(`条番号を解釈できない: ${r}`); code = 1; continue; }
    nums.push(n);
  }
  for (const n of nums) {
    const a = L.byNum.get(n);
    if (!a) { if (!/^\d+$/.test(n) || refs.length === 1) { console.log(`✗ ${L.title} ${displayArticleNum(n)} は実在しない`); code = 1; } continue; }
    console.log(formatArticle(L, a, { para }) + '\n');
  }
  return code;
}

let code = 0;
if (has('--list')) code = list();
else if (has('--search')) {
  const q = flag('--search');
  const { total, hits } = searchCorpus(q, { law: flag('--law') || undefined, captionsOnly: has('--caption') });
  console.log(`「${q}」${total}件${total > hits.length ? `（先頭${hits.length}件）` : ''}`);
  for (const h of hits) console.log(`  ${h.law} ${displayArticleNum(h.n)}${h.t ? `（${h.t}）` : ''}${h.snippet ? `  …${h.snippet}…` : ''}`);
} else {
  const positional = args.filter((a, i) => !a.startsWith('--') && !['--para', '--law'].includes(args[i - 1]));
  if (!positional.length) { console.log('使い方は先頭のコメント参照（--list / --search 語 / <法令名> <条>）'); code = 2; }
  else if (has('--toc')) code = toc(positional[0]);
  else if (!lawByName(positional[0])) { console.log(`法令名を解釈できない: ${positional[0]}（--list で一覧）`); code = 1; }
  else code = lookup(positional[0], positional.slice(1));
}
process.exit(code);
