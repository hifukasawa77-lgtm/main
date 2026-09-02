#!/usr/bin/env node
/*
 * verify-note-articles.mjs — note記事の事前検査。
 *
 * noteは投稿してしまうと「読者の目に触れた」ことが取り消せない。
 * 誇大表現・機微情報の混入・薄い無料部分は、投稿後に直しても手遅れになる。
 * 「貼る前に確かめられること」はすべてここで機械検査する。
 *
 *    1. frontmatter の必須項目と語彙
 *    2. slug の一意性とファイル名との一致
 *    3. 価格がnoteの許容範囲か（0 または 100〜50,000円）
 *    4. 有料ラインの個数（有料記事はちょうど1つ、無料記事は0）
 *    5. 分量（無料部分が薄い記事は返金申請の対象になる）
 *    6. 有料部分に見合う中身があるか
 *    7. 誇大表現・虚偽の収益実績（禁止語）
 *    8. 機微情報（APIキー・Webhook URL・メールアドレス）の混入
 *    9. 事実の焼き付き（ゲーム本数が実データと一致するか）
 *   10. status と publish-log.json / topics.json の整合
 *   11. 記事が指すリポジトリ内ファイルが実在するか
 *   12. 投稿ペースの上限（週1本・スパム的な大量投稿の禁止）
 *
 * 使い方: node scripts/verify-note-articles.mjs
 * 終了コード: 問題なし=0 / 問題あり=1
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArticles, splitPaywall, countChars, PAYWALL_MARK } from './note-export.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let fail = 0;
const ok  = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.log(`  ✗ ${m}`); fail = 1; };
const warn = (m) => console.log(`  △ ${m}`);

const articles = loadArticles();
if (articles.length === 0) {
  console.log('note/articles/ に記事がない。/note-post で書く。');
  process.exit(0);
}
console.log(`note/articles/ の記事 ${articles.length}本を検査する\n`);

// ── 1. frontmatter ─────────────────────────────────────────
console.log('== 1. frontmatter の必須項目と語彙 ==');
const REQUIRED = ['title', 'slug', 'kind', 'price', 'status', 'topic_id', 'hashtags'];
const KINDS = ['free', 'paid'];
const STATUSES = ['draft', 'ready', 'published'];
for (const a of articles) {
  const missing = REQUIRED.filter(k => a.meta[k] === undefined);
  if (missing.length) { bad(`${a.file}: 必須項目が無い — ${missing.join(', ')}`); continue; }
  if (!KINDS.includes(a.meta.kind)) { bad(`${a.file}: kind が語彙外 — ${a.meta.kind}（${KINDS.join('/')}）`); continue; }
  if (!STATUSES.includes(a.meta.status)) { bad(`${a.file}: status が語彙外 — ${a.meta.status}（${STATUSES.join('/')}）`); continue; }
  if ((a.meta.kind === 'paid') !== (Number(a.meta.price) > 0)) {
    bad(`${a.file}: kind=${a.meta.kind} と price=${a.meta.price} が矛盾`); continue;
  }
  const tags = a.meta.hashtags || [];
  if (tags.length < 3 || tags.length > 5) { bad(`${a.file}: ハッシュタグは3〜5個（現在 ${tags.length}個）`); continue; }
  ok(`${a.file}: 必須項目・語彙OK`);
}

// ── 2. slug ────────────────────────────────────────────────
console.log('== 2. slug の一意性とファイル名との一致 ==');
{
  const slugs = articles.map(a => a.meta.slug);
  const dupes = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
  if (dupes.length) bad(`slug重複 — ${dupes.join(', ')}`); else ok(`slug ${slugs.length}件、重複なし`);
  for (const a of articles) {
    // ファイル名は YYYY-MM-DD-<slug>.md
    if (a.file.endsWith(`-${a.meta.slug}.md`)) ok(`${a.file}: ファイル名とslugが一致`);
    else bad(`${a.file}: ファイル名が slug（${a.meta.slug}）と一致しない。YYYY-MM-DD-<slug>.md にする`);
  }
}

// ── 3. 価格 ────────────────────────────────────────────────
console.log('== 3. 価格がnoteの許容範囲か ==');
for (const a of articles) {
  const p = Number(a.meta.price);
  if (p === 0) { ok(`${a.file}: 無料`); continue; }
  if (p < 100 || p > 50000) { bad(`${a.file}: ${p}円 — noteの有料記事は100〜50,000円`); continue; }
  if (p % 100 !== 0) { bad(`${a.file}: ${p}円 — 100円単位にする`); continue; }
  ok(`${a.file}: ${p}円`);
}

// ── 4. 有料ライン ──────────────────────────────────────────
console.log('== 4. 有料ラインの個数 ==');
for (const a of articles) {
  const n = a.body.split(PAYWALL_MARK).length - 1;
  const want = Number(a.meta.price) > 0 ? 1 : 0;
  if (n === want) ok(`${a.file}: 有料ライン ${n}箇所（期待どおり）`);
  else bad(`${a.file}: 有料ライン ${n}箇所（期待 ${want}）。noteの有料ラインは記事に1本しか引けない`);
}

// ── 5〜6. 分量 ─────────────────────────────────────────────
console.log('== 5. 分量（無料部分・全体） ==');
const MIN_FREE = 800, MIN_TOTAL = 3000;
for (const a of articles) {
  const { free, paid } = splitPaywall(a.body);
  const cf = countChars(free), cp = countChars(paid), ct = cf + cp;
  if (cf < MIN_FREE) bad(`${a.file}: 無料部分 ${cf}字 < ${MIN_FREE}字。何が書いてあるか伝わらないと売れないし、返金申請の対象になる`);
  else if (ct < MIN_TOTAL) bad(`${a.file}: 全体 ${ct}字 < ${MIN_TOTAL}字。分量が足りない`);
  else ok(`${a.file}: 無料 ${cf}字 / 有料 ${cp}字 / 合計 ${ct}字`);
}

console.log('== 6. 有料部分に見合う中身があるか ==');
for (const a of articles.filter(a => Number(a.meta.price) > 0)) {
  const { free, paid } = splitPaywall(a.body);
  const cf = countChars(free), cp = countChars(paid);
  if (cp < cf * 0.8) bad(`${a.file}: 有料部分 ${cp}字 が無料部分 ${cf}字 に対して薄い（0.8倍未満）。金を取る側が短い記事は評価を落とす`);
  else ok(`${a.file}: 有料部分が無料部分の ${(cp / cf).toFixed(1)}倍`);
}

// ── 7. 誇大表現 ────────────────────────────────────────────
console.log('== 7. 誇大表現・虚偽の収益実績 ==');
{
  // 「情報商材」的な言い回し。実績の有無に関わらず、この語彙は使わない方針（docs/note-monetization.md）
  const BANNED = [
    /不労所得/, /誰でも(?:簡単に)?(?:稼|儲)/, /必ず(?:稼|儲|売れ)/, /絶対に(?:稼|儲|売れ)/,
    /月収?\s*\d+\s*万円?\s*(?:確定|保証|達成できます)/, /コピペ(?:する)?だけで/,
    /(?:完全)?放置で\s*(?:稼|儲)/, /権利収入/, /再現性\s*100\s*%/,
  ];
  for (const a of articles) {
    const hits = BANNED.filter(re => re.test(a.body)).map(re => String(re));
    if (hits.length) bad(`${a.file}: 誇大表現 — ${hits.join(' / ')}`);
    else ok(`${a.file}: 誇大表現なし`);
  }
}

// ── 8. 機微情報 ────────────────────────────────────────────
console.log('== 8. 機微情報の混入 ==');
{
  const SECRETS = [
    [/sk-[A-Za-z0-9_-]{16,}/, 'APIキー風の文字列'],
    [/(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/, 'GitHubトークン'],
    [/https:\/\/hooks\.slack\.com\/services\/\S+/, 'Slack Webhook URL'],
    [/AKIA[0-9A-Z]{16}/, 'AWSアクセスキー'],
    [/[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'メールアドレス'],
    [/(?:API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*["']?[A-Za-z0-9_\-]{12,}/, '環境変数への実値代入'],
  ];
  for (const a of articles) {
    const hits = SECRETS.filter(([re]) => re.test(a.body)).map(([, label]) => label);
    if (hits.length) bad(`${a.file}: 機微情報の疑い — ${hits.join(' / ')}`);
    else ok(`${a.file}: 機微情報なし`);
  }
}

// ── 9. 事実の焼き付き ──────────────────────────────────────
console.log('== 9. 数字が実データと一致するか ==');
{
  // 記事に書いた「19体」「37本」は、リポジトリが育つと黙って嘘になる。
  // ただし「品質ゲート3体」のような別文脈の数字まで拾うと誤検知が出て、
  // 誤検知が出る検査は必ず無視されるようになる。そこで2段構えにする:
  //   ・<!--fact:キー--> を数字の直後に置いた箇所 … 厳格に突き合わせる（✗）
  //   ・マーカー無しで実データと違う数字 …………… 警告のみ（△）
  // export時にHTMLコメントは剥がされるので、マーカーは読者には見えない。
  const fs2 = require('node:fs');
  const { GAMES } = require(path.join(ROOT, 'assets', 'js', 'agent-data.js'));
  const FACTS = {
    games:     { value: GAMES.length, unit: '本', label: 'ゲーム本数' },
    agents:    { value: fs2.readdirSync(path.join(ROOT, '.claude', 'agents')).filter(f => f.endsWith('.md')).length, unit: '体', label: 'エージェント数' },
    verifiers: { value: fs2.readdirSync(path.join(ROOT, 'scripts')).filter(f => /^verify-.*\.mjs$/.test(f)).length, unit: '本', label: '検査スクリプト数' },
    adrs:      { value: fs2.readdirSync(path.join(ROOT, 'obsidian-vault', '03-Decisions')).filter(f => f.endsWith('.md')).length, unit: '本', label: 'ADR数' },
  };
  const LOOSE = [
    [/ゲーム(?:を|は)\s*(\d+)\s*本/g, 'games'],
    [/エージェント(?:を|は|が)?\s*(\d+)\s*体/g, 'agents'],
    [/検査(?:スクリプト)?(?:を|が|は)?\s*(\d+)\s*本/g, 'verifiers'],
  ];
  for (const a of articles) {
    // 公開済みの記事はnote側で数字が凍結されており、リポジトリが育っても直せない。
    // ここでFAILさせ続けると「常に赤い検査」になり、必ず無視されるようになる。
    // 検査が効くのは"まだ貼っていない"あいだだけなので、そこへ絞る。
    if (a.meta.status === 'published') { ok(`${a.file}: 公開済み（note側で凍結。突き合わせ対象外）`); continue; }
    const errs = [], warns = [];
    // 厳格: 数字 + <!--fact:キー-->
    for (const m of a.body.matchAll(/(\d+)\s*([本体件])?\s*<!--\s*fact:([a-z]+)\s*-->/g)) {
      const f = FACTS[m[3]];
      if (!f) { errs.push(`未知の fact キー: ${m[3]}（${Object.keys(FACTS).join('/')}）`); continue; }
      if (Number(m[1]) !== f.value) errs.push(`${f.label}: 記事「${m[1]}」≠ 実データ「${f.value}」`);
    }
    // 緩やか: マーカー無しの数字
    for (const [re, key] of LOOSE) {
      for (const m of a.body.matchAll(re)) {
        if (a.body.slice(m.index, m.index + m[0].length + 24).includes('<!--')) continue;  // マーカー付きは厳格側で見た
        if (Number(m[1]) !== FACTS[key].value) warns.push(`${FACTS[key].label}らしき「${m[1]}${FACTS[key].unit}」が実データ「${FACTS[key].value}」と違う`);
      }
    }
    if (errs.length) bad(`${a.file}: ${errs.join(' / ')}`);
    else if (warns.length) warn(`${a.file}: ${warns.join(' / ')}（別文脈の数字なら無視してよい。総数なら <!--fact:キー--> を付ける）`);
    else ok(`${a.file}: 数字の食い違いなし`);
  }
}

// ── 10. status の整合 ──────────────────────────────────────
console.log('== 10. status と publish-log.json / topics.json の整合 ==');
{
  const log = JSON.parse(readFileSync(path.join(ROOT, 'note', 'publish-log.json'), 'utf8'));
  const topics = JSON.parse(readFileSync(path.join(ROOT, 'note', 'topics.json'), 'utf8'));
  const logged = new Set(log.posts.map(p => p.slug));
  const topicIds = new Map(topics.topics.map(t => [t.id, t]));

  for (const a of articles) {
    const t = topicIds.get(a.meta.topic_id);
    if (!t) { bad(`${a.file}: topic_id ${a.meta.topic_id} が topics.json に無い`); continue; }
    if (t.status === 'backlog') { bad(`${a.file}: 記事があるのに topics.json 側が backlog のまま（written へ更新する）`); continue; }
    if (a.meta.status === 'published') {
      if (!a.meta.note_url) { bad(`${a.file}: status=published なのに note_url が無い`); continue; }
      if (!logged.has(a.meta.slug)) { bad(`${a.file}: status=published なのに publish-log.json に記録が無い`); continue; }
      if (t.status !== 'published') { bad(`${a.file}: 公開済みなのに topics.json 側が ${t.status}`); continue; }
    } else if (a.meta.note_url) {
      bad(`${a.file}: note_url があるのに status=${a.meta.status}（published へ更新する）`); continue;
    }
    ok(`${a.file}: status=${a.meta.status} の整合OK`);
  }
  for (const p of log.posts) {
    if (!articles.some(a => a.meta.slug === p.slug)) bad(`publish-log.json: ${p.slug} に対応する記事mdが無い`);
  }
}

// ── 11. リポジトリ内ファイルへの参照 ───────────────────────
console.log('== 11. 記事が指すリポジトリ内ファイルが実在するか ==');
{
  // 記事で `scripts/foo.mjs` のように紹介したファイルが消えていると、読者が辿れず信用を落とす
  const re = /`((?:scripts|assets|gamekit|\.claude|obsidian-vault|note|docs)\/[A-Za-z0-9_\-./*]+)`/g;
  for (const a of articles) {
    const missing = [];
    for (const m of a.body.matchAll(re)) {
      const p = m[1];
      if (p.includes('*')) continue;                       // グロブは検査しない
      if (!existsSync(path.join(ROOT, p))) missing.push(p);
    }
    if (missing.length) bad(`${a.file}: 実在しないパスを紹介している — ${[...new Set(missing)].join(', ')}`);
    else ok(`${a.file}: 紹介したパスはすべて実在`);
  }
}

// ── 12. 投稿ペース ─────────────────────────────────────────
console.log('== 12. 投稿ペースの上限（週1本） ==');
{
  const dated = articles.filter(a => a.meta.published_at).map(a => ({ slug: a.meta.slug, d: new Date(a.meta.published_at) }));
  const badPairs = [];
  for (let i = 0; i < dated.length; i++) for (let j = i + 1; j < dated.length; j++) {
    const diff = Math.abs(dated[i].d - dated[j].d) / 86400000;
    if (diff < 5) badPairs.push(`${dated[i].slug} と ${dated[j].slug}（${diff.toFixed(1)}日差）`);
  }
  if (badPairs.length) bad(`公開間隔が5日未満 — ${badPairs.join(' / ')}。noteはスパム的な大量投稿を規約で禁じている`);
  else ok(dated.length ? `公開済み ${dated.length}本、間隔OK` : '公開済みの記事はまだ無い');

  const ready = articles.filter(a => a.meta.status === 'ready' || a.meta.status === 'draft');
  if (ready.length > 8) warn(`未投稿が ${ready.length}本たまっている。予約投稿へ積む（node scripts/note-export.mjs）`);
}

console.log('');
console.log(fail ? '==> verify-note-articles: 問題あり ❌' : '==> verify-note-articles: 問題なし ✅');
process.exit(fail);
