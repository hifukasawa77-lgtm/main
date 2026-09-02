#!/usr/bin/env node
/*
 * note-export.mjs — note/articles/*.md を「noteへ貼れる形」に変換する。
 *
 * noteには公式の投稿APIが無い（docs/note-monetization.md に判断の記録）。
 * そのため最後の貼り付けは人が行う。このスクリプトはその作業を
 * 「コピー→貼る→有料ライン置く→予約投稿」の機械的な手順まで落とす。
 *
 *   - frontmatter を剥がし、有料ライン（<!-- 有料ライン -->）で本文を2つに割る
 *   - 相対リンクを本番URL（GitHub Pages）へ絶対化する
 *   - 無料部分/有料部分それぞれの文字数を出す（無料部分が薄いと返金申請の対象になる）
 *   - 貼り付け手順・価格・ハッシュタグ・予約投稿日時の候補を添える
 *
 * 使い方:
 *   node scripts/note-export.mjs                    # ready な記事を全部 note/export/ へ書き出す
 *   node scripts/note-export.mjs <slug>             # 1本だけ
 *   node scripts/note-export.mjs <slug> --stdout    # 標準出力へ（そのままコピーできる）
 * 終了コード: 成功=0 / 対象なし・失敗=1
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES = path.join(ROOT, 'note', 'articles');
const OUTDIR = path.join(ROOT, 'note', 'export');
const SITE = 'https://hifukasawa77-lgtm.github.io/main';
export const PAYWALL_MARK = '<!-- 有料ライン -->';

/** frontmatter（--- で挟まれたYAML風ブロック）を切り離す。依存を増やさないため最小限の自前パーサ。 */
export function parseFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v === '' || v === 'null' || v === '~') { meta[kv[1]] = null; continue; }
    if (/^\[.*\]$/.test(v)) {
      meta[kv[1]] = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      continue;
    }
    if (/^(true|false)$/.test(v)) { meta[kv[1]] = v === 'true'; continue; }
    if (/^-?\d+$/.test(v)) { meta[kv[1]] = Number(v); continue; }
    meta[kv[1]] = v.replace(/^["']|["']$/g, '');
  }
  return { meta, body: raw.slice(m[0].length) };
}

/** 相対リンク・相対画像パスを本番URLへ絶対化する（noteに貼ると相対リンクは全て壊れるため）。 */
export function absolutizeLinks(body) {
  return body.replace(/(\]\()(?!https?:|mailto:|#)([^)\s]+)(\))/g, (_, a, url, c) => `${a}${SITE}/${url.replace(/^\.?\//, '')}${c}`);
}

/** 本文を有料ラインで割る。マーカーが無ければ全文が無料部分。 */
export function splitPaywall(body) {
  const i = body.indexOf(PAYWALL_MARK);
  if (i < 0) return { free: body.trim(), paid: '' };
  return { free: body.slice(0, i).trim(), paid: body.slice(i + PAYWALL_MARK.length).trim() };
}

/** 表示文字数。空白・改行・Markdown記号を除いた実質の分量を数える（noteの「文字数」に近づける）。 */
export function countChars(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')      // コードブロックは本文の分量に数えない
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_|-]/g, '')
    .replace(/\s/g, '')
    .length;
}

export function loadArticles() {
  if (!existsSync(ARTICLES)) return [];
  return readdirSync(ARTICLES).filter(f => f.endsWith('.md')).sort().map(f => {
    const raw = readFileSync(path.join(ARTICLES, f), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    return { file: f, path: path.join(ARTICLES, f), meta, body, raw };
  });
}

/** 次の水曜21:00 JST（n本目）を予約投稿日時の候補として返す。noteで最も読まれる帯に寄せてある。 */
function suggestSchedule(n) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);                       // 21:00 JST = 12:00 UTC
  const wed = (3 - d.getUTCDay() + 7) % 7 || 7;     // 次の水曜（今日が水曜なら来週）
  d.setUTCDate(d.getUTCDate() + wed + n * 7);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')} 21:00 JST`;
}

/** 貼り付け前に、読者に見せない注記（<!--fact:...--> 等のHTMLコメント）を剥がす。有料ラインは別扱いなので先に割ること。 */
export function stripComments(text) {
  return text.replace(/<!--(?!\s*有料ライン\s*-->)[\s\S]*?-->/g, '').replace(/[ \t]+$/gm, '');
}

export function renderExport(a, idx) {
  const body = absolutizeLinks(a.body);
  const s = splitPaywall(body);
  const free = stripComments(s.free), paid = stripComments(s.paid);
  const paidArticle = Number(a.meta.price) > 0;
  const L = [];
  L.push('='.repeat(72));
  L.push(`タイトル: ${a.meta.title}`);
  L.push(`種別    : ${paidArticle ? `有料 ${a.meta.price}円` : '無料'}`);
  L.push(`ハッシュタグ: ${(a.meta.hashtags || []).map(h => '#' + h).join(' ')}`);
  L.push(`予約投稿の候補: ${suggestSchedule(idx)}`);
  L.push(`分量    : 無料部分 ${countChars(free)}字 / 有料部分 ${countChars(paid)}字`);
  L.push('='.repeat(72));
  L.push('');
  L.push('【手順】');
  L.push('  1. noteで「テキスト」の新規作成を開き、上のタイトルを入れる');
  L.push('  2. 下の《無料部分》を本文へ貼る');
  if (paidArticle) {
    L.push('  3. 続けて《有料部分》を貼る');
    L.push('  4. 無料部分と有料部分の境目の行にカーソルを置き、「ここから先は有料」を挿入する');
    L.push(`  5. 公開設定 → 価格 ${a.meta.price}円 → 予約投稿に上の日時を入れる`);
  } else {
    L.push('  3. 公開設定 → 無料 → 予約投稿に上の日時を入れる');
  }
  L.push('  ※ 公開後、記事のURLを note/publish-log.json と記事mdのfrontmatterへ書き戻す');
  L.push('');
  L.push('-'.repeat(30) + ' 《無料部分》ここから ' + '-'.repeat(30));
  L.push(free);
  L.push('-'.repeat(30) + ' 《無料部分》ここまで ' + '-'.repeat(30));
  if (paidArticle) {
    L.push('');
    L.push('#'.repeat(24) + ' ↑↑↑ ここに「ここから先は有料」を置く ↑↑↑ ' + '#'.repeat(24));
    L.push('');
    L.push('-'.repeat(30) + ' 《有料部分》ここから ' + '-'.repeat(30));
    L.push(paid);
    L.push('-'.repeat(30) + ' 《有料部分》ここまで ' + '-'.repeat(30));
  }
  return L.join('\n');
}

// ── CLI ────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const toStdout = args.includes('--stdout');
  const slug = args.find(a => !a.startsWith('--'));

  let list = loadArticles().filter(a => a.meta.status === 'ready' || a.meta.status === 'written');
  if (slug) list = loadArticles().filter(a => a.meta.slug === slug);

  if (list.length === 0) {
    console.error(slug ? `対象の記事が見つからない: ${slug}` : '書き出す記事がない（frontmatter の status が ready / written のものが対象）');
    process.exit(1);
  }

  if (toStdout) {
    console.log(list.map((a, i) => renderExport(a, i)).join('\n\n'));
  } else {
    mkdirSync(OUTDIR, { recursive: true });
    for (const [i, a] of list.entries()) {
      const out = path.join(OUTDIR, `${a.meta.slug}.txt`);
      writeFileSync(out, renderExport(a, i) + '\n', 'utf8');
      console.log(`  → ${path.relative(ROOT, out)}  (${a.meta.price > 0 ? a.meta.price + '円' : '無料'})`);
    }
    console.log('');
    console.log(`${list.length}本を note/export/ へ書き出した。noteの編集画面に貼って予約投稿を積む。`);
  }
}
