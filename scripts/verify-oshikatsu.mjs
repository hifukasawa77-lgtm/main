#!/usr/bin/env node
/*
 * verify-oshikatsu.mjs — 推し活ログ（oshikatsu.html）の必須チェック
 *
 * 「例外0件＝動いている」ではない。このページの無言の壊れ方:
 *   - 日付が壊れた1件で一覧とダッシュボードが丸ごと描かれなくなる（sanitize を通さないと起きる）
 *   - 定期出費が消した月に再生成される／二重計上される
 *   - Canvas は未描画でも例外を出さない（画素まで見る）
 *   - 合成したクリックの後に見た目が崩れても例外は出ない（モバイル幅の横溢れを見る）
 *
 * 使い方:
 *   node scripts/verify-oshikatsu.mjs             # 通常検査
 *   node scripts/verify-oshikatsu.mjs --inject    # 故障注入: 壊れた状態を混ぜて ❌ が出ることを確かめる
 *   node scripts/verify-oshikatsu.mjs --shots DIR # 画面を撮る（目視確認用）
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PAGE = 'oshikatsu.html';
const INJECT = process.argv.includes('--inject');
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : '';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.join(ROOT, url === '/' ? PAGE : url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [], missing = [], external = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) missing.push('failed ' + r.url()); else external.push(r.url()); });
page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) missing.push(`${r.status()} ${r.url()}`); });
page.on('dialog', (d) => d.accept());

const fresh = async (seed) => {
  await page.addInitScript(() => { window.__OSHI_TEST = true; });
  await page.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
  await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('oshikatsu_log_v1', s); }, seed || null);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(150);
};
const dbg = (fn, ...a) => page.evaluate(([f, args]) => { const d = window.OSHI_DEBUG; return (new Function('d', 'a', 'return (' + f + ')(d, ...a)'))(d, args); }, [fn.toString(), a]);
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ymOf = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const tab = (t) => page.click(`#tab-${t}`);

console.log('\n── 1. 起動 ─────────────────────────────');
await fresh();
check('例外0件（pageerror + console.error）', errors.length === 0, errors.slice(0, 3).join(' | '));
check('404アセット0件', missing.length === 0, missing.slice(0, 3).join(' | '));
if (external.length) console.log(`  △ 外部の読込失敗 ${external.length} 件（Webフォント等・FAILにしない）`);
check('空の状態でオンボーディングが出る', await page.isVisible('#onboarding'));
check('空の状態でもヒーローが「未定」を出す', (await page.textContent('#hero-num')) === '未定');

console.log('\n── 2. 壊れたデータの検疫（v1互換・無言クラッシュ防止）──');
const legacy = {
  oshiList: [{ id: 'o1', name: '旧推し', category: 'アイドル', color: '#ff00aa' }, { id: 'o1', name: '重複ID', category: '謎', color: 'red' }, { name: '<img src=x onerror="window.__xss=1">' }, null, 5],
  expenses: [
    { id: 'e1', date: day(0), oshiId: 'o1', category: 'グッズ', amount: 3000, memo: '旧データ' },
    { id: 'e2', date: 'ぬるぽ', oshiId: 'o1', category: 'グッズ', amount: 100 },       // 日付が壊れている
    { id: 'e3', oshiId: 'o1', category: 'グッズ', amount: 100 },                        // 日付なし（旧版は localeCompare で例外）
    { id: 'e4', date: day(0), oshiId: 'GONE', category: '不明費目', amount: '1,500円' }, // 宙に浮いた推しID・不明費目・数値でない金額
    { id: 'e5', date: day(0), oshiId: 'o1', category: 'グッズ', amount: -50 },
  ],
  events: [{ id: 'v1', date: day(-3), oshiId: 'o1', name: '過去LIVE' }, { id: 'v2', date: day(10), oshiId: 'o1', name: '未来LIVE' }, { id: 'v3', date: '2026-13-40', name: '壊れた日付' }],
  budget: 'abc',
};
await fresh(JSON.stringify(legacy));
const st = await dbg((d) => d.getState());
check('例外なく起動（壊れた記録があっても描画が止まらない）', errors.length === 0, errors.slice(0, 2).join(' | '));
check('日付が壊れた/無い/負の金額の出費を弾く（有効2件だけ残る）', st.expenses.length === 1 && st.expenses[0].id === 'e1', `残り=${st.expenses.map((e) => e.id)}`);
check('重複IDの推しは別IDに振り直される', new Set(st.oshiList.map((o) => o.id)).size === st.oshiList.length);
check('不正な色・カテゴリは既定値へ', st.oshiList.every((o) => /^#[0-9a-f]{6}$/i.test(o.color)) && st.oshiList.every((o) => typeof o.category === 'string' && o.category !== '謎'));
check('不正な予算は0へ', st.budget === 0);
check('壊れた日付のイベントは弾き、過去/未来を自動判定', st.events.length === 2 &&
  (await dbg((d) => [d.effStatus(d.getState().events[0]), d.effStatus(d.getState().events[1])])).join() === 'attended,planned');
check('「宙に浮いた推しID」は未割当に整う', st.expenses.every((e) => e.oshiId === '' || st.oshiList.some((o) => o.id === e.oshiId)));

console.log('\n── 3. XSS（ユーザー入力は textContent のみ）──');
check('推し名に入れた <img onerror> が実行されない', (await page.evaluate(() => window.__xss)) === undefined);
await tab('oshi');
check('DOM に img 要素が生成されていない', (await page.locator('#page-oshi img, #page-dashboard img').count()) === 0);
await page.fill('#oshi-name', '<script>window.__xss2=1</script>');
await page.click('#oshi-submit');
check('フォームから入れたスクリプトも実行されず文字として表示', (await page.evaluate(() => window.__xss2)) === undefined &&
  (await page.textContent('#list-oshi')).includes('<script>'));

console.log('\n── 4. 基本フロー（推し→出費→編集→削除→元に戻す）──');
await fresh();
await tab('oshi');
await page.fill('#oshi-name', 'さくらすと');
await page.fill('#oshi-budget', '20000');
await page.click('#oshi-submit');
check('推しを登録できる', (await dbg((d) => d.getState().oshiList.length)) === 1);
await tab('expenses');
await page.fill('#exp-amount', '4500'); await page.selectOption('#exp-cat', 'グッズ'); await page.fill('#exp-memo', 'アクスタ');
await page.click('#exp-submit');
check('出費を記録できる', (await dbg((d) => d.getState().expenses.length)) === 1);
check('記録後も日付・推し・費目が残り、金額だけ空になる（連続入力）', (await page.inputValue('#exp-amount')) === '' && (await page.inputValue('#exp-cat')) === 'グッズ');
await page.click('#amount-chips [data-add="1000"]'); await page.click('#amount-chips [data-add="500"]');
check('クイック金額チップで加算できる', (await page.inputValue('#exp-amount')) === '1500');
await page.click('#amount-chips [data-add="0"]');
await page.click('#list-expenses .act[aria-label="編集"]');
await page.fill('#exp-amount', '5000'); await page.click('#exp-submit');
check('出費を編集（更新）できる', (await dbg((d) => d.getState().expenses[0].amount)) === 5000);
check('編集後にフォームが「追加」へ戻る', (await page.textContent('#exp-submit')).includes('記録する'));
await page.click('#list-expenses .act.del');
check('削除できる', (await dbg((d) => d.getState().expenses.length)) === 0);
await page.click('.toast-btn');
check('「元に戻す」で復元される（データを失わない）', (await dbg((d) => d.getState().expenses.length)) === 1);

console.log('\n── 5. 参戦・予定・ヒーロー ──');
await tab('events');
await page.fill('#ev-date', day(12)); await page.fill('#ev-name', '未来ツアー'); await page.fill('#ev-venue', '横浜アリーナ'); await page.fill('#ev-ticket', '9800');
await page.click('#ev-submit');
let s2 = await dbg((d) => d.getState());
check('予定を登録でき、チケット代が出費に紐付いて同時記録される', s2.events.length === 1 && s2.expenses.some((e) => e.category === 'チケット' && e.amount === 9800 && e.eventId === s2.events[0].id));
await tab('dashboard');
check('ヒーローに「あと12日」が出る（日付計算の実値）', (await page.textContent('#hero-num')) === '12' && (await page.textContent('#hero-name')) === '未来ツアー');
await tab('events');
await page.fill('#ev-date', day(30)); await page.fill('#ev-name', '応募中ライブ'); await page.selectOption('#ev-status', 'applied');
await page.click('#ev-submit');
check('応募中はヒーローの対象にならない（当選前に「あと◯日」と出さない）', await (async () => { await tab('dashboard'); return (await page.textContent('#hero-name')) === '未来ツアー'; })());
await tab('events');
await page.click('#list-upcoming button:has-text("当選")');
check('「当選」で参戦予定に変わる', (await dbg((d) => d.getState().events.find((e) => e.name === '応募中ライブ').status)) === '');
const ics = await dbg((d) => d.buildICS());
check('ICSが妥当（VEVENT・CRLF・全日予定・会場）', /BEGIN:VCALENDAR\r\n/.test(ics) && (ics.match(/BEGIN:VEVENT/g) || []).length === 2 && /DTSTART;VALUE=DATE:\d{8}/.test(ics) && ics.includes('LOCATION:横浜アリーナ'));
const dl = page.waitForEvent('download'); await page.click('#btn-ics');
check('ICSがダウンロードされる', (await dl).suggestedFilename().endsWith('.ics'));

console.log('\n── 6. 定期出費（二重計上・再生成の無言バグ）──');
await fresh();
await tab('expenses');
await page.fill('#rc-amount', '1100'); await page.fill('#rc-day', '1'); await page.fill('#rc-start', ymOf(-3)); await page.fill('#rc-memo', 'FC会費');
await page.click('#form-recur button[type="submit"]');
let n1 = await dbg((d) => d.getState().expenses.filter((e) => e.recurId).length);
check('過去の月ぶんが登録時にまとめて記録される（当月1日は過去なので4件）', n1 === 4, `件数=${n1}`);
check('再適用しても増えない（二重計上しない）', (await dbg((d) => d.applyRecurring())) === 0);
await dbg((d) => { const s = d.getState(); s.expenses = s.expenses.slice(1); d.renderAll(); });
check('消した出費は再生成されない（消した意思を尊重）', (await dbg((d) => d.applyRecurring())) === 0 && (await dbg((d) => d.getState().expenses.length)) === 3);

console.log('\n── 7. ほしい物 → 購入 → 出費 ──');
await tab('oshi'); await page.fill('#oshi-name', 'A'); await page.click('#oshi-submit');
await tab('wishes');
await page.fill('#wish-name', '初回限定盤'); await page.fill('#wish-price', '4500'); await page.click('#wish-submit');
await page.click('#list-wishes button:has-text("購入した")');
check('「購入した」で出費フォームへ金額・メモが持ち込まれる', (await page.inputValue('#exp-amount')) === '4500' && (await page.inputValue('#exp-memo')) === '初回限定盤');
await page.click('#exp-submit');
const w = await dbg((d) => d.getState());
check('出費が記録され、ほしい物は購入済みになる', w.expenses.some((e) => e.memo === '初回限定盤' && e.amount === 4500) && w.wishes[0].done === true);

console.log('\n── 8. データ入出力 ──');
check('CSVの数式インジェクションを無害化（=1+1 → \'=1+1）', (await dbg((d) => d.csvCell('=1+1+cmd'))) === "'=1+1+cmd");
check('CSVの引用符・改行を正しく囲む', (await dbg((d) => d.csvCell('a,"b"\nc'))) === '"a,""b""\nc"');
await dbg((d) => d.importData({ expenses: [{ id: 'zz', date: '2020-01-02', amount: 777, category: 'グッズ' }, { id: 'bad', date: 'x', amount: 5 }], oshiList: [] }, 'merge'));
const mg = await dbg((d) => d.getState());
check('マージ取り込みは既存を残し、正常な記録だけ足す', mg.expenses.some((e) => e.id === 'zz') && !mg.expenses.some((e) => e.id === 'bad') && mg.oshiList.length === 1);
await dbg((d) => d.importData({ expenses: [{ id: 'only', date: '2020-01-02', amount: 1 }] }, 'replace'));
check('置き換え取り込みで全体が入れ替わる', (await dbg((d) => d.getState().expenses.map((e) => e.id))).join() === 'only');
await fresh('{これはJSONではない');
check('壊れた保存データは上書きせず退避される（次の保存で失わない）', (await page.evaluate(() => localStorage.getItem('oshikatsu_log_v1_corrupt'))) === '{これはJSONではない');

console.log('\n── 9. 予算・ペース予測・金額を隠す ──');
await fresh(JSON.stringify({ budget: 10000, oshiList: [{ id: 'a', name: 'A', color: '#f472b6' }], expenses: [{ id: 'x', date: day(0), oshiId: 'a', category: 'グッズ', amount: 9000 }] }));
check('予算%が出る（90%）', (await page.textContent('#budget-pct')) === '90%');
check('バーが警告色（80%超）', await page.evaluate(() => document.getElementById('budget-bar').classList.contains('warn')));
await dbg((d) => { const s = d.getState(); s.expenses.push({ id: 'y', date: new Date().toISOString().slice(0, 10), oshiId: 'a', category: 'グッズ', amount: 2000, memo: '', eventId: '', recurId: '' }); d.renderAll(); });
check('予算超過で赤（over）になり「超過」と出る', await page.evaluate(() => document.getElementById('budget-bar').classList.contains('over')) && (await page.textContent('#budget-remain')).includes('超過'));
await page.click('#btn-mask');
check('金額を隠すと画面の金額が ¥••• になり、グラフの数値も消える', (await page.textContent('#sum-spend')) === '¥•••' && !(await page.textContent('#budget-label')).match(/\d/));
await page.click('#btn-mask');
check('隠す設定は保存される（再読込後も維持）', await (async () => { await page.click('#btn-mask'); await page.reload({ waitUntil: 'load' }); const v = (await page.textContent('#sum-spend')) === '¥•••'; await page.click('#btn-mask'); return v; })());

console.log('\n── 10. グラフが実際に描かれる（画素で確認）──');
await fresh(JSON.stringify({ oshiList: [{ id: 'a', name: 'A', color: '#f472b6' }], expenses: [
  { id: '1', date: day(0), oshiId: 'a', category: 'グッズ', amount: 8000 }, { id: '2', date: day(0), oshiId: 'a', category: 'チケット', amount: 12000 },
  { id: '3', date: ymOf(-1) + '-10', oshiId: 'a', category: '遠征・交通', amount: 5000 }] }));
const px = await page.evaluate(() => {
  const count = (id) => { const c = document.getElementById(id), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n / (d.length / 4); };
  const c = document.getElementById('chart-category'), x = c.getContext('2d'), cx = c.width >> 1, cy = c.height >> 1;
  return { cat: count('chart-category'), mon: count('chart-monthly'), hole: x.getImageData(cx, cy - 6, 1, 1).data[3] };
});
check('費目ドーナツが描かれている（塗り率 > 10%）', px.cat > 0.1, `塗り率=${px.cat.toFixed(2)}`);
check('ドーナツの穴が透明に抜けている', px.hole === 0 || px.hole < 255);
check('月別の積み上げ棒が描かれている（塗り率 > 2%）', px.mon > 0.02, `塗り率=${px.mon.toFixed(3)}`);
check('推し別ランキングにアバターと割合が出る', (await page.locator('#rank-list .avatar').count()) === 1 && (await page.textContent('#rank-list')).includes('100%'));
await page.click('.seg [data-mode="all"]');
await page.locator('#chart-monthly').scrollIntoViewIfNeeded();
const box = await page.locator('#chart-monthly').boundingBox();
await page.mouse.click(box.x + 40 + (box.width - 48) / 12 * 10.5, box.y + 120); // 12本中の右から2本目＝先月
check('グラフの棒をクリックすると「累計」から先月の月表示へ切り替わる', (await dbg((d) => d.view.mode + ':' + d.view.ym)) === 'month:' + ymOf(-1));

// 高DPIで再描画のたびにCanvasが膨らむ不具合（height属性の読み書き）の回帰検査。例外は出ず、ただ巨大になる
{
  const hp = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await hp.addInitScript(() => { window.__OSHI_TEST = true; });
  await hp.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
  await hp.evaluate(() => localStorage.clear()); await hp.reload({ waitUntil: 'load' });
  await hp.click('#btn-onb-sample');
  for (let i = 0; i < 4; i++) await hp.evaluate(() => window.OSHI_DEBUG.renderAll());
  const hs = await hp.evaluate(() => ['chart-category', 'chart-monthly'].map((id) => document.getElementById(id).getBoundingClientRect().height));
  check('dpr2で何度再描画してもCanvasの高さが変わらない（140/240px）', Math.round(hs[0]) === 140 && Math.round(hs[1]) === 240, `高さ=${hs.map(Math.round)}`);
  await hp.close();
}

console.log('\n── 11. テーマ（パステル標準／ダーク切替）──');
check('標準はパステル（data-theme なし）', (await page.getAttribute('html', 'data-theme')) === null);
const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
await page.click('#btn-theme');
check('ダークへ切替でき、背景が変わる', (await page.getAttribute('html', 'data-theme')) === 'dark' && (await page.evaluate(() => getComputedStyle(document.body).backgroundImage)) !== bgLight);
await page.reload({ waitUntil: 'load' });
check('テーマは保存され、再読込で点滅なく復元', (await page.getAttribute('html', 'data-theme')) === 'dark');
await page.click('#btn-theme');

console.log('\n── 12. FAB・ナビ・ディープリンク ──');
await page.click('#fab');
check('＋記録でクイックシートが開く', await page.isVisible('#quick-sheet'));
await page.keyboard.press('Escape');
check('Escで閉じる', !(await page.isVisible('#quick-sheet')));
await page.click('#fab'); await page.click('[data-quick="events"]');
check('「参戦」を選ぶと参戦タブへ移り入力欄にフォーカス', (await page.evaluate(() => document.activeElement.id)) === 'ev-name' && await page.isVisible('#page-events'));
await page.goto(`${BASE}/${PAGE}#wishes`, { waitUntil: 'load' });
check('#wishes で直接そのタブが開く', await page.isVisible('#page-wishes'));

console.log('\n── 13. モバイル幅（390px）の崩れ ──');
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const mp = await mctx.newPage();
const merr = []; mp.on('pageerror', (e) => merr.push(e.message));
await mp.addInitScript(() => { window.__OSHI_TEST = true; });
await mp.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
await mp.evaluate(() => localStorage.clear()); await mp.reload({ waitUntil: 'load' });
await mp.click('#btn-onb-sample'); await mp.waitForTimeout(200);
const geo = await mp.evaluate(() => {
  const nav = document.getElementById('tabs').getBoundingClientRect(), fab = document.getElementById('fab').getBoundingClientRect();
  const vis = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';
  return { over: document.documentElement.scrollWidth - window.innerWidth, navBottom: Math.round(window.innerHeight - nav.bottom), fabIn: fab.left >= 0 && fab.right <= window.innerWidth && fab.bottom <= window.innerHeight,
    fabCenter: Math.abs((fab.left + fab.right) / 2 - window.innerWidth / 2), tabs: ['tab-dashboard', 'tab-expenses', 'tab-events', 'tab-oshi'].every(vis), hidden: !vis('tab-wishes') && !vis('tab-settings'),
    headerBtns: vis('btn-go-wishes') && vis('btn-go-settings'), sumCards: document.querySelectorAll('.sum-card').length };
});
check('横スクロールが出ない（はみ出し0px）', geo.over <= 0, `はみ出し=${geo.over}px`);
check('下部ナビが画面下端に張り付く', geo.navBottom === 0);
check('FABが画面内の中央にある', geo.fabIn && geo.fabCenter < 2);
check('下部ナビはホーム/出費/参戦/推しの4つ、ほしい物・設定はヘッダーのアイコンへ', geo.tabs && geo.hidden && geo.headerBtns);
check('サンプルデータでヒーロー・統計カード4枚・推しストリップが出る', geo.sumCards === 4 && (await mp.textContent('#hero-num')) === '21' && (await mp.locator('#oshi-strip .oshi-mini').count()) === 2);
await mp.click('#tab-events'); await mp.click('#tab-oshi'); await mp.click('#btn-go-settings');
const over2 = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('全タブを巡っても横溢れなし', over2 <= 0 && merr.length === 0, merr.slice(0, 2).join(' | '));
if (SHOTS) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await mp.click('#tab-dashboard'); await mp.waitForTimeout(300);
  await mp.screenshot({ path: path.join(SHOTS, 'mobile-home-pastel.png'), fullPage: true });
  await mp.evaluate(() => window.scrollTo(0, 0)); await mp.click('#fab'); await mp.waitForTimeout(250);
  await mp.screenshot({ path: path.join(SHOTS, 'mobile-fab.png') });
  await mp.keyboard.press('Escape');
  await mp.click('#tab-expenses'); await mp.waitForTimeout(200); await mp.screenshot({ path: path.join(SHOTS, 'mobile-expenses.png'), fullPage: true });
  await mp.click('#tab-oshi'); await mp.waitForTimeout(200); await mp.screenshot({ path: path.join(SHOTS, 'mobile-oshi.png'), fullPage: true });
  await mp.click('#tab-dashboard'); await mp.click('#btn-theme'); await mp.waitForTimeout(300);
  await mp.screenshot({ path: path.join(SHOTS, 'mobile-home-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' });
  await page.click('#btn-onb-sample'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'desktop-home.png'), fullPage: true });
}
await mctx.close();

if (INJECT) {
  console.log('\n── 故障注入（この下が ❌ にならなければ、検査は素通りしている）──');
  await fresh();
  const threw = await page.evaluate(() => {
    try { const s = window.OSHI_DEBUG.getState(); s.expenses.push({ id: 'bad', date: undefined, oshiId: '', category: 'グッズ', amount: 100 }); window.OSHI_DEBUG.renderAll(); return false; } catch (e) { return true; }
  });
  check('【注入】sanitize を通さない壊れた日付は描画で例外になる（＝入口の検疫が要る証拠）', !threw);
}

await browser.close(); server.close();
console.log(`\n==> verify-oshikatsu: ${pass} 項目 ✅ / ${fail} 項目 ❌`);
process.exit(fail ? 1 : 0);
