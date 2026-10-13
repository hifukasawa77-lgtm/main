#!/usr/bin/env node
/*
 * legal-corpus.mjs — 法令コーパス（legal/corpus/）の取得と状態確認。
 *
 * 出典: デジタル庁 e-Gov 法令API Version 2（https://laws.e-gov.go.jp/api/2）。
 *   キー不要・無料・課金なし。法令の条文は著作権の対象外（著作権法13条）なので再配布できる。
 *
 * なぜ「覚えている条文」でなく「取得した条文」を正にするか:
 *   記憶の条文番号は黙って古くなる/取り違える（例外もエラーも出ない）。
 *   実際、このリポジトリのコーパスを取った2026-10-13時点で、民法・刑法・商法・民訴法・刑訴法・著作権法は
 *   いずれも直近数か月に改正が入っていた。引用は必ず取得した実物に当てる。
 *
 * 取り込む版の選び方:
 *   今日までに施行済みの改正のうち最新のもの。未施行の改正（施行予定）はテキストを取らず、
 *   MANIFEST の upcoming に「いつ・どの改正法」だけ残す（法務は施行日で効力が切り替わる）。
 *
 * 使い方:
 *   node scripts/legal-corpus.mjs --fetch [--only kenpo,minpo]   取得して legal/corpus/ へ書く
 *   node scripts/legal-corpus.mjs --status                       取得済みの版・条数・施行予定を一覧
 *   node scripts/legal-corpus.mjs --check-online                 e-Gov の最新と突き合わせ（古ければ △）
 * 終了コード: 取得失敗・コーパス欠落=1 ／ 古い=0（△のみ）
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { LAWS, CORPUS_DIR, MANIFEST_PATH, loadManifest, displayArticleNum } from './legal-lib.mjs';

const API = 'https://laws.e-gov.go.jp/api/2';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** 日本時間の今日（YYYY-MM-DD）。施行日との比較に使う。 */
function todayJst() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}

async function getJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(90_000) });   // 既定では時間切れが無い
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      return await r.json();
    } catch (e) { last = e; await sleep(800 * (i + 1)); }
  }
  throw last;
}

// ── e-Gov の木構造 → 平らな条文 ─────────────────────────
const kids = (n) => (n && n.children) || [];
const find = (n, tag) => kids(n).find(c => typeof c !== 'string' && c.tag === tag);
const findAll = (n, tag) => kids(n).filter(c => typeof c !== 'string' && c.tag === tag);

/** 子孫の文字を連結。ふりがな（Rt）は本文でないので落とす。 */
function text(n) {
  if (typeof n === 'string') return n;
  if (!n || n.tag === 'Rt') return '';
  return kids(n).map(text).join('');
}

function tableText(ts) {
  const rows = [];
  const walk = (n) => {
    if (typeof n === 'string') return;
    if (n.tag === 'TableRow') rows.push(findAll(n, 'TableColumn').map(c => text(c).trim()).join(' │ '));
    else kids(n).forEach(walk);
  };
  walk(ts);
  return rows.join('\n');
}

/** 号・イ・(1)… を字下げしながら行にする。 */
function renderItems(node, depth, out) {
  for (const c of kids(node)) {
    if (typeof c === 'string') continue;
    const m = /^(Item|Subitem(\d+))$/.exec(c.tag);
    if (!m) continue;
    const title = text(find(c, `${c.tag}Title`) || '');
    const sent = text(find(c, `${c.tag}Sentence`) || '');
    out.push('　'.repeat(depth) + [title, sent].filter(Boolean).join('　'));
    renderItems(c, depth + 1, out);
  }
}

function renderParagraph(p) {
  const num = text(find(p, 'ParagraphNum') || '').trim();
  const cap = text(find(p, 'ParagraphCaption') || '').trim();
  const sent = text(find(p, 'ParagraphSentence') || '').trim();
  const lines = [];
  lines.push([num, sent].filter(Boolean).join('　') + (cap && !sent ? cap : ''));
  for (const ts of findAll(p, 'TableStruct')) lines.push(tableText(ts));
  renderItems(p, 1, lines);
  return lines.filter(Boolean).join('\n');
}

function flatten(law) {
  const body = find(law.law_full_text, 'LawBody');
  const main = find(body, 'MainProvision');
  const sections = [];
  const articles = [];
  const secIdx = new Map();
  const SEC = new Set(['Part', 'Chapter', 'Section', 'Subsection', 'Division']);

  const walk = (n, trail) => {
    for (const c of kids(n)) {
      if (typeof c === 'string') continue;
      if (SEC.has(c.tag)) {
        const title = text(find(c, `${c.tag}Title`) || '').trim();
        walk(c, title ? [...trail, title] : trail);
      } else if (c.tag === 'Article') {
        const key = trail.join(' ');
        if (!secIdx.has(key)) { secIdx.set(key, sections.length); sections.push(key); }
        const paras = findAll(c, 'Paragraph').map(renderParagraph);
        articles.push({
          n: c.attr?.Num ?? '',
          t: text(find(c, 'ArticleCaption') || '').replace(/^（|）$/g, '').trim(),
          s: secIdx.get(key),
          p: paras.length ? paras : [text(c).trim()],
        });
      } else walk(c, trail);
    }
  };
  walk(main, []);
  return { sections, articles };
}

/** 今日までに施行済みの最新版と、これから施行される改正の一覧を決める。 */
function pickRevisions(revs, today) {
  const enforced = revs.filter(r => r.amendment_enforcement_date && r.amendment_enforcement_date <= today);
  enforced.sort((a, b) => b.amendment_enforcement_date.localeCompare(a.amendment_enforcement_date));
  const upcoming = revs
    .filter(r => r.amendment_enforcement_date && r.amendment_enforcement_date > today)
    .sort((a, b) => a.amendment_enforcement_date.localeCompare(b.amendment_enforcement_date))
    .map(r => ({ date: r.amendment_enforcement_date, revision_id: r.law_revision_id, title: r.amendment_law_title, law_num: r.amendment_law_num }));
  return { current: enforced[0] || null, upcoming };
}

/** 版IDを指定して条文を平らにして返す（取得・差分の両方で使う）。 */
async function fetchRevision(entry, revisionId) {
  const law = await getJson(`${API}/law_data/${revisionId}?law_full_text_format=json`);
  const { sections, articles } = flatten(law);
  if (!articles.length) throw new Error(`${entry.title}: 条文が1つも取れなかった（API応答の構造が変わった可能性）`);
  return { law, sections, articles };
}

async function fetchOne(entry, today) {
  const { revisions } = await getJson(`${API}/law_revisions/${entry.id}`);
  const { current, upcoming } = pickRevisions(revisions, today);
  if (!current) throw new Error(`${entry.title}: 施行済みの版が見つからない`);
  const { law, sections, articles } = await fetchRevision(entry, current.law_revision_id);

  const header = {
    v: 1, slug: entry.slug, id: entry.id, title: entry.title,
    num: law.law_info.law_num, rev: current.law_revision_id,
    enf: current.amendment_enforcement_date, amended_by: current.amendment_law_title || '',
    sections,
  };
  const head = JSON.stringify(header).slice(0, -1);               // 末尾の } を外して articles を足す
  const out = `${head},"articles":[\n${articles.map(a => JSON.stringify(a)).join(',\n')}\n]}\n`;
  const file = path.join(CORPUS_DIR, `${entry.slug}.json`);
  writeFileSync(file, out);
  return {
    slug: entry.slug, title: entry.title, group: entry.group, law_id: entry.id,
    law_num: law.law_info.law_num, revision_id: current.law_revision_id,
    enforcement_date: current.amendment_enforcement_date, amended_by: current.amendment_law_title || '',
    articles: articles.length, chars: articles.reduce((s, a) => s + a.p.join('').length, 0),
    bytes: Buffer.byteLength(out), sha256: createHash('sha256').update(out).digest('hex'),
    upcoming: upcoming.slice(0, 8),
  };
}

async function doFetch(only) {
  mkdirSync(CORPUS_DIR, { recursive: true });
  const today = todayJst();
  const prev = loadManifest();
  const byslug = new Map((prev?.laws || []).map(l => [l.slug, l]));
  const targets = LAWS.filter(l => !only || only.includes(l.slug));
  let fail = 0;
  for (const e of targets) {
    try {
      const r = await fetchOne(e, today);
      byslug.set(e.slug, r);
      console.log(`  ✓ ${e.title}  ${r.articles}条 ${(r.bytes / 1024).toFixed(0)}KB  版 ${r.enforcement_date}${r.upcoming.length ? `  施行予定の改正 ${r.upcoming.length}件` : ''}`);
    } catch (err) { fail = 1; console.log(`  ✗ ${e.title}: ${err.message}`); }
    await sleep(300);                                              // 公共APIへ礼儀として間隔を空ける
  }
  const laws = LAWS.map(l => byslug.get(l.slug)).filter(Boolean);
  writeFileSync(MANIFEST_PATH, JSON.stringify({
    source: 'デジタル庁 e-Gov 法令API Version 2 (https://laws.e-gov.go.jp/api/2)',
    note: '法令の条文は著作権の対象外（著作権法13条）。本ファイル群は取得物で、手で直さない（--fetch で再生成）。',
    fetched_at: new Date().toISOString(), as_of: today, laws,
  }, null, 2) + '\n');
  console.log(`\n${laws.length}/${LAWS.length} 法令 / 計 ${laws.reduce((s, l) => s + l.articles, 0)} 条 / ${(laws.reduce((s, l) => s + l.bytes, 0) / 1048576).toFixed(1)}MB`);
  return fail;
}

function doStatus() {
  const m = loadManifest();
  if (!m) { console.log('  ✗ MANIFEST.json が無い。node scripts/legal-corpus.mjs --fetch'); return 1; }
  console.log(`取得: ${m.fetched_at}（基準日 ${m.as_of}）\n`);
  for (const l of m.laws) {
    console.log(`${l.title}  [${l.group}]  ${l.articles}条  版${l.enforcement_date}  ${l.amended_by || '（制定時）'}`);
    for (const u of l.upcoming) console.log(`    ⏩ ${u.date} 施行予定: ${u.title}`);
  }
  return 0;
}

async function doCheckOnline() {
  const m = loadManifest();
  if (!m) { console.log('  ✗ MANIFEST.json が無い'); return 1; }
  const today = todayJst();
  let stale = 0;
  for (const l of m.laws) {
    try {
      const { revisions } = await getJson(`${API}/law_revisions/${l.law_id}`);
      const { current } = pickRevisions(revisions, today);
      if (current && current.law_revision_id !== l.revision_id) {
        stale++;
        console.log(`  △ ${l.title}: 取得済み ${l.enforcement_date} → 現行 ${current.amendment_enforcement_date}（${current.amendment_law_title}）。--fetch --only ${l.slug}`);
      } else console.log(`  ✓ ${l.title}: 最新`);
    } catch (e) { console.log(`  △ ${l.title}: 確認できず（${e.message}）`); }
    await sleep(200);
  }
  console.log(stale ? `\n${stale}件が古い（改正が施行された）。知識ベースの引用を再検査すること: node scripts/verify-legal-knowledge.mjs` : '\n全件最新');
  return 0;
}

// ── 改正ダイジェスト（直近の改正／施行予定の改正で、どの条文が変わるか）──────────────
const artText = (a) => `${a.t}\n${a.p.join('\n')}`;
function diffArticles(oldArts, newArts) {
  const o = new Map(oldArts.map(a => [a.n, a])), n = new Map(newArts.map(a => [a.n, a]));
  const added = [], removed = [], changed = [];
  for (const [k, a] of n) { if (!o.has(k)) added.push(k); else if (artText(o.get(k)) !== artText(a)) changed.push(k); }
  for (const k of o.keys()) if (!n.has(k)) removed.push(k);
  return { added, removed, changed };
}

/** 施行済みの版を新しい順に、未施行の版を古い順に並べる。 */
function ordered(revs, today) {
  const enforced = revs.filter(r => r.amendment_enforcement_date && r.amendment_enforcement_date <= today)
    .sort((a, b) => b.amendment_enforcement_date.localeCompare(a.amendment_enforcement_date));
  const upcoming = revs.filter(r => r.amendment_enforcement_date && r.amendment_enforcement_date > today)
    .sort((a, b) => a.amendment_enforcement_date.localeCompare(b.amendment_enforcement_date));
  return { enforced, upcoming };
}

const short = (arr, max = 30) => arr.length <= max ? arr.join(',') : `${arr.slice(0, max).join(',')} ほか${arr.length - max}条`;

async function doAmendments() {
  const today = todayJst();
  const lines = [
    '# 改正ダイジェスト（自動生成・手で直さない）', '',
    `基準日 ${today}。\`node scripts/legal-corpus.mjs --amendments\` で再生成。条文の中身は \`--diff <slug> [--rev 版ID]\` で見る。`,
    '「直前の版」との比較なので、1つの改正が触った条文だけが出る。**施行日で効力が切り替わる**ので、引用する条文が',
    '施行予定の改正の対象になっていないかを必ず見ること（verify-legal-knowledge.mjs が知識ベースの引用と突き合わせる）。', '',
  ];
  const json = { as_of: today, laws: {} };
  for (const e of LAWS) {
    try {
      const { revisions } = await getJson(`${API}/law_revisions/${e.id}`);
      const { enforced, upcoming } = ordered(revisions, today);
      const cur = enforced[0];
      const entry = { current: null, upcoming: [] };
      lines.push(`## ${e.title}（${e.slug}）`);
      if (!cur) { lines.push('- 施行済みの版なし', ''); continue; }
      let curArts = JSON.parse(readFileSync(path.join(CORPUS_DIR, `${e.slug}.json`), 'utf8')).articles;
      const prev = enforced[1];
      if (prev) {
        const p = await fetchRevision(e, prev.law_revision_id);
        const d = diffArticles(p.articles, curArts);
        entry.current = { date: cur.amendment_enforcement_date, by: cur.amendment_law_title, ...d };
        lines.push(`- **現行** ${cur.amendment_enforcement_date} 施行（${cur.amendment_law_title}／${cur.amendment_law_num || ''}）`
          + ` — 新設 ${d.added.length} 改正 ${d.changed.length} 削除 ${d.removed.length}`);
        if (d.added.length) lines.push(`  - 新設: ${short(d.added)}`);
        if (d.changed.length) lines.push(`  - 改正: ${short(d.changed)}`);
        if (d.removed.length) lines.push(`  - 削除: ${short(d.removed)}`);
      } else lines.push(`- **現行** ${cur.amendment_enforcement_date} 施行（${cur.amendment_law_title || '制定時'}）`);
      let base = curArts;
      for (const u of upcoming.slice(0, 8)) {
        const r = await fetchRevision(e, u.law_revision_id);
        const d = diffArticles(base, r.articles);
        entry.upcoming.push({ date: u.amendment_enforcement_date, by: u.amendment_law_title, rev: u.law_revision_id, ...d });
        lines.push(`- ⏩ **${u.amendment_enforcement_date} 施行予定**（${u.amendment_law_title}／${u.amendment_law_num || ''}）`
          + ` — 新設 ${d.added.length} 改正 ${d.changed.length} 削除 ${d.removed.length}`);
        if (d.added.length) lines.push(`  - 新設: ${short(d.added)}`);
        if (d.changed.length) lines.push(`  - 改正: ${short(d.changed)}`);
        if (d.removed.length) lines.push(`  - 削除: ${short(d.removed)}`);
        base = r.articles;
        await sleep(200);
      }
      json.laws[e.slug] = entry;
      lines.push('');
      console.log(`  ✓ ${e.title}`);
    } catch (err) { console.log(`  ✗ ${e.title}: ${err.message}`); lines.push(`- 取得失敗: ${err.message}`, ''); }
    await sleep(200);
  }
  writeFileSync(path.join(CORPUS_DIR, 'AMENDMENTS.md'), lines.join('\n') + '\n');
  writeFileSync(path.join(CORPUS_DIR, 'AMENDMENTS.json'), JSON.stringify(json));
  console.log('\nlegal/corpus/AMENDMENTS.md / AMENDMENTS.json を書いた');
  return 0;
}

/** 1法令の「直前の版→指定版（既定は現行）」で、変わった条文の新旧を並べる。 */
async function doDiff(slug, revArg, showAll) {
  const e = LAWS.find(l => l.slug === slug);
  if (!e) { console.log(`slug が不明: ${slug}`); return 1; }
  const today = todayJst();
  const { revisions } = await getJson(`${API}/law_revisions/${e.id}`);
  const { enforced, upcoming } = ordered(revisions, today);
  const all = [...enforced.slice().reverse(), ...upcoming];          // 古い→新しい
  const targetId = revArg || enforced[0].law_revision_id;
  const idx = all.findIndex(r => r.law_revision_id === targetId);
  if (idx < 1) { console.log('比較できる直前の版が無い'); return 1; }
  const [a, b] = await Promise.all([fetchRevision(e, all[idx - 1].law_revision_id), fetchRevision(e, targetId)]);
  const d = diffArticles(a.articles, b.articles);
  const am = new Map(a.articles.map(x => [x.n, x])), bm = new Map(b.articles.map(x => [x.n, x]));
  console.log(`${e.title}: ${all[idx - 1].amendment_enforcement_date} → ${all[idx].amendment_enforcement_date}（${all[idx].amendment_law_title}）`);
  console.log(`新設 ${d.added.length} / 改正 ${d.changed.length} / 削除 ${d.removed.length}\n`);
  const cap = showAll ? Infinity : 12;
  let shown = 0;
  for (const k of [...d.changed, ...d.added, ...d.removed]) {
    if (shown++ >= cap) { console.log(`…（--all で全件）`); break; }
    const kind = d.added.includes(k) ? '新設' : d.removed.includes(k) ? '削除' : '改正';
    console.log(`── ${kind} ${displayArticleNum(k)}`);
    if (am.has(k)) console.log(`【前】${am.get(k).t ? `（${am.get(k).t}）` : ''}${am.get(k).p.join('\n')}`);
    if (bm.has(k)) console.log(`【後】${bm.get(k).t ? `（${bm.get(k).t}）` : ''}${bm.get(k).p.join('\n')}`);
    console.log('');
  }
  return 0;
}

const args = process.argv.slice(2);
const only =(() => { const i = args.indexOf('--only'); return i >= 0 ? args[i + 1].split(',') : null; })();
let code = 0;
if (args.includes('--fetch')) code = await doFetch(only);
else if (args.includes('--check-online')) code = await doCheckOnline();
else if (args.includes('--status')) code = doStatus();
else if (args.includes('--amendments')) code = await doAmendments();
else if (args.includes('--diff')) {
  const rev = (() => { const i = args.indexOf('--rev'); return i >= 0 ? args[i + 1] : null; })();
  code = await doDiff(args[args.indexOf('--diff') + 1], rev, args.includes('--all'));
}
else { console.log('使い方: --fetch [--only slug,...] | --status | --check-online | --amendments | --diff <slug> [--rev 版ID] [--all]'); code = 2; }
process.exit(code);
