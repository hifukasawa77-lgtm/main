#!/usr/bin/env node
// 公開ページの検索・共有用タグを検査し、足りないものを補う。
//
//   node scripts/seo-tags.mjs            # 検査（不足があれば exit 1）
//   node scripts/seo-tags.mjs --write    # 不足を補う（既存のタグは上書きしない）
//   node scripts/seo-tags.mjs --inject   # 正常なページを壊したコピーで ✗ が出ることを確かめる（故障注入）
//
// 対象 = トップページからリンクされているページ ∪ sitemap.xml のページ（noindex と EXCLUDE は除く）。
// 1ページごとに見るもの:
//   title にサイト名「hideの部屋」／meta description／canonical（＝サイトマップのURL）／
//   og:title・og:description・og:url・og:image・og:site_name／twitter:card／sitemap.xml に載っている
// サイト全体で見るもの（トップページ自身の title・OGP・canonical もここで検査する。実体の無いページ参照も報告する）:
//   トップの構造化データ（ItemList）にゲーム欄の全作品が載り、numberOfItems が実数と一致する
//
// なぜ検査にしたか（2026-10-16）:
//   2026-10-15 に公開92ページのタグを全部そろえたのに、その前後に公開された新作ゲーム8本が
//   サイトマップにも載らず、タグも一切ないまま出ていた。例外もエラーも出ないので誰も気づかない。
//   ItemList も「55作品中33件・件数の申告32」のままだった。方針は文書ではなく検査で守る。
//
// 日本語ディレクトリ（浮き沈みゲーム/）のパスに注意:
//   sitemap の loc は %E6%B5%AE… のURLエンコード、git は \346\265… の八進エスケープで出す。
//   必ず decodeURIComponent で戻してから照合する（戻さずに照合して、このページだけ毎回すり抜けていた）。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const require = createRequire(import.meta.url);
const BASE = 'https://hifukasawa77-lgtm.github.io/main/';
const BRAND = 'hideの部屋';
const DEFAULT_IMG = BASE + 'assets/og/og-default.jpg';
const WRITE = process.argv.includes('--write');
const INJECT = process.argv.includes('--inject');
const TODAY = new Date().toISOString().slice(0, 10);

// 検索の対象にしないページ（理由の書けない除外は足さない）
const EXCLUDE = {
  'dashboard.html': '個人用ダッシュボード（noindex）。検索から来る人の役に立たない',
};

const read = (f) => fs.readFileSync(f, 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const urlOf = (rel) => (rel === 'index.html' ? BASE : BASE + rel.split('/').map(encodeURIComponent).join('/'));
const strip = (s) => unesc(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// ── 説明文の材料: ゲーム一覧データ → トップのカード説明 ─────────
const { GAMES } = require(path.join(ROOT, 'assets/js/agent-data.js'));
const catalog = new Map();
for (const g of GAMES) if (g.href) catalog.set(decodeURIComponent(g.href), g);
const indexHtml = read('index.html');
const cardText = new Map();
const cardTitle = new Map();
for (const m of indexHtml.matchAll(/class="card (?:work|tool)-card[^"]*"/g)) {
  const blk = indexHtml.slice(Math.max(0, m.index - 400), m.index + 3000);
  const h = (blk.slice(400).match(/href="([^"#]+\.html)"/) || blk.match(/href="([^"#]+\.html)"/) || [])[1];
  const p = (blk.slice(400).match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1];
  if (h && p && !cardText.has(decodeURIComponent(h))) cardText.set(decodeURIComponent(h), strip(p));
  const t = (blk.slice(400).match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1];
  if (h && t && !cardTitle.has(decodeURIComponent(h))) cardTitle.set(decodeURIComponent(h), strip(t));
}

// ── 対象ページ ──────────────────────────────────────────────
const sitemap = read('sitemap.xml');
const inSitemap = new Set([...sitemap.matchAll(/<loc>https:\/\/hifukasawa77-lgtm\.github\.io\/main\/([^<]*)<\/loc>/g)]
  .map((m) => decodeURIComponent(m[1]) || 'index.html'));
const linked = new Set([...indexHtml.matchAll(/href="([^"#?:]+\.html)"/g)].map((m) => decodeURIComponent(m[1])));
const candidates = [...new Set([...inSitemap, ...linked, 'index.html'])].filter((f) => !EXCLUDE[f]);
// 実体が無いページは targets から外さず「欠落」として報告する（消す・改名するだけで両方の検査が緑のまま
// トップのリンク切れ・サイトマップの古いURLが公開される。例外もエラーも出ない）
const missingFiles = candidates.filter((f) => !fs.existsSync(f)).sort();
const targets = candidates
  .filter((f) => fs.existsSync(f))
  .filter((f) => !/<meta name="robots"[^>]*noindex/i.test(read(f)))
  .sort();

function describe(rel, title) {
  const base = title.replace(/｜hideの部屋$/, '');
  const g = catalog.get(rel);
  if (g?.desc?.ja) {
    const verb = g.cat === 'ai' || g.cat === 'tool' ? '使えます' : '遊べます';
    return `${base}：${g.desc.ja.replace(/。$/, '')}。ブラウザで無料・インストール不要で${verb}。`;
  }
  if (cardText.has(rel)) return `${base}：${cardText.get(rel).replace(/。$/, '')}。`;
  return null;
}

// ── 1ページの検査（とりかかる不足の一覧を返す） ─────────────────
function checkPage(rel, html) {
  const url = urlOf(rel);
  const has = (re) => re.test(html);
  const title = unesc((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim() || '');
  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  const ogUrl = (html.match(/property="og:url" content="([^"]+)"/) || [])[1];
  const site = (html.match(/property="og:site_name" content="([^"]+)"/) || [])[1];
  const issues = [];
  if (!title) issues.push('title が無い');
  else if (!title.includes(BRAND)) issues.push(`title にサイト名「${BRAND}」が無い`);
  if (!has(/<meta name="description" content="[^"]+"/)) issues.push('meta description が無い');
  if (!canon) issues.push('canonical が無い');
  else if (canon !== url) issues.push(`canonical がサイトのURLと違う（${canon}）`);
  for (const p of ['og:title', 'og:description', 'og:image', 'og:type']) if (!has(new RegExp(`property="${p}"`))) issues.push(`${p} が無い`);
  if (!ogUrl) issues.push('og:url が無い');
  else if (ogUrl !== url) issues.push(`og:url がサイトのURLと違う（${ogUrl}）`);
  if (site !== BRAND) issues.push(site ? `og:site_name が「${site}」` : 'og:site_name が無い');
  if (!has(/name="twitter:card"/)) issues.push('twitter:card が無い');
  if (!inSitemap.has(rel)) issues.push('sitemap.xml に無い');
  return issues;
}

// ── 1ページの補完 ───────────────────────────────────────────
function fillPage(rel, html) {
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  const url = urlOf(rel);
  let s = html;
  const tm = s.match(/<title>([\s\S]*?)<\/title>/);
  if (!tm) throw new Error(`${rel}: <title> が無いので補えない（手で直す）`);
  const oldTitle = unesc(tm[1].trim());
  let title = oldTitle;
  if (!title.includes(BRAND)) {
    title = `${oldTitle}｜${BRAND}`;
    s = s.replace(tm[0], `<title>${esc(title)}</title>`);
    for (const k of ['og:title', 'twitter:title']) {
      s = s.replace(new RegExp(`(<meta (?:property|name)="${k}" content=")${esc(oldTitle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(")`), `$1${esc(title)}$2`);
    }
  }
  const md = s.match(/<meta name="description" content="([^"]*)"/);
  let desc = md ? unesc(md[1]) : describe(rel, title);
  if (!desc) throw new Error(`${rel}: 説明文の材料が無い（agent-data.js の GAMES かトップのカード説明を足すか、meta description を手で書く）`);
  const slug = path.basename(rel, '.html');
  const img = ['.jpg', '.png'].map((e) => `assets/og/${slug}${e}`).find((p) => fs.existsSync(p));
  const imgUrl = img ? BASE + img : DEFAULT_IMG;
  const need = (re) => !re.test(s);
  const add = [];
  if (!md) add.push(`<meta name="description" content="${esc(desc)}">`);
  if (need(/rel="canonical"/)) add.push(`<link rel="canonical" href="${url}">`);
  if (need(/property="og:type"/)) add.push('<meta property="og:type" content="website">');
  if (need(/property="og:title"/)) add.push(`<meta property="og:title" content="${esc(title)}">`);
  if (need(/property="og:description"/)) add.push(`<meta property="og:description" content="${esc(desc)}">`);
  if (need(/property="og:url"/)) add.push(`<meta property="og:url" content="${url}">`);
  if (need(/property="og:site_name"/)) add.push(`<meta property="og:site_name" content="${BRAND}">`);
  // サイト名の旧表記（hide_0001 Portfolio 等）は直す。サイト名が割れると指名検索「hideの部屋」の手がかりが弱まる
  else s = s.replace(/(property="og:site_name" content=")[^"]*(")/, `$1${BRAND}$2`);
  if (need(/property="og:image"/)) {
    add.push(`<meta property="og:image" content="${imgUrl}">`);
    if (imgUrl === DEFAULT_IMG) add.push('<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">');
  }
  if (need(/name="twitter:card"/)) add.push('<meta name="twitter:card" content="summary_large_image">');
  if (need(/name="twitter:title"/)) add.push(`<meta name="twitter:title" content="${esc(title)}">`);
  if (need(/name="twitter:description"/)) add.push(`<meta name="twitter:description" content="${esc(desc)}">`);
  if (need(/name="twitter:image"/)) add.push(`<meta name="twitter:image" content="${imgUrl}">`);
  if (add.length) {
    const m = s.match(/^([ \t]*)<title>[\s\S]*?<\/title>[^\n]*\n/m);
    const ind = m ? m[1] : '  ';
    const at = m ? m.index + m[0].length : s.indexOf('</title>') + 8;
    s = s.slice(0, at) + add.map((a) => ind + a + nl).join('') + s.slice(at);
  }
  return s;
}

// ── トップの構造化データ（ItemList） ─────────────────────────────
function workCards(html) {
  const sec = html.slice(html.indexOf('<section id="works">'));
  const works = sec.slice(0, sec.indexOf('</section>'));
  const out = [];
  for (const m of works.matchAll(/class="card work-card[^"]*"/g)) {
    const h = (works.slice(Math.max(0, m.index - 400), m.index + 3000).match(/href="([^"#]+\.html)"/) || [])[1];
    if (h && !out.includes(decodeURIComponent(h))) out.push(decodeURIComponent(h));
  }
  return out;
}
function toolLinks(html) {
  const i = html.indexOf('<section id="tools"');
  if (i < 0) return [];
  const sec = html.slice(i);
  return [...new Set([...sec.slice(0, sec.indexOf('</section>')).matchAll(/href="([^"#]+\.html)"/g)].map((m) => decodeURIComponent(m[1])))];
}
function itemList(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  const data = JSON.parse(m[1]);
  return { m, data, list: data['@graph'].find((g) => g['@type'] === 'ItemList') };
}
function checkItemList(html) {
  const { list } = itemList(html);
  const listed = new Set(list.itemListElement.map((e) => decodeURIComponent((e.item?.url || '').replace(BASE, ''))));
  const shown = new Set([...workCards(html), ...toolLinks(html)]);
  const missing = workCards(html).filter((h) => !listed.has(h));
  const issues = missing.map((h) => `構造化データ（ItemList）に ${h} が無い`);
  // 画面に出ていない作品を申告すると、構造化データが「見えない内容」を主張することになる（FAQPage と同じ不整合）
  for (const u of listed) if (u && !shown.has(u)) issues.push(`ItemList の ${u} がトップのゲーム欄・ツール欄に出ていない（トップにカードを足すか、構造化データから外す）`);
  if (list.numberOfItems !== list.itemListElement.length) issues.push(`ItemList の numberOfItems（${list.numberOfItems}）が実数（${list.itemListElement.length}）と違う`);
  return issues;
}
function fillItemList(html) {
  const { m, data, list } = itemList(html);
  // 画面に出ていない作品の申告は外す（トップへ載せるかは掲載方針なので、自動では足さない）。ページ自体は残す
  const shown = new Set([...workCards(html), ...toolLinks(html)]);
  const dropped = list.itemListElement.filter((e) => !shown.has(decodeURIComponent((e.item?.url || '').replace(BASE, ''))));
  for (const e of dropped) console.log(`－ ItemList から外す（トップに出ていない）: ${e.item?.url}`);
  list.itemListElement = list.itemListElement.filter((e) => !dropped.includes(e));
  list.itemListElement.forEach((e, i) => { e.position = i + 1; });
  const listed = new Set(list.itemListElement.map((e) => decodeURIComponent((e.item?.url || '').replace(BASE, ''))));
  for (const h of workCards(html).filter((x) => !listed.has(x))) {
    const g = catalog.get(h);
    const name = g?.title?.ja || cardTitle.get(h);
    const description = g?.desc?.ja || cardText.get(h);
    if (!name || !description) throw new Error(`ItemList: ${h} の名前・説明の材料が無い（agent-data.js の GAMES に足す）`);
    list.itemListElement.push({ '@type': 'ListItem', position: list.itemListElement.length + 1, item: {
      '@type': 'SoftwareApplication', name, applicationCategory: 'GameApplication', operatingSystem: 'Web Browser',
      url: urlOf(h), description, offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' } } });
  }
  list.numberOfItems = list.itemListElement.length;
  list.url = BASE + '#works';
  return html.replace(m[1], '\n' + JSON.stringify(data, null, 2) + '\n  ');
}

// ── サイトマップへの追加 ────────────────────────────────────────
function addToSitemap(rels) {
  let s = read('sitemap.xml');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const entries = rels.map((r) => `  <url>${nl}    <loc>${urlOf(r)}</loc>${nl}    <lastmod>${TODAY}</lastmod>${nl}    <changefreq>monthly</changefreq>${nl}    <priority>0.7</priority>${nl}  </url>${nl}`).join('');
  s = s.replace('</urlset>', entries + '</urlset>');
  fs.writeFileSync('sitemap.xml', s);
}

// ── 故障注入: 正常なページから1つずつ壊して、検査が拾うかを見る ─────────
if (INJECT) {
  const sample = targets.find((f) => checkPage(f, read(f)).length === 0);
  if (!sample) { console.log('✗ 故障注入の元にする「問題なし」のページが無い'); process.exit(1); }
  const html = read(sample);
  const cases = [
    ['canonical を消す', (h) => h.replace(/<link rel="canonical"[^>]*>/, '')],
    ['description を消す', (h) => h.replace(/<meta name="description"[^>]*>/, '')],
    ['title からサイト名を消す', (h) => h.replace(/｜hideの部屋<\/title>/, '</title>')],
    ['og:url を別URLにする', (h) => h.replace(/(property="og:url" content=")[^"]+/, '$1https://example.com/')],
    ['og:site_name を旧表記にする', (h) => h.replace(/(property="og:site_name" content=")[^"]+/, '$1hide_0001 Portfolio')],
  ];
  let ok = true;
  for (const [name, broke] of cases) {
    const after = broke(html);
    const caught = after !== html && checkPage(sample, after).length > 0;
    console.log(`${caught ? '✓' : '✗'} ${name} → ${caught ? '検出した' : 'すり抜けた'}（元: ${sample}）`);
    ok &&= caught;
  }
  // 1件だけ消す（件数の申告もそれに合わせて減らす＝「件数は合っているのに作品が欠けている」形を作る）
  const { m: ld, data } = itemList(indexHtml);
  const list = data['@graph'].find((g) => g['@type'] === 'ItemList');
  list.itemListElement.pop();
  list.numberOfItems = list.itemListElement.length;
  const broken = indexHtml.replace(ld[1], JSON.stringify(data));
  const caughtList = checkItemList(broken).length > 0;
  // 画面に無い作品を ItemList へ足す（余分な項目）
  const { m: ld2, data: data2 } = itemList(indexHtml);
  const list2 = data2['@graph'].find((g) => g['@type'] === 'ItemList');
  list2.itemListElement.push({ '@type': 'ListItem', position: list2.itemListElement.length + 1, item: { '@type': 'SoftwareApplication', name: 'x', url: BASE + 'no-such-page.html' } });
  list2.numberOfItems = list2.itemListElement.length;
  const caughtExtra = checkItemList(indexHtml.replace(ld2[1], JSON.stringify(data2))).some((i) => i.includes('no-such-page.html'));
  console.log(`${caughtExtra ? '✓' : '✗'} ItemList に画面に無い作品を足す → ${caughtExtra ? '検出した' : 'すり抜けた'}`);
  // トップの検査: 正規URLを壊す
  const topBroken = indexHtml.replace(/(<link rel="canonical" href=")[^"]+/, '$1https://example.com/');
  const caughtTop = checkPage('index.html', topBroken).length > 0;
  console.log(`${caughtTop ? '✓' : '✗'} トップの canonical を壊す → ${caughtTop ? '検出した' : 'すり抜けた'}`);
  console.log(`${caughtList ? '✓' : '✗'} ItemList から1件消す → ${caughtList ? '検出した' : 'すり抜けた'}`);
  process.exit(ok && caughtList && caughtExtra && caughtTop ? 0 : 1);
}

// ── 本体 ────────────────────────────────────────────────────
let problems = 0;
for (const f of missingFiles) {
  problems++;
  console.log(`✗ ${f}: ファイルが無い（${[inSitemap.has(f) && 'sitemap.xml', linked.has(f) && 'トップのリンク'].filter(Boolean).join('・')} がまだ指している。消した・改名したなら参照も直す）`);
}
const toSitemap = [];
for (const rel of targets) {
  let html = read(rel);
  let issues = checkPage(rel, html);
  if (issues.length && WRITE) {
    if (issues.includes('sitemap.xml に無い')) toSitemap.push(rel);
    const next = fillPage(rel, html);
    if (next !== html) fs.writeFileSync(rel, next);
    html = next;
    issues = checkPage(rel, html).filter((i) => i !== 'sitemap.xml に無い' || !toSitemap.includes(rel));
  }
  if (issues.length) { problems += issues.length; console.log(`✗ ${rel}: ${issues.join(' / ')}`); }
}
if (WRITE && toSitemap.length) { addToSitemap(toSitemap); console.log(`＋ sitemap.xml に ${toSitemap.length} 件追加: ${toSitemap.join(' ')}`); }

let listIssues = checkItemList(read('index.html'));
if (listIssues.length && WRITE) {
  fs.writeFileSync('index.html', fillItemList(read('index.html')));
  console.log('＋ トップの構造化データ（ItemList）を全作品と同期した → CSPハッシュが変わるので node scripts/security-csp.mjs --write を実行すること');
  listIssues = checkItemList(read('index.html'));
}
for (const i of listIssues) { problems++; console.log(`✗ index.html: ${i}`); }

if (problems) {
  console.log(`\n==> seo-tags: 不足 ${problems} 件（node scripts/seo-tags.mjs --write で補える。説明文の材料が無いページは手で書く）`);
  process.exit(1);
}
console.log(`==> seo-tags: 問題なし ✅（${targets.length} ページ＋構造化データ）`);
