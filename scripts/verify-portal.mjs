#!/usr/bin/env node
/**
 * トップページ（index.html）刷新の回帰検査（2026-11）。Playwright で実際に開いて操作する。
 *
 *   node scripts/verify-portal.mjs            # 全項目
 *   node scripts/verify-portal.mjs --inject   # 故障を仕込んで ❌ が出ることを確かめる（偽の緑の防止）
 *
 * 見るもの（例外もエラーも出ずに壊れるものを中心に）:
 *  - 起動して例外0（別オリジンの読込失敗は △ 外部として数えない）
 *  - 内部リンク・ページ内アンカーが全部実在する
 *  - 全ゲームカードにジャンルがあり、そのジャンルの絞り込みボタンがある（無いと絞り込みで永久に出ない）
 *  - 作品カタログ: ジャンル・検索・並べ替え（新着/名前）・該当なし表示・件数表示
 *  - サイト内検索: / で開く・結果・Enterで移動・Escで閉じてフォーカスが戻る
 *  - スマホのメニュー: 開く・Escで閉じる・フォーカスが戻る・リンクで閉じる
 *  - 日英切替: 英語へ→日本語へ戻る（英語が残らない）・既存の site-lang キーを使う
 *  - 保存データ: 既存のキー（ゲームのセーブ・ダッシュボードの設定）を書き換えない
 *  - ダッシュボードのテーマ色を保存していても背景が暗いまま（旧版は --bg を白に書き戻した）
 *  - 横はみ出しなし（390 / 768 / 1440）
 *  - 公開数の表示が実数と一致・公開日データが全カードにある
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const INJECT = process.argv.includes('--inject');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

function serve() {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (p.endsWith('/')) p += 'index.html';
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

const results = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); };

// ── 静的な検査 ──
function staticChecks(html, portalJs) {
  const hrefs = [...new Set([...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]))];
  const internal = hrefs.filter(u => !/^(https?:|mailto:|tel:|javascript:|#)/.test(u));
  const broken = internal.filter(u => { let p = decodeURI(u.split(/[?#]/)[0]); if (p.endsWith('/')) p += 'index.html'; return !existsSync(p); });
  ok('内部リンクが全部実在する', broken.length === 0, broken.join(', '));
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const anchors = hrefs.filter(u => u.startsWith('#') && u.length > 1).map(u => u.slice(1)).filter(a => !ids.has(a));
  ok('ページ内アンカーが全部実在する', anchors.length === 0, anchors.join(', '));

  const cards = [...html.matchAll(/<a class="card work-card[^"]*"([^>]*)>/g)].map(m => m[1]);
  const noCat = cards.filter(a => !/data-category="/.test(a));
  ok('全ゲームカードにジャンル（data-category）がある', noCat.length === 0, `${noCat.length} 枚にない`);
  const cats = new Set(cards.map(a => (a.match(/data-category="([^"]+)"/) || [])[1]).filter(Boolean));
  const btns = new Set([...html.matchAll(/class="works-filter-btn[^"]*" data-filter="([^"]+)"/g)].map(m => m[1]));
  const orphan = [...cats].filter(c => !btns.has(c));
  ok('全ジャンルに絞り込みボタンがある', orphan.length === 0, orphan.join(', '));

  // data-pi18n の英語訳漏れ（日本語は HTML の原文に戻すので、英語辞書だけ見る）
  const enBlock = portalJs.slice(portalJs.indexOf('    en: {'), portalJs.indexOf('  };', portalJs.indexOf('    en: {')));
  const keys = new Set([...html.matchAll(/data-pi18n(?:-html|-ph|-aria)?="([^"]+)"/g)].map(m => m[1]));
  const missing = [...keys].filter(k => !new RegExp(`'${k.replace(/[-]/g, '\\-')}'\\s*:|\\b${k.replace(/-/g, '_')}\\s*:`).test(enBlock) && !new RegExp(`(^|[\\s{,])${k}\\s*:`).test(enBlock));
  ok('トップ刷新の文言に英語訳がある（data-pi18n）', missing.length === 0, missing.join(', '));

  // カードのサムネは軽量版（assets/thumbs/。scripts/gen-top-thumbs.py）を使う。原画（1,000〜1,800px）を
  // 360px の枠に出すとトップの転送量が 5MB を超え、スマホの初回表示が遅くなる（2026-11 Lighthouse で実測）
  const grid = html.slice(html.indexOf('<div class="works-grid">'), html.indexOf('<section id="tools"'));
  const heavy = [...grid.matchAll(/<img[^>]*src="(assets\/[^"]+)"/g)].map(m => m[1])
    .filter(src => !src.startsWith('assets/thumbs/') && existsSync(src) && statSync(src).size > 60000);
  ok('ゲームカードのサムネが軽量版（60KB超の原画を直接使わない）', heavy.length === 0, heavy.join(', ') + (heavy.length ? ' → python3 scripts/gen-top-thumbs.py' : ''));

  const meta = existsSync('data/catalog-meta.json') ? JSON.parse(readFileSync('data/catalog-meta.json', 'utf8')).items || {} : {};
  const hrefsCards = cards.map(a => (a.match(/href="([^"]+)"/) || [])[1]).filter(Boolean);
  const noDate = hrefsCards.filter(h => !meta[h]?.added);
  ok('全ゲームに公開日（data/catalog-meta.json）がある', noDate.length === 0, noDate.join(', '));
}

async function newPage(browser, base, { width = 1440, height = 900, storage = {}, mutate } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  await ctx.addInitScript(s => {
    window.__PORTAL_TEST = true;
    if (!sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); }
  }, storage);
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); (/Failed to load resource|net::ERR|CORS|Content Security Policy/i.test(t) ? external : errors).push(t.slice(0, 160)); } });
  page.on('requestfailed', r => { if (!r.url().startsWith(base)) external.push(r.url()); });
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url().slice(base.length)}`); });
  // 外部（CDN・API・フォント）は塞ぐ。回線で結果が揺れる検査にしない
  await page.route(u => !u.href.startsWith(base) && !u.href.startsWith('data:'), r => r.abort());
  if (mutate) await mutate(page);
  await page.goto(base + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.PORTAL_DEBUG && document.querySelector('#portal-cat-count')?.textContent, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  return { ctx, page, errors, external };
}

async function run(base, mutate) {
  const browser = await chromium.launch();
  try {
    // ── 1. デスクトップ: 起動・カタログ・検索・日英・保存データ ──
    const seeded = { 'home-dashboard-theme': 'purple', 'sengoku_save_v1': '{"turn":12}', 'home-dashboard-layout': '{"order":["visit"]}' };
    const { ctx, page, errors, external } = await newPage(browser, base, { storage: seeded, mutate });

    const counts = await page.evaluate(() => ({
      cards: document.querySelectorAll('#works .work-card').length,
      tools: document.querySelectorAll('.tools-grid .tool-card').length,
      statGames: document.querySelector('[data-portal-count="games"]')?.textContent,
      statTools: document.querySelector('[data-portal-count="tools"]')?.textContent,
    }));
    ok('公開数の表示が実数と一致（ゲーム・ツール）', String(counts.cards) === counts.statGames && String(counts.tools) === counts.statTools, JSON.stringify(counts));

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = bg.match(/\d+/g).map(Number);
    ok('テーマ色を保存していても背景が暗い（ダークネイビー）', r + g + b < 120, bg);

    // ジャンル
    await page.click('.works-filter-btn[data-filter="board"]');
    let st = await page.evaluate(() => {
      const vis = [...document.querySelectorAll('#works .work-card')].filter(c => getComputedStyle(c).display !== 'none');
      return { n: vis.length, bad: vis.filter(c => c.dataset.category !== 'board').length, count: document.querySelector('#portal-cat-count').textContent, pressed: document.querySelector('.works-filter-btn[data-filter="board"]').getAttribute('aria-pressed') };
    });
    ok('ジャンル絞り込み（ボード）で該当作品だけが見える', st.n > 0 && st.bad === 0 && st.count.includes(String(st.n)) && st.pressed === 'true', JSON.stringify(st));

    // 検索 × ジャンルの組み合わせ
    await page.fill('#portal-cat-q', '将棋');
    await page.waitForTimeout(300);
    st = await page.evaluate(() => [...document.querySelectorAll('#works .work-card')].filter(c => getComputedStyle(c).display !== 'none').map(c => c.getAttribute('href')));
    ok('カタログ検索がジャンルと組み合わさる（ボード×将棋）', st.includes('shogi.html') && st.length < 10, st.join(','));

    await page.fill('#portal-cat-q', 'zzzzqqqq');
    await page.waitForTimeout(300);
    const empty = await page.evaluate(() => !document.querySelector('#portal-cat-empty').hidden);
    ok('該当なしの表示が出る', empty);
    await page.click('#portal-cat-reset');
    await page.waitForTimeout(300);
    st = await page.evaluate(() => window.PORTAL_DEBUG.state());
    ok('「条件をクリア」で全件に戻る', st.shown === st.total && st.genre === 'all' && !st.q, JSON.stringify(st));

    // 並べ替え
    await page.selectOption('#portal-cat-sort', 'new');
    await page.waitForTimeout(200);
    const order = await page.evaluate(() => {
      const d = Object.fromEntries(window.PORTAL_DEBUG.dates().map(x => [x.href, x.added]));
      return [...document.querySelectorAll('#works .work-card')].map(c => d[c.getAttribute('href')] || '');
    });
    const sortedDesc = order.every((v, i) => i === 0 || order[i - 1] >= v);
    ok('新着順が公開日の新しい順に並ぶ', sortedDesc && order[0], order.slice(0, 3).join(','));
    await page.selectOption('#portal-cat-sort', 'name');
    await page.waitForTimeout(200);
    const names = await page.evaluate(() => [...document.querySelectorAll('#works .work-card h3')].map(h => h.textContent.trim()));
    ok('名前順に並ぶ', names.every((v, i) => i === 0 || names[i - 1].localeCompare(v, 'ja') <= 0), names.slice(0, 3).join(' / '));
    await page.selectOption('#portal-cat-sort', 'default');

    // サイト内検索
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('/');
    await page.waitForTimeout(200);
    const opened = await page.evaluate(() => !document.getElementById('portal-search').hidden && document.activeElement?.id === 'portal-search-input');
    ok('/ キーでサイト内検索が開き、入力欄にフォーカス', opened);
    await page.keyboard.type('麻雀');
    await page.waitForTimeout(150);
    const res = await page.evaluate(() => [...document.querySelectorAll('#portal-search-results a')].map(a => a.getAttribute('href')));
    ok('サイト内検索で作品が見つかる（麻雀）', res.includes('mahjong.html'), res.slice(0, 5).join(','));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const closed = await page.evaluate(() => document.getElementById('portal-search').hidden);
    ok('Esc で検索が閉じる', closed);
    await page.click('#portal-search-btn');
    await page.keyboard.type('ダッシュボード');
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const hash = await page.evaluate(() => location.hash);
    ok('検索結果を Enter でセクションへ移動', hash === '#dashboard', hash);

    // 日英切替（既存の site-lang キー・既存ボタン）
    const jaTitle = await page.evaluate(() => document.querySelector('#hero-title').textContent.trim());
    await page.click('#lang-toggle-btn');
    await page.waitForTimeout(200);
    const en = await page.evaluate(() => ({ t: document.querySelector('#hero-title').textContent.trim(), lang: localStorage.getItem('site-lang'), cnt: document.querySelector('#portal-cat-count').textContent, z: document.querySelector('#zero1-title').textContent }));
    ok('英語へ切り替わる（ヒーロー・カタログ・ZERO-1）', /Nothing to install/.test(en.t) && /Showing/.test(en.cnt) && /ZERO-1/.test(en.z) && !/自分/.test(en.z) && en.lang === 'en', JSON.stringify(en));
    await page.click('#lang-toggle-btn');
    await page.waitForTimeout(200);
    const back = await page.evaluate(() => document.querySelector('#hero-title').textContent.trim());
    ok('日本語へ戻すと英語が残らない', back === jaTitle, back);

    // 保存データ
    const after = await page.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), Object.keys(seeded));
    const changed = Object.keys(seeded).filter(k => after[k] !== seeded[k]);
    ok('既存の保存データ（ゲームのセーブ・ダッシュボード設定）を書き換えない', changed.length === 0, changed.join(', '));

    ok('起動〜操作で例外・ローカル資産の404が0件', errors.length === 0, errors.slice(0, 5).join(' | '));
    if (external.length) console.log(`  △ 外部: ${external.length} 件（検査では外部を塞いでいるので数えない）`);
    await ctx.close();

    // ── 2. スマホ: メニュー・はみ出し ──
    const m = await newPage(browser, base, { width: 390, height: 844, mutate });
    const navHidden = await m.page.evaluate(() => getComputedStyle(document.querySelector('.site-nav')).display === 'none');
    ok('スマホでは横並びナビを隠してメニューボタンにする', navHidden);
    await m.page.click('#portal-menu-btn');
    await m.page.waitForTimeout(250);
    let d = await m.page.evaluate(() => ({ open: !document.getElementById('portal-drawer').hidden, exp: document.getElementById('portal-menu-btn').getAttribute('aria-expanded'), inside: document.getElementById('portal-drawer').contains(document.activeElement) }));
    ok('メニューが開き、フォーカスがメニュー内へ移る', d.open && d.exp === 'true' && d.inside, JSON.stringify(d));
    // 案内エージェントのボタンがメニューの上に重ならない
    const topEl = await m.page.evaluate(() => { const r = document.querySelector('.portal-drawer-panel').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.bottom - 40); return !!e && !!e.closest('#portal-drawer'); });
    ok('メニューの上に他の部品が重ならない', topEl);
    await m.page.keyboard.press('Escape');
    await m.page.waitForTimeout(200);
    d = await m.page.evaluate(() => ({ open: !document.getElementById('portal-drawer').hidden, focus: document.activeElement?.id }));
    ok('Esc でメニューが閉じ、フォーカスがメニューボタンへ戻る', !d.open && d.focus === 'portal-menu-btn', JSON.stringify(d));
    await m.page.click('#portal-menu-btn');
    await m.page.waitForTimeout(200);
    await m.page.click('#portal-drawer a[href="#faq"]');
    await m.page.waitForTimeout(500);
    d = await m.page.evaluate(() => ({ open: !document.getElementById('portal-drawer').hidden, hash: location.hash, locked: document.documentElement.classList.contains('portal-locked') }));
    ok('メニューのリンクで移動し、メニューが閉じてスクロールが戻る', !d.open && d.hash === '#faq' && !d.locked, JSON.stringify(d));
    ok('スマホで例外0件', m.errors.length === 0, m.errors.slice(0, 3).join(' | '));
    await m.ctx.close();

    for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]]) {
      const v = await newPage(browser, base, { width: w, height: h, mutate });
      const over = await v.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(`横にはみ出さない @${w}px`, over <= 0, `${over}px`);
      await v.ctx.close();
    }
  } finally {
    await browser.close();
  }
}

// ── 故障注入（壊したら ❌ が出ることを確かめる） ──
const INJECTIONS = [
  {
    name: 'テーマ色が --bg を白へ書き戻す（旧版の不具合）',
    expect: 'テーマ色を保存していても背景が暗い（ダークネイビー）',
    mutate: page => page.route(/assets\/js\/app\.js/, async r => { const res = await r.fetch(); const t = (await res.text()).replace("{ '--blue':'#a855f7',", "{ '--bg':'#fffbf5', '--blue':'#a855f7',"); r.fulfill({ response: res, body: t }); }),
  },
  {
    name: 'カタログがジャンルを無視する',
    expect: 'ジャンル絞り込み（ボード）で該当作品だけが見える',
    mutate: page => page.route(/assets\/js\/portal\.js/, async r => { const res = await r.fetch(); const t = (await res.text()).replace("(cat.genre === 'all' || c.genre === cat.genre)", 'true'); r.fulfill({ response: res, body: t }); }),
  },
  {
    name: 'Esc でメニュー・検索が閉じない',
    expect: ['Esc で検索が閉じる', 'Esc でメニューが閉じ、フォーカスがメニューボタンへ戻る'],
    mutate: page => page.route(/assets\/js\/portal\.js/, async r => { const res = await r.fetch(); const t = (await res.text()).replace("if (e.key === 'Escape' && openLayer)", 'if (false)'); r.fulfill({ response: res, body: t }); }),
  },
  {
    name: '並べ替えで既存の保存キーを上書きする',
    expect: '既存の保存データ（ゲームのセーブ・ダッシュボード設定）を書き換えない',
    mutate: page => page.route(/assets\/js\/portal\.js/, async r => { const res = await r.fetch(); const t = (await res.text()).replace("const SORT_KEY = 'portal-cat-sort';", "const SORT_KEY = 'sengoku_save_v1';"); r.fulfill({ response: res, body: t }); }),
  },
];

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
try {
  if (INJECT) {
    let caught = 0;
    for (const inj of INJECTIONS) {
      results.length = 0;
      // 壊れた版では後続の操作が詰まることがある。そこで止まっても、それまでの判定で見る
      await run(base, inj.mutate).catch(e => ok('検査が最後まで走る', false, e.message.split('\n')[0]));
      const expects = [].concat(inj.expect);
      const detected = results.some(r => expects.includes(r.name) && !r.pass);
      if (detected) caught++;
      console.log(`${detected ? '✅' : '❌'} 故障注入「${inj.name}」→ ${detected ? '検出' : 'すり抜け'}`);
    }
    console.log(`\n==> verify-portal --inject: ${caught} / ${INJECTIONS.length} 件を検出`);
    process.exitCode = caught === INJECTIONS.length ? 0 : 1;
  } else {
    staticChecks(readFileSync('index.html', 'utf8'), readFileSync('assets/js/portal.js', 'utf8'));
    await run(base).catch(e => ok('検査が最後まで走る', false, e.message.split('\n')[0]));
    for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${!r.pass && r.detail ? `\n    → ${r.detail}` : ''}`);
    const fail = results.filter(r => !r.pass).length;
    console.log(`\n==> verify-portal: ${results.length - fail} 項目 ✅ / ${fail} 項目 ❌`);
    process.exitCode = fail ? 1 : 0;
  }
} finally {
  server.close();
}
