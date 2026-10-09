#!/usr/bin/env node
/*
 * verify-oshikatsu.mjs — 推し活ログ（oshikatsu.html）の必須チェック（Pro のライセンス・レポート画像を含む）
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
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { signKey } from './oshi-license.mjs';

const PAGE = 'oshikatsu.html';
const INJECT = process.argv.includes('--inject');
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : '';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

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
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [], missing = [], external = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
// 検査自身の reload で中断された自オリジンの取得（ERR_ABORTED）は、実体が在るときだけ除外する（無いファイルは従来どおりFAIL）
page.on('requestfailed', (r) => {
  if (!r.url().startsWith(BASE)) { external.push(r.url()); return; }
  const f = path.join(ROOT, decodeURIComponent(new URL(r.url()).pathname).replace(/^\//, ''));
  if (/ERR_ABORTED/.test(r.failure()?.errorText || '') && fs.existsSync(f)) return;
  missing.push('failed ' + r.url());
});
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
check('入力した文字列から img 要素が生成されていない（注入した src="x" / onerror の img が無い）', (await page.locator('img[src="x"], img[onerror]').count()) === 0);
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
  const hp = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await hp.addInitScript(() => { window.__OSHI_TEST = true; });
  await hp.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
  await hp.evaluate(() => localStorage.clear()); await hp.reload({ waitUntil: 'load' });
  await hp.click('#btn-onb-sample');
  for (let i = 0; i < 4; i++) await hp.evaluate(() => window.OSHI_DEBUG.renderAll());
  const hs = await hp.evaluate(() => ['chart-category', 'chart-monthly'].map((id) => document.getElementById(id).getBoundingClientRect().height));
  check('dpr2で何度再描画してもCanvasの高さが変わらない（140/240px）', Math.round(hs[0]) === 140 && Math.round(hs[1]) === 240, `高さ=${hs.map(Math.round)}`);
  await hp.close();
}

console.log('\n── 10b. アイコン（写真アップロード・初期キャラ）──');
{
  const ap = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const aerr = []; ap.on('pageerror', (e) => aerr.push(e.message));
  const reqs = []; ap.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !/fonts\.(googleapis|gstatic)/.test(r.url())) reqs.push(r.url()); });
  await ap.addInitScript(() => { window.__OSHI_TEST = true; });
  await ap.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
  await ap.evaluate(() => localStorage.clear()); await ap.reload({ waitUntil: 'load' });
  await ap.click('#btn-onb-sample'); await ap.waitForTimeout(300);
  const loaded = await ap.evaluate(() => Promise.all([...document.querySelectorAll('#oshi-strip .avatar img')].map((i) => i.complete ? i.naturalWidth : new Promise((r) => { i.onload = () => r(i.naturalWidth); i.onerror = () => r(0); }))));
  check('サンプルの初期キャラ画像が実際に読み込まれる（naturalWidth>0）', loaded.length === 2 && loaded.every((w) => w > 0), `幅=${loaded}`);
  await ap.click('#tab-oshi');
  check('フォームに初期キャラの選択肢が5体出る', (await ap.locator('#preset-row button').count()) === 5);
  await ap.click('#preset-row button:nth-child(3)'); await ap.fill('#oshi-name', '新しい推し'); await ap.click('#oshi-submit');
  check('初期キャラを選んで保存できる', (await ap.evaluate(() => window.OSHI_DEBUG.getState().oshiList.find((o) => o.name === '新しい推し').avatar)) === 'preset:haru');
  // 写真: 600x400 の画像を作って流し込む
  const png = await ap.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 600, 400); g.addColorStop(0, '#f0f'); g.addColorStop(1, '#0ff'); x.fillStyle = g; x.fillRect(0, 0, 600, 400); return c.toDataURL('image/png').split(',')[1]; });
  await ap.fill('#oshi-name', '写真の推し');
  await ap.setInputFiles('#file-photo', { name: 'me.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await ap.waitForFunction(() => document.querySelector('#icon-preview img'), null, { timeout: 4000 }).catch(() => {});
  check('写真を選ぶとプレビューに反映される', (await ap.locator('#icon-preview img').count()) === 1);
  await ap.click('#oshi-submit');
  const photo = await ap.evaluate(() => window.OSHI_DEBUG.getState().oshiList.find((o) => o.name === '写真の推し').avatar);
  const dim = await ap.evaluate((u) => new Promise((r) => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.onerror = () => r([0, 0]); i.src = u; }), photo);
  check('写真は端末内で正方形(192px)に縮小され、データURLで保存される', /^data:image\/(webp|jpeg);base64,/.test(photo) && dim[0] === 192 && dim[1] === 192, `寸法=${dim}`);
  check('縮小後のサイズが上限（90KB）に収まる', photo.length <= 90000, `長さ=${photo.length}`);
  check('アップロードで外部への通信が発生しない（端末内だけで完結）', reqs.length === 0, reqs.slice(0, 2).join(' | '));
  check('一覧とダッシュボードに写真のアバターが出る', (await ap.locator('#list-oshi img[src^="data:image"]').count()) === 1);
  const evil = await ap.evaluate(() => { const v = window.OSHI_DEBUG.validAvatar; return [v('javascript:alert(1)'), v('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), v('preset:evil'), v('https://example.com/x.png'), v('data:image/png;base64,' + 'A'.repeat(95000)), v('preset:sakura')]; });
  check('不正なアバター（javascript:・SVG・未知プリセット・外部URL・巨大データ）を拒否し、正規のプリセットだけ通す', evil.slice(0, 5).every((x) => x === '') && evil[5] === 'preset:sakura', JSON.stringify(evil.map((x) => x.slice(0, 12))));
  // 画像が読めない端末でも頭文字に戻る（壊れた画像アイコンを出さない）
  await ap.route('**/assets/oshikatsu/*', (r) => r.abort());
  await ap.reload({ waitUntil: 'load' }); await ap.waitForTimeout(400);
  const fb = await ap.evaluate(() => { const a = document.querySelector('#oshi-strip .avatar'); return a ? { img: a.querySelectorAll('img').length, text: a.textContent } : null; });
  check('初期キャラ画像が読めないときは頭文字のアバターに戻る', fb && fb.img === 0 && fb.text.length >= 1, JSON.stringify(fb));
  check('アイコン処理で例外が出ない', aerr.length === 0, aerr.slice(0, 2).join(' | '));
  await ap.close();
}

console.log('\n── 10c. イベントリサーチ（Worker はモック・実ネットワークは使わない）──');
{
  const WORKER = 'https://ai-proxy.hi-fukasawa77.workers.dev';
  const mk = async (seed, opts = {}) => {
    const pg = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
    const log = { reqs: [], errs: [] };
    pg.on('pageerror', (e) => log.errs.push(e.message));
    await pg.addInitScript(() => { window.__OSHI_TEST = true; });
    if (opts.blockModule) await pg.route('**/assets/js/oshi-research.js*', (r) => r.abort());
    await pg.route(WORKER + '/**', async (route) => {
      const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      log.reqs.push(req.postData());
      const h = pg._handler || ((r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, results: [] }) }));
      return h(route, cors);
    });
    await pg.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
    await pg.evaluate((x) => { localStorage.clear(); if (x) localStorage.setItem('oshikatsu_log_v1', x); }, seed || null);
    await pg.reload({ waitUntil: 'load' });
    pg._log = log; return pg;
  };
  const json = (route, cors, body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const seed = JSON.stringify({
    oshiList: [{ id: 'o1', name: 'さくらすと', color: '#f472b6' }],
    expenses: [{ id: 'x1', date: day(0), oshiId: 'o1', category: 'グッズ', amount: 7777, memo: '秘密のメモ' }],
    events: [{ id: 'e1', date: day(30), oshiId: 'o1', name: '登録済みのライブ', venue: '横浜アリーナ' }],
  });
  const items = [
    { title: 'さくらすと 全国ツアー追加公演', date: day(30), venue: '横浜アリーナ', kind: 'live', url: 'https://example.com/a', source: 'ORICON NEWS' },   // 登録済みの予定と同じ日・同じ会場
    { title: 'さくらすと 大阪公演決定', date: day(40), venue: '大阪城ホール', kind: 'live', url: 'https://example.com/b', source: 'ナタリー' },
    { title: 'さくらすと 新アルバム発売', date: day(20), venue: '', kind: 'release', url: 'https://example.com/c', source: 'ORICON NEWS' },
    { title: 'さくらすと FC先行受付開始', date: day(10), venue: '', kind: 'ticket', url: 'https://example.com/d', source: 'FC' },
    { title: 'さくらすと 日付の読めない記事', date: '', venue: 'Zepp Tokyo', kind: 'event', url: 'https://example.com/e', source: 'Walker' },
    { title: '<img src=x onerror=window.__rx=1>さくらすと', date: day(50), venue: '', kind: 'bogus', url: 'javascript:alert(1)', source: '<b>悪意</b>' },
    { title: 'さくらすと 終わった公演', date: day(-5), venue: '', kind: 'live', url: 'https://example.com/old', source: 'X' },
  ];
  const ok = (route, cors) => json(route, cors, { ok: true, results: [{ name: 'さくらすと', items }] });

  const rp = await mk(seed); rp._handler = ok;
  await rp.click('#tab-research');
  check('通信の同意文（推しの名前だけを送る）が検索ボタンの近くに出ている', (await rp.textContent('#rs-privacy')).includes('推しの名前') && (await rp.textContent('#rs-privacy')).includes('記録は送りません'));
  check('自分で探すリンクが6本・https・別タブ・noopener', await rp.evaluate(() => { const a = [...document.querySelectorAll('#rs-links a')]; return a.length === 6 && a.every((x) => x.href.startsWith('https://') && x.target === '_blank' && /noopener/.test(x.rel)); }));
  await rp.selectOption('#rs-oshi', 'o1'); await rp.click('#btn-rs-search');
  await rp.waitForSelector('#list-research .item', { timeout: 5000 });
  const body0 = JSON.parse(rp._log.reqs[0]);
  check('送信するのは推しの名前だけ（出費・メモ・金額・予定を含まない）', JSON.stringify(Object.keys(body0)) === '["names"]' && body0.names.join() === 'さくらすと' && !rp._log.reqs[0].includes('秘密のメモ') && !rp._log.reqs[0].includes('7777'));
  const st1 = await rp.evaluate(() => window.OSHI_DEBUG.getState().research);
  check('終わった公演は取り込まない', !st1.some((r) => r.title.includes('終わった')));
  check('すでに予定にある公演（同じ日・同じ会場）は新着にせず追加済みで紐付く', (() => { const r = st1.find((x) => x.title.includes('追加公演')); return r && r.status === 'added' && r.eventId === 'e1'; })());
  check('新着は5件（未対応）。タブとヘッダーにバッジが出る', (await rp.textContent('#cnt-research')) === '5' && await rp.isVisible('#cnt-research'));
  check('XSS: 見出しの <img onerror> は文字として表示され実行されない', (await rp.evaluate(() => window.__rx)) === undefined && (await rp.locator('img[src="x"], img[onerror]').count()) === 0);
  check('javascript: のURLは捨てられ、出典リンクは https のみ・別タブ・noopener', await rp.evaluate(() => { const a = [...document.querySelectorAll('#list-research a.src-link')]; return a.length >= 4 && a.every((x) => /^https:/.test(x.href) && x.target === '_blank' && /noopener/.test(x.rel) && /noreferrer/.test(x.rel)) && ![...document.querySelectorAll('a')].some((x) => /^javascript:/i.test(x.getAttribute('href') || '')); }));
  check('不正な種別は「その他」に落ちる', st1.find((r) => r.title.includes('onerror')).kind === 'other');
  check('ニュース由来の候補に「要確認」の注意書きが付く', (await rp.locator('#list-research .caution').count()) >= 5);
  const upText = await rp.evaluate(() => { document.getElementById('tab-dashboard').click(); return document.getElementById('up-list').textContent; });
  check('ダッシュボードの「これから」に新着候補の案内が出る', upText.includes('新しいイベント候補が 5 件'));
  await rp.click('#tab-research');

  // 予定に追加（日付あり）
  const before = (await rp.evaluate(() => window.OSHI_DEBUG.getState().events.length));
  await rp.locator('#list-research .item', { hasText: '大阪公演決定' }).locator('button:has-text("予定に追加")').click();
  const ev1 = await rp.evaluate(() => { const s = window.OSHI_DEBUG.getState(); return { n: s.events.length, e: s.events.find((e) => e.name.includes('大阪公演')), r: s.research.find((r) => r.title.includes('大阪公演')) }; });
  check('「予定に追加」で参戦予定になり、会場・出典リンクが引き継がれ、候補は追加済みになる', ev1.n === before + 1 && ev1.e && ev1.e.venue === '大阪城ホール' && ev1.e.url === 'https://example.com/b' && ev1.e.date === day(40) && ev1.r.status === 'added' && ev1.r.eventId === ev1.e.id);
  await rp.click('.toast-btn');
  check('「元に戻す」で予定も候補の状態も元に戻る', (await rp.evaluate(() => { const s = window.OSHI_DEBUG.getState(); return s.events.length === 1 && s.research.find((r) => r.title.includes('大阪公演')).status === 'new'; })));
  await rp.locator('#list-research .item', { hasText: '大阪公演決定' }).locator('button:has-text("予定に追加")').click();
  await rp.click('#tab-events');
  check('参戦タブに追加した予定と🔗リンクが出る', (await rp.locator('#list-upcoming', { hasText: '大阪公演決定' }).count()) === 1 && (await rp.locator('#list-upcoming a.src-link').count()) >= 1);
  check('ICSに出典URLが入る', (await rp.evaluate(() => window.OSHI_DEBUG.buildICS())).includes('URL:https://example.com/b'));
  await rp.click('#tab-research');
  // 発売 → ほしい物 / チケット → 応募中
  await rp.locator('#list-research .item', { hasText: '新アルバム発売' }).locator('button:has-text("ほしい物へ")').click();
  const w = await rp.evaluate(() => window.OSHI_DEBUG.getState().wishes);
  check('「発売」の候補はほしい物リストへ（参戦予定にしない）。出典リンク付き', w.length === 1 && w[0].name.includes('新アルバム') && w[0].url === 'https://example.com/c' && w[0].memo.includes('発売予定'));
  await rp.locator('#list-research .item', { hasText: 'FC先行受付' }).locator('button:has-text("応募中で追加")').click();
  check('「チケット先行」の候補は応募中として追加される', (await rp.evaluate(() => window.OSHI_DEBUG.getState().events.find((e) => e.name.includes('FC先行')).status)) === 'applied');
  // 日付不明 → 編集して追加
  check('日付が読めない候補には「予定に追加」ではなく「編集して追加」だけが出る', (await rp.locator('#list-research .item', { hasText: '日付の読めない記事' }).locator('button:has-text("予定に追加")').count()) === 0);
  await rp.locator('#list-research .item', { hasText: '日付の読めない記事' }).locator('button:has-text("編集して追加")').click();
  check('「編集して追加」で参戦フォームに題名・会場・リンクが入り、日付は空（確認してから保存）', await rp.isVisible('#page-events') && (await rp.inputValue('#ev-name')).includes('日付の読めない記事') && (await rp.inputValue('#ev-venue')) === 'Zepp Tokyo' && (await rp.inputValue('#ev-url')) === 'https://example.com/e' && (await rp.inputValue('#ev-date')) === '');
  await rp.fill('#ev-date', day(60)); await rp.click('#ev-submit');
  const r5 = await rp.evaluate(() => { const s = window.OSHI_DEBUG.getState(); const r = s.research.find((x) => x.title.includes('日付の読めない')); return { st: r.status, ev: s.events.find((e) => e.id === r.eventId) }; });
  check('フォームで保存すると候補が追加済みになり、予定と紐付く', r5.st === 'added' && r5.ev && r5.ev.url === 'https://example.com/e');
  // 予定を消すと候補は未対応へ戻る
  await rp.click('#tab-events');
  await rp.locator('#list-upcoming .item', { hasText: '日付の読めない記事' }).locator('.act.del').click();
  check('予定を削除すると、紐付いた候補は未対応に戻る（提案が消えたままにならない）', (await rp.evaluate(() => window.OSHI_DEBUG.getState().research.find((x) => x.title.includes('日付の読めない')).status)) === 'new');
  // 無視 / 戻す
  await rp.click('#tab-research');
  await rp.locator('#list-research .item', { hasText: '日付の読めない記事' }).locator('button:has-text("無視")').click();
  check('「無視」で一覧から消え、「無視した候補」の絞り込みに出る', (await rp.locator('#list-research .item', { hasText: '日付の読めない記事' }).count()) === 0 && (await rp.evaluate(() => { document.getElementById('rs-f-status').value = 'hidden'; document.getElementById('rs-f-status').dispatchEvent(new Event('change')); return document.getElementById('list-research').textContent.includes('日付の読めない記事'); })));
  await rp.selectOption('#rs-f-status', 'new');
  // 再検索: 重複を足さない
  const nBefore = await rp.evaluate(() => window.OSHI_DEBUG.getState().research.length);
  await rp.click('#btn-rs-search'); await rp.waitForFunction(() => /調べました|重複/.test(document.getElementById('rs-status').textContent), null, { timeout: 5000 });
  check('もう一度調べても重複を足さない（同じ候補を増やさない）', (await rp.evaluate(() => window.OSHI_DEBUG.getState().research.length)) === nBefore, (await rp.textContent('#rs-status')).slice(0, 60));
  check('検索中でない間は検索ボタンが押せる（連打ロックが残らない）', await rp.isEnabled('#btn-rs-search'));
  // 失敗時: 理由と次の一手が残る
  const fails = [[429, 'HTTP 429'], [502, 'HTTP 502'], [404, 'まだ有効になっていない'], [500, 'HTTP 500']];
  let failOk = true; const failDet = [];
  for (const [code, want] of fails) {
    rp._handler = (route, cors) => json(route, cors, { error: 'x' }, code);
    await rp.evaluate(() => { document.getElementById('rs-status').textContent = ''; }); await rp.click('#btn-rs-search');
    await rp.waitForFunction(() => /HTTP|有効|通信|時間/.test(document.getElementById('rs-status').textContent), null, { timeout: 5000 });
    const t = await rp.textContent('#rs-status'); if (!t.includes(want)) { failOk = false; failDet.push(code + ':' + t.slice(0, 40)); }
  }
  check('失敗（429/502/404/500）ごとに、原因と次の一手（リンク・貼り付け）が画面に残る', failOk, failDet.join(' | '));
  rp._handler = (route) => route.abort('failed');
  await rp.evaluate(() => { document.getElementById('rs-status').textContent = ''; }); await rp.click('#btn-rs-search');
  await rp.waitForFunction(() => /通信できませんでした/.test(document.getElementById('rs-status').textContent), null, { timeout: 5000 });
  check('通信不能（オフライン）でも例外を出さず、案内を出して操作可能に戻る', rp._log.errs.length === 0 && await rp.isEnabled('#btn-rs-search'), rp._log.errs.join('|'));
  rp._handler = (route, cors) => json(route, cors, { foo: 1 });
  await rp.evaluate(() => { document.getElementById('rs-status').textContent = ''; }); await rp.click('#btn-rs-search');
  await rp.waitForFunction(() => document.getElementById('rs-status').textContent.length > 0 && !document.getElementById('btn-rs-search').disabled, null, { timeout: 5000 });
  check('想定外の応答（results が無い）でも壊れない', rp._log.errs.length === 0);
  // 貼り付け: 通信なし
  const reqsBefore = rp._log.reqs.length;
  await rp.fill('#rs-paste', 'さくらすと LIVE TOUR\n' + `${new Date(Date.now() + 90 * 864e5).getFullYear()}年${new Date(Date.now() + 90 * 864e5).getMonth() + 1}月${new Date(Date.now() + 90 * 864e5).getDate()}日 Zepp Nagoya\n\n2020/1/1 昔のライブ`);
  await rp.click('#btn-rs-paste');
  const pst = await rp.evaluate(() => window.OSHI_DEBUG.getState().research.filter((r) => r.found === 'paste'));
  check('貼り付けから候補を取り出せる（出典は「貼り付け」・過去日付は取り込まない）・通信しない', pst.length === 1 && pst[0].venue === 'Zepp Nagoya' && rp._log.reqs.length === reqsBefore);
  await rp.fill('#rs-paste', 'こんにちは'); await rp.click('#btn-rs-paste');
  check('日付が無い文章は、取り込まず理由を表示する', (await rp.textContent('#rs-status')).includes('日付を読み取れませんでした'));
  // 永続化
  await rp.reload({ waitUntil: 'load' });
  check('リサーチ結果は再読込しても残る', (await rp.evaluate(() => window.OSHI_DEBUG.getState().research.length)) >= 5);
  check('リサーチ操作で例外が出ない', rp._log.errs.length === 0, rp._log.errs.slice(0, 2).join(' | '));
  await rp.close();

  // 壊れた/悪意ある保存データ
  const evilSeed = JSON.stringify({ oshiList: [{ id: 'o1', name: 'A' }], research: [
    { id: 'r1', oshiId: 'o1', title: 'ok', date: '2999-01-01', kind: 'live', url: 'javascript:alert(1)', status: 'new' },
    { id: 'r2', oshiId: 'GONE', title: 'x'.repeat(5000), date: 'ぬるぽ', kind: {}, url: 'data:text/html,x', status: 'hacked', eventId: 'nope' },
    { id: 'r3', title: '   ' }, null, 5, { title: 123 },
  ] });
  const ep = await mk(evilSeed);
  const es = await ep.evaluate(() => window.OSHI_DEBUG.getState().research);
  check('保存データの候補を検疫（危険なURL・長すぎる文字・不正な日付/状態/参照を落とし、空の候補は捨てる）', es.length === 2 && es.every((r) => r.url === '' && r.title.length <= 120 && ['new', 'added', 'hidden'].includes(r.status)) && es[1].date === '' && es[1].oshiId === '' && es[1].eventId === '', JSON.stringify(es.map((r) => [r.url, r.status, r.date])));
  check('壊れた候補があっても起動して例外が出ない', ep._log.errs.length === 0);
  await ep.close();

  // 共用モジュールが読めなくても、保存済みの候補を失わない
  const bp = await mk(JSON.stringify({ oshiList: [{ id: 'o1', name: 'A' }], research: [{ id: 'r1', oshiId: 'o1', title: '保存済みの候補', date: '2999-01-01', kind: 'live', url: 'https://example.com/z', status: 'new', foundAt: day(0) }] }), { blockModule: true });
  await bp.click('#tab-settings'); await bp.fill('#budget-input', '12345'); await bp.click('#form-budget button[type="submit"]');
  const kept = await bp.evaluate(() => JSON.parse(localStorage.getItem('oshikatsu_log_v1')).research);
  check('共用スクリプトが読み込めない端末でも、別の操作の保存で候補が消えない（データ消失防止）', kept.length === 1 && kept[0].title === '保存済みの候補');
  await bp.click('#tab-research'); await bp.click('#btn-rs-search');
  check('その場合の検索は、例外ではなく案内を出す', (await bp.textContent('#rs-status')).includes('読み込めませんでした') && bp._log.errs.length === 0, bp._log.errs.join('|'));
  await bp.close();
}

console.log('\n── 10d. 聖地巡礼 ──');
{
  const sp = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const serrs = []; sp.on('pageerror', (e) => serrs.push(e.message));
  const outReqs = []; sp.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !/fonts\.(googleapis|gstatic)/.test(r.url())) outReqs.push(r.url()); });
  await sp.addInitScript(() => { window.__OSHI_TEST = true; });
  await sp.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
  await sp.evaluate(() => localStorage.clear());
  await sp.reload({ waitUntil: 'load' });
  await sp.evaluate(() => { const d = window.OSHI_DEBUG; d.setState({ oshiList: [{ id: 'o1', name: 'さくらすと', color: '#f472b6' }], events: [{ id: 'e1', date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), oshiId: 'o1', name: '横浜ライブ' }] }); });
  const dbgv = (fn, ...a) => sp.evaluate(([f, args]) => (new Function('d', 'a', 'return (' + f + ')(d, ...a)'))(window.OSHI_DEBUG, args), [fn.toString(), a]);
  const P = await dbgv((d) => d.PREFS);
  check('タイルマップ: 47都道府県・名前も座標も重複なし・11×11の盤内', P.length === 47 && new Set(P.map((p) => p[0])).size === 47 && new Set(P.map((p) => p[1] + ',' + p[2])).size === 47 && P.every((p) => p[1] >= 0 && p[1] <= 10 && p[2] >= 0 && p[2] <= 10));
  check('都道府県の読み取り: 東京都/京都府/大阪府/北海道/神奈川県/鹿児島県', await dbgv((d) => ['東京都渋谷区', '京都府京都市', '大阪府大阪市', '北海道札幌市', '神奈川県横浜市', '鹿児島県鹿児島市'].map(d.inferPref).join()) === '東京,京都,大阪,北海道,神奈川,鹿児島');
  check('都道府県の読み取り: 県名が無ければ空（「ホテル京都」を京都府にしない）', await dbgv((d) => d.inferPref('ホテル京都') + d.inferPref('') + d.inferPref('渋谷')) === '');
  check('座標: Googleマップ URL（@ / !3d!4d / ?q=）と「lat, lng」を読み取る', await dbgv((d) => [d.parseCoords('https://www.google.com/maps/place/x/@35.6586,139.7454,17z'), d.parseCoords('…!3d34.6937!4d135.5023'), d.parseCoords('https://maps.google.com/?q=35.01,135.76'), d.parseCoords(' 35.68, 139.76 ')].map((c) => c && c.lat.toFixed(2)).join()) === '35.66,34.69,35.01,35.68');
  check('座標: 範囲外・数字でない文字列は null', await dbgv((d) => [d.parseCoords('@99.1,139.1'), d.parseCoords('@35.1,999.1'), d.parseCoords('渋谷'), d.parseCoords(null)].every((c) => c === null)));
  check('距離: 東京→大阪は約400km', await dbgv((d) => { const k = d.haversine({ lat: 35.68, lng: 139.76 }, { lat: 34.69, lng: 135.50 }); return k > 390 && k < 410; }));
  const ru = await dbgv((d) => d.routeUrl(Array.from({ length: 12 }, (_, i) => ({ name: '場所' + i, address: '', lat: null, lng: null }))));
  check('ルートURL: Googleマップ・最後が目的地・経由地は最大9件・全てエンコード', ru.startsWith('https://www.google.com/maps/dir/?api=1&destination=') && ru.includes(encodeURIComponent('場所11')) && decodeURIComponent(ru.split('waypoints=')[1].split('&')[0]).split('|').length === 9 && !/[ |]/.test(ru));

  await sp.click('#tab-spots');
  check('巡礼タブにタイルマップが47枚出る', (await sp.locator('#sp-map .pref-tile').count()) === 47);
  await sp.fill('#sp-name', 'ロケ地の神社'); await sp.fill('#sp-work', '◯◯（アニメ）'); await sp.selectOption('#sp-type', '聖地');
  await sp.fill('#sp-address', '東京都渋谷区神南1-1'); await sp.fill('#sp-url', 'https://www.google.com/maps/place/x/@35.6586,139.7454,17z'); await sp.selectOption('#sp-event', 'e1'); await sp.click('#sp-submit');
  let st = await dbgv((d) => d.getState().spots);
  check('スポットを追加: 住所から都道府県、地図URLから座標、関連する参戦を保存', st.length === 1 && st[0].pref === '東京' && Math.abs(st[0].lat - 35.6586) < 1e-6 && st[0].eventId === 'e1' && st[0].status === 'want');
  check('タイルマップの東京が「行きたいあり」（点線）になり、サマリーが更新される', (await sp.locator('#sp-map .pref-tile.want', { hasText: '東京' }).count()) === 1 && (await sp.textContent('#sp-summary')).includes('行きたい 1 か所'));
  await sp.fill('#sp-name', 'ロケ地の神社'); await sp.fill('#sp-address', '東京都港区'); await sp.click('#sp-submit');
  check('同じ名前・同じ県のスポットは二重登録できない', (await dbgv((d) => d.getState().spots.length)) === 1);
  await sp.fill('#sp-name', '怪しいリンク'); await sp.fill('#sp-url', 'javascript:alert(1)'); await sp.click('#sp-submit');
  check('javascript: のリンクは保存を拒否してメッセージを出す', (await dbgv((d) => d.getState().spots.length)) === 1 && (await sp.textContent('#toast')).includes('https://'));
  await sp.fill('#sp-url', ''); await sp.fill('#sp-name', '<img src=x onerror=window.__sx=1>'); await sp.fill('#sp-address', '大阪府大阪市'); await sp.click('#sp-submit');
  check('XSS: スポット名の <img onerror> は文字として表示され実行されない', (await sp.evaluate(() => window.__sx)) === undefined && (await sp.locator('img[src="x"]').count()) === 0 && (await sp.textContent('#list-spots')).includes('<img src=x'));
  check('地図リンクは https・別タブ・noopener', await sp.evaluate(() => { const a = [...document.querySelectorAll('#list-spots a.src-link')]; return a.length >= 2 && a.every((x) => /^https:\/\/www\.google\.com\/maps\/search/.test(x.href) && x.target === '_blank' && /noopener/.test(x.rel)); }));
  // 行った！
  await sp.locator('#list-spots .item', { hasText: 'ロケ地の神社' }).locator('button:has-text("行った！")').click();
  check('「行った！」でタイルが色づき（✓1）、制覇が 1/47 になる', (await sp.locator('#sp-map .pref-tile.v1', { hasText: '東京' }).count()) === 1 && (await sp.textContent('#sp-summary')).includes('制覇 1 / 47'));
  await sp.click('.toast-btn');
  check('「元に戻す」で行きたいへ戻る', (await dbgv((d) => d.getState().spots.find((p) => p.name === 'ロケ地の神社').status)) === 'want');
  await sp.locator('#list-spots .item', { hasText: 'ロケ地の神社' }).locator('button:has-text("行った！")').click();
  // 費用
  await sp.locator('#list-spots .item', { hasText: 'ロケ地の神社' }).locator('button[aria-label*="費用"]').click();
  check('💸で出費フォームへ（遠征・交通・メモ・巡礼スポットが入る）', await sp.isVisible('#page-expenses') && (await sp.inputValue('#exp-cat')) === '遠征・交通' && (await sp.inputValue('#exp-memo')).includes('ロケ地の神社') && (await sp.inputValue('#exp-spot')) !== '');
  await sp.fill('#exp-amount', '3200'); await sp.click('#exp-submit');
  check('出費が巡礼スポットに紐付き、一覧に🗺バッジが出る', (await dbgv((d) => d.getState().expenses.some((x) => x.amount === 3200 && x.spotId))) && (await sp.locator('#list-expenses .badge', { hasText: '🗺' }).count()) === 1);
  await sp.click('#tab-spots');
  check('スポットのカードに「この巡礼の費用 ¥3,200」が出る', (await sp.textContent('#list-spots')).includes('この巡礼の費用 ¥3,200'));
  await sp.click('#tab-events');
  check('参戦カードに関連する聖地巡礼（✓つき）が出る', (await sp.textContent('#list-upcoming')).includes('聖地巡礼: ロケ地の神社✓'));
  await sp.click('#tab-dashboard');
  check('ダッシュボードに巡礼パネル（訪問1/2・制覇）が出る', await sp.isVisible('#panel-spots-dash') && (await sp.textContent('#spd-label')).includes('訪問 1 / 2') && (await sp.textContent('#spd-pref')).includes('制覇 1 / 47'));
  await sp.click('#tab-spots');
  // 県で絞り込み
  await sp.click('#sp-map .pref-tile:has-text("東京")');
  check('県のタイルをタップするとその県だけに絞り込まれ、解除ボタンが出る', (await sp.locator('#list-spots .item').count()) === 1 && await sp.isVisible('#btn-sp-pref-clear'));
  await sp.click('#btn-sp-pref-clear');
  check('解除で全件に戻る', (await sp.locator('#list-spots .item').count()) === 2);
  // ルート
  await sp.evaluate(() => { window.__opened = []; window.open = (u, t, f) => { window.__opened.push([u, t, f]); return null; }; });
  check('チェックが無い間はルートボタンが押せない', !(await sp.isEnabled('#btn-sp-route')));
  await sp.locator('#list-spots .sp-sel input').nth(0).check(); await sp.locator('#list-spots .sp-sel input').nth(1).check();
  check('2か所を選ぶとルートボタンが有効になり件数が出る', (await sp.isEnabled('#btn-sp-route')) && (await sp.textContent('#btn-sp-route')).includes('2 か所'));
  await sp.click('#btn-sp-route');
  const op = await sp.evaluate(() => window.__opened);
  check('ルートはGoogleマップを noopener で別タブに開くだけ（目的地・経由地つき）', op.length === 1 && op[0][0].startsWith('https://www.google.com/maps/dir/?api=1&destination=') && /noopener/.test(op[0][2]) && op[0][1] === '_blank' && op[0][0].includes('waypoints='));
  // 削除すると費用は残る
  await sp.locator('#list-spots .item', { hasText: 'ロケ地の神社' }).locator('.act.del').click();
  check('スポットを消しても出費は消えず、紐付けだけ外れる', await dbgv((d) => { const s = d.getState(); return s.spots.length === 1 && s.expenses.some((x) => x.amount === 3200 && x.spotId === ''); }));
  await sp.click('.toast-btn');
  check('「元に戻す」でスポットも出費の紐付けも戻る', await dbgv((d) => { const s = d.getState(); return s.spots.length === 2 && s.expenses.some((x) => x.amount === 3200 && x.spotId); }));
  // リサーチ候補 → スポット
  await sp.evaluate(() => window.OSHI_DEBUG.mergeResearch('o1', [{ title: '大阪府で期間限定コラボカフェ開催', date: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10), venue: 'ポップアップカフェ梅田', kind: 'event', url: 'https://example.com/cafe', source: 'ナタリー' }], 'web') && (window.OSHI_DEBUG.renderAll()));
  await sp.click('#tab-research');
  await sp.locator('#list-research .item', { hasText: 'コラボカフェ' }).locator('button:has-text("巡礼スポットへ")').click();
  const cs = await dbgv((d) => { const s = d.getState(); return { sp: s.spots.find((p) => p.name === 'ポップアップカフェ梅田'), r: s.research[0] }; });
  check('リサーチ候補のイベントを「巡礼スポットへ」追加（種別・県・出典・開催日つき）、候補は追加済み', cs.sp && cs.sp.type === 'カフェ・コラボ' && cs.sp.pref === '大阪' && cs.sp.url === 'https://example.com/cafe' && cs.sp.memo.includes('開催') && cs.r.status === 'added');
  // イベント削除
  await sp.click('#tab-events'); await sp.locator('#list-upcoming .item', { hasText: '横浜ライブ' }).locator('.act.del').click();
  check('参戦を消すと、スポットの関連付けだけ外れてスポットは残る', await dbgv((d) => { const s = d.getState(); return s.spots.find((p) => p.name === 'ロケ地の神社') && s.spots.find((p) => p.name === 'ロケ地の神社').eventId === ''; }));
  // CSV・バックアップ
  check('CSVの数式インジェクション対策が巡礼にも効く（先頭 = の名前）', await dbgv((d) => d.csvCell('=HYPERLINK("x")')) === `"'=HYPERLINK(""x"")"`);
  const bk = await dbgv((d) => JSON.parse(JSON.stringify(d.getState())));
  await dbgv((d) => { d.setState({}); });
  await dbgv((d, b) => d.importData(b, 'merge'), bk);
  check('バックアップのマージ取り込みでスポットとリサーチ候補が戻る', await dbgv((d) => { const s = d.getState(); return s.spots.length === 3 && s.research.length === 1; }));
  // 悪意ある保存データ
  const evil = await dbgv((d) => d.sanitize({ oshiList: [{ id: 'o1', name: 'A' }], spots: [
    { id: 's1', name: 'ok', oshiId: 'GONE', type: 'hack', pref: '火星', lat: 999, lng: 10, url: 'javascript:1', prio: 99, status: 'visited', rating: 9, visitedDate: 'ぬるぽ', eventId: 'nope' },
    { id: 's2', name: 123 }, { id: 's3', name: '   ' }, null, 5, { name: 'ok2', lat: '35.1', lng: '139.1', status: 'weird' },
  ], expenses: [{ id: 'x', date: '2026-01-01', amount: 100, spotId: 'ghost' }] }));
  check('保存データのスポットを検疫（範囲外の座標・不正な種別/県/URL/評価/参照を落とし、非文字列・空の名前は捨てる）', evil.spots.length === 2 && evil.spots[0].lat === null && evil.spots[0].lng === null && evil.spots[0].type === 'その他' && evil.spots[0].pref === '' && evil.spots[0].url === '' && evil.spots[0].prio === 2 && evil.spots[0].rating === 0 && evil.spots[0].oshiId === '' && evil.spots[0].eventId === '' && evil.spots[0].visitedDate === '' && evil.spots[1].lat === 35.1 && evil.spots[1].status === 'want' && evil.expenses[0].spotId === '', JSON.stringify(evil.spots[0]));
  check('巡礼の操作で外部への通信が発生しない（地図は開くだけ）', outReqs.length === 0, outReqs.slice(0, 2).join(' | '));
  check('巡礼の操作で例外が出ない', serrs.length === 0, serrs.slice(0, 2).join(' | '));
  await sp.close();

  // 現在地（位置情報）: 許可あり・なし
  const gctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, geolocation: { latitude: 35.68, longitude: 139.76 }, permissions: ['geolocation'] });
  const gp = await gctx.newPage(); const greqs = []; gp.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !/fonts\.(googleapis|gstatic)/.test(r.url())) greqs.push(r.url()); });
  await gp.addInitScript(() => { window.__OSHI_TEST = true; });
  await gp.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' }); await gp.evaluate(() => localStorage.clear()); await gp.reload({ waitUntil: 'load' });
  await gp.evaluate(() => window.OSHI_DEBUG.setState({ spots: [
    { id: 'a', name: '大阪の遠いスポット', lat: 34.69, lng: 135.50, pref: '大阪' }, { id: 'b', name: '座標なしスポット' }, { id: 'c', name: '渋谷の近いスポット', lat: 35.66, lng: 139.70, pref: '東京' }, { id: 'd', name: '横浜のスポット', lat: 35.45, lng: 139.64, pref: '神奈川' } ] }));
  await gp.click('#tab-spots'); await gp.click('#btn-sp-near');
  await gp.waitForFunction(() => /近い順/.test(document.getElementById('toast').textContent));
  const order = await gp.locator('#list-spots .item-title span:first-child').allTextContents();
  check('「現在地から近い順」: 近い→遠い→座標なしの順に並び、距離(km)が出る', order.join() === '渋谷の近いスポット,横浜のスポット,大阪の遠いスポット,座標なしスポット' && (await gp.textContent('#list-spots')).includes('現在地から約'), order.join());
  check('位置情報は端末内の計算のみ（座標を含む通信・保存が無い）', greqs.length === 0 && !(await gp.evaluate(() => localStorage.getItem('oshikatsu_log_v1'))).includes('35.68') && !(await gp.evaluate(() => localStorage.getItem('oshikatsu_log_v1'))).includes('139.76'));
  await gp.close(); await gctx.close();
  // 位置情報の拒否・失敗: Playwright は許可の確認が未応答のまま残り「拒否」にならないため、エラー応答を差し込んで再現する
  const nctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const np = await nctx.newPage(); const nerr = []; np.on('pageerror', (e) => nerr.push(e.message));
  await np.addInitScript(() => { window.__OSHI_TEST = true; window.__geoCode = 1; navigator.geolocation.getCurrentPosition = (ok, ng) => setTimeout(() => ng({ code: window.__geoCode, message: 'x' }), 10); });
  await np.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' }); await np.click('#tab-spots');
  await np.click('#btn-sp-near'); await np.waitForFunction(() => /許可/.test(document.getElementById('toast').textContent), null, { timeout: 5000 });
  check('位置情報が拒否された端末では、許可の方法を案内する（例外にしない）', /許可/.test(await np.textContent('#toast')) && nerr.length === 0);
  await np.evaluate(() => { window.__geoCode = 2; }); await np.click('#btn-sp-near'); await np.waitForFunction(() => /取得できませんでした/.test(document.getElementById('toast').textContent), null, { timeout: 5000 });
  check('位置情報の取得に失敗したときは、時間をおく案内を出す', /取得できませんでした/.test(await np.textContent('#toast')) && nerr.length === 0);
  await np.close(); await nctx.close();
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
const mctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
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
await mp.evaluate(() => { const d = window.OSHI_DEBUG, st = d.getState(); st.spots = ['神奈川', '和歌山', '鹿児島', '北海道', '東京'].map((pf, i) => ({ id: 'sp' + i, name: pf + 'のスポット', pref: pf, status: i % 2 ? 'visited' : 'want', type: '聖地' })); d.setState(st); });
await mp.click('#btn-go-spots');
const overSp = await mp.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, tile: Math.round(document.querySelector('.pref-tile').getBoundingClientRect().width), mapR: Math.round(document.getElementById('sp-map').getBoundingClientRect().right), panelR: Math.round(document.getElementById('panel-sp-map').getBoundingClientRect().right) }));
check('巡礼タブ（390px）: 横溢れなし・マップがパネル内に収まる（3文字の県名で列が広がらない）', overSp.over <= 0 && overSp.mapR <= overSp.panelR && overSp.tile >= 24, JSON.stringify(overSp));
check('スマホではヘッダーの🗺から巡礼タブへ入れ、下部ナビには出ない', await mp.isVisible('#page-spots') && !(await mp.isVisible('#tab-spots')));
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

console.log('\n── 14. 推し活ログ Pro（ライセンス・レポート画像・メンカラ）──');
// 本番の公開鍵ではなく、検査のたびに作る使い捨ての鍵ペアで通す（秘密鍵をリポジトリに置かないため）
const OshiPro = createRequire(import.meta.url)('../assets/js/oshi-pro.js');
const sub = webcrypto.subtle;
const pair = await sub.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const other = await sub.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pubJwk = await sub.exportKey('jwk', pair.publicKey);
const goodKey = await signKey(pair.privateKey, { p: 'oshikatsu-pro', v: 1, lot: 'test', id: 'verify0001' });
const forgedKey = await signKey(other.privateKey, { p: 'oshikatsu-pro', v: 1, lot: 'test', id: 'verify0002' });
const wrongProduct = await signKey(pair.privateKey, { p: 'other-app', v: 1, lot: 'test', id: 'verify0003' });
const flip = (k) => { const i = k.indexOf('.') + 5; return k.slice(0, i) + (k[i] === 'A' ? 'B' : 'A') + k.slice(i + 1); };
// ブラウザ無しの純粋ロジック
check('Node: 正しいキーは有効・改行や全角スペース混じりの貼り付けも通る', (await OshiPro.verifyKey(goodKey, { jwk: pubJwk, subtle: sub })).ok && (await OshiPro.verifyKey('  ' + goodKey.slice(0, 40) + '\n　' + goodKey.slice(40), { jwk: pubJwk, subtle: sub })).ok);
check('Node: 1文字の改ざん・別の鍵で作ったキー・別製品のキーは無効', !(await OshiPro.verifyKey(flip(goodKey), { jwk: pubJwk, subtle: sub })).ok
  && (await OshiPro.verifyKey(forgedKey, { jwk: pubJwk, subtle: sub })).reason === 'signature' && (await OshiPro.verifyKey(wrongProduct, { jwk: pubJwk, subtle: sub })).reason === 'product');
check('Node: 失効IDは「署名が正しいときだけ」revoked と答える', (await OshiPro.verifyKey(goodKey, { jwk: pubJwk, subtle: sub, revoked: ['verify0001'] })).reason === 'revoked'
  && (await OshiPro.verifyKey(forgedKey, { jwk: pubJwk, subtle: sub, revoked: ['verify0002'] })).reason === 'signature');
check('Node: 空・長すぎ・ゴミはネットワークも暗号も使わず形式で弾く', (await OshiPro.verifyKey('', {})).reason === 'empty' && (await OshiPro.verifyKey('OSHI-PRO-' + 'A'.repeat(900), {})).reason === 'format' && (await OshiPro.verifyKey('<script>', {})).reason === 'format');
const lumHex = (h) => { const c = OshiPro.hexToRgb(h); return c; };
const worst = ['#fde047', '#a3e635', '#22d3ee', '#ffffff', '#f472b6', '#1e1b4b', '#000000'].reduce((m, h) => Math.min(m,
  OshiPro.contrast(lumHex(OshiPro.accentVars(h, false)['--accent']), [255, 255, 255]), OshiPro.contrast(lumHex(OshiPro.accentVars(h, true)['--accent']), [15, 23, 42])), 99);
check('Node: メンカラは黄色・白・黒の推し色でも文字として読める（コントラスト比4.5以上）', worst >= 4.5, `最小=${worst.toFixed(2)}`);

const proCtx = async (opts) => {
  const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => { errs.push('dialog:' + d.message()); d.accept(); });
  await p.addInitScript((o) => { window.__OSHI_TEST = true; if (o) window.__OSHI_PRO_TEST_OPTS = o; }, opts || null);
  if (opts && opts.route) await p.route('**/assets/js/oshi-pro.js*', opts.route);
  await p.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' });
  return { c, p, errs };
};
const canvasStats = (p) => p.evaluate(() => {
  const cv = document.getElementById('card-canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
  const band = cv.getContext('2d').getImageData(0, cv.height - 130, cv.width, 110).data; let ink = 0;
  for (let i = 0; i < band.length; i += 4) { const k = band[i] + band[i + 1] + band[i + 2]; if (k < 450) ink++; }
  return { colors: seen.size, w: cv.width, h: cv.height, bottomInk: ink };
});
const sampleData = async (p) => { await p.click('#btn-onb-sample'); await p.waitForTimeout(150); };

// 公開鍵が未設定の本番状態（販売前）
{
  const { c, p, errs } = await proCtx(null);
  await p.click('#tab-settings');
  check('販売前（公開鍵なし）: 「販売準備中」を出し、購入ボタンは出さない', await p.isVisible('#pro-soon') && !(await p.isVisible('#pro-buy')));
  await p.fill('#pro-key', goodKey); await p.click('#form-pro button[type=submit]'); await p.waitForTimeout(150);
  check('販売前: キーを入れても有効にならず理由を出す', (await p.textContent('#pro-msg')).includes('販売準備中') && !(await p.evaluate(() => window.OSHI_DEBUG.getPro().on)));
  check('販売前: 例外0件', errs.length === 0, errs.join(' | '));
  await c.close();
}

{
  const { c, p, errs } = await proCtx({ jwk: pubJwk });
  await sampleData(p);
  await p.click('#btn-card'); await p.waitForTimeout(250);
  let st = await canvasStats(p), last = await p.evaluate(() => window.OSHI_DEBUG.getCardLast());
  check('無料: 「画像で残す」でパネルが開き、カードが実際に描かれる（色数で判定）', await p.isVisible('#panel-card') && st.colors > 12 && st.w === 1080 && st.h === 1350, JSON.stringify(st));
  check('無料: アプリ名の透かしが入り、外せない（チェックは無効化）', last.watermark && await p.isDisabled('#card-mark') && await p.isChecked('#card-mark'));
  check('無料: 月のパステルは保存できる', !last.sample && !(await p.isDisabled('#card-save')));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#card-save')]);
  const png = fs.readFileSync(await dl.path());
  check('保存: PNG（シグネチャ）・ファイル名に年月・中身がある', png.slice(1, 4).toString() === 'PNG' && /^oshikatsu-\d{4}-\d{2}\.png$/.test(dl.suggestedFilename()) && png.length > 20000, `${dl.suggestedFilename()} ${png.length}B`);
  await p.selectOption('#card-tpl', 'night'); await p.waitForTimeout(100);
  last = await p.evaluate(() => window.OSHI_DEBUG.getCardLast());
  check('無料: Proのデザインは「SAMPLE」付きの見本になり、保存・共有できない', last.sample && last.tpl === 'night' && await p.isDisabled('#card-save') && await p.isDisabled('#card-share') && (await p.textContent('#card-note')).includes('Pro'));
  await p.selectOption('#card-tpl', 'pastel'); await p.click('.range-bar .seg button[data-mode="year"]'); await p.waitForTimeout(100);
  last = await p.evaluate(() => window.OSHI_DEBUG.getCardLast());
  check('無料: 年間まとめは見本のみ（期間の切替にカードが追随する）', last.sample && (await p.textContent('#card-period')).includes('年'));
  await p.click('.range-bar .seg button[data-mode="month"]');

  await p.click('#tab-settings');
  check('販売前でもURL未設定なら「準備中」（公開鍵だけあっても購入導線を出さない）', await p.isVisible('#pro-soon'));
  for (const [label, k, want] of [['1文字改ざん', flip(goodKey), '確認できません'], ['別の鍵で偽造', forgedKey, '確認できません'], ['別製品', wrongProduct, 'このアプリのキーではありません'], ['ゴミ', 'hello', '形式']]) {
    await p.fill('#pro-key', k); await p.click('#form-pro button[type=submit]'); await p.waitForTimeout(120);
    const r = await p.evaluate(() => ({ on: window.OSHI_DEBUG.getPro().on, saved: localStorage.getItem('oshikatsu_pro_v1'), msg: document.getElementById('pro-msg').textContent }));
    check(`無効なキー（${label}）: 有効にならず・保存もされず・理由が出る`, !r.on && r.saved === null && r.msg.includes(want), r.msg);
  }
  await p.fill('#pro-key', ' ' + goodKey + '\n'); await p.click('#form-pro button[type=submit]'); await p.waitForTimeout(150);
  let r = await p.evaluate(() => ({ on: window.OSHI_DEBUG.getPro().on, saved: localStorage.getItem('oshikatsu_pro_v1') }));
  check('正しいキー: Pro が有効になり、キーが保存され、入力欄が空になる', r.on && r.saved === goodKey && await p.isVisible('#pro-badge') && (await p.inputValue('#pro-key')) === '');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200);
  check('再読み込み後も Pro のまま（起動時に検証し直す）', await p.evaluate(() => window.OSHI_DEBUG.getPro().on));

  await p.click('#tab-dashboard'); await p.click('#btn-card'); await p.selectOption('#card-tpl', 'night'); await p.waitForTimeout(100);
  last = await p.evaluate(() => window.OSHI_DEBUG.getCardLast());
  check('Pro: Proのデザインがそのまま保存できる', !last.sample && last.tpl === 'night' && !(await p.isDisabled('#card-save')));
  await p.selectOption('#card-tpl', 'mono'); await p.waitForTimeout(80);
  const withMark = await canvasStats(p);
  await p.uncheck('#card-mark'); await p.waitForTimeout(80);
  const noMark = await canvasStats(p); last = await p.evaluate(() => window.OSHI_DEBUG.getCardLast());
  check('Pro: 透かしを外すと実際に下端の文字が減る（画素で判定）', !last.watermark && noMark.bottomInk < withMark.bottomInk * 0.7, `${withMark.bottomInk}→${noMark.bottomInk}`);
  await p.click('.range-bar .seg button[data-mode="year"]'); await p.waitForTimeout(80);
  check('Pro: 年間まとめも保存できる', !(await p.evaluate(() => window.OSHI_DEBUG.getCardLast().sample)));
  await p.click('.range-bar .seg button[data-mode="month"]');
  await p.selectOption('#card-size', 'story'); await p.waitForTimeout(80);
  st = await canvasStats(p);
  check('ストーリー（9:16）は 1080×1920 で描かれる', st.w === 1080 && st.h === 1920 && st.colors > 12);

  // メンカラ
  await p.evaluate(() => { const d = window.OSHI_DEBUG, s = d.getState(); s.oshiList[0].color = '#fde047'; d.setState(s); });
  await p.click('#tab-settings');
  const oid = await p.evaluate(() => window.OSHI_DEBUG.getState().oshiList[0].id);
  await p.selectOption('#pro-accent', oid); await p.waitForTimeout(80);
  const acc = await p.evaluate(() => ({ v: document.documentElement.style.getPropertyValue('--accent'), cache: localStorage.getItem('oshikatsu_accent_v1'), btn: getComputedStyle(document.querySelector('#form-pro button, .btn')).backgroundImage }));
  check('メンカラ: 推しの色がページ全体の --accent に入り、黄色でも文字が読める濃さに寄せる', /^#[0-9a-f]{6}$/.test(acc.v) && OshiPro.contrast(OshiPro.hexToRgb(acc.v), [255, 255, 255]) >= 4.5 && !!acc.cache, acc.v);
  await p.reload({ waitUntil: 'domcontentloaded' });
  const early = await p.evaluate(() => document.documentElement.style.getPropertyValue('--accent'));
  check('メンカラ: 再読み込み直後（検証完了前）から色が当たっている＝ちらつかない', early === acc.v, early);
  await p.waitForLoadState('load');
  await p.evaluate((id) => { const d = window.OSHI_DEBUG, s = d.getState(); s.oshiList = s.oshiList.filter((o) => o.id !== id); d.setState(s); }, oid);
  const after = await p.evaluate(() => ({ v: document.documentElement.style.getPropertyValue('--accent'), pref: window.OSHI_DEBUG.getState().prefs.accent, cache: localStorage.getItem('oshikatsu_accent_v1') }));
  check('メンカラ: その推しを消すと標準の色に戻る（色だけ残らない）', after.v === '' && after.pref === '' && after.cache === null, JSON.stringify(after));

  const [dj] = await Promise.all([p.waitForEvent('download'), p.click('#btn-export-json')]);
  const json = fs.readFileSync(await dj.path(), 'utf8');
  check('JSONバックアップにライセンスキーが入らない（渡したバックアップからキーが漏れない）', !json.includes('OSHI-PRO-') && json.includes('oshiList'));

  // 金額を隠す設定の人は、画像でも既定で隠す
  await p.evaluate(() => { const d = window.OSHI_DEBUG, s = d.getState(); s.prefs.mask = true; d.setState(s); });
  await p.click('#tab-dashboard'); await p.click('#card-close').catch(() => {}); await p.click('#btn-card'); await p.waitForTimeout(80);
  check('「金額を隠す」にしていると、画像の金額も既定でオフ', !(await p.isChecked('#card-amt')));

  // XSS: 推し名はキャンバスに描くだけ（DOMへ入らない）
  await p.evaluate(() => { const d = window.OSHI_DEBUG, s = d.getState(); s.oshiList[0].name = '<img src=x onerror=alert(1)>'; d.setState(s); });
  await p.click('#card-close').catch(() => {}); await p.click('#btn-card'); await p.waitForTimeout(150);
  check('推し名にHTMLを入れても実行されない', !errs.some((e) => e.startsWith('dialog:alert')) && (await p.locator('img[src="x"]').count()) === 0);

  await p.click('#tab-settings');
  await p.click('#pro-remove'); await p.waitForTimeout(80);
  check('解除: Pro が外れ、キーも消える', !(await p.evaluate(() => window.OSHI_DEBUG.getPro().on)) && (await p.evaluate(() => localStorage.getItem('oshikatsu_pro_v1'))) === null);
  // 保存されたキーが壊されていたら、起動時に無効と判定して理由を出す
  await p.evaluate((k) => localStorage.setItem('oshikatsu_pro_v1', k), flip(goodKey));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200);
  check('保存済みキーの改ざん: 起動時に無効と判定し、理由を残す', !(await p.evaluate(() => window.OSHI_DEBUG.getPro().on)) && (await p.textContent('#pro-msg')).includes('確認できませんでした'));
  check('Pro 一連の操作で例外0件', errs.filter((e) => !e.startsWith('dialog:')).length === 0, errs.join(' | '));
  await c.close();
}

// 部品（oshi-pro.js）が読めなくても、無料の機能は止まらない
{
  const { c, p, errs } = await proCtx({ jwk: pubJwk, route: (rt) => rt.abort() });
  await sampleData(p);
  await p.click('#btn-card'); await p.waitForTimeout(80);
  check('oshi-pro.js が読めない: 例外なし・ダッシュボードは描かれ・画像は理由を出して止まる', errs.length === 0 && (await p.textContent('#hero-num')) === '21' && (await p.textContent('#card-note')).includes('読み込めません') && await p.isDisabled('#card-save'), errs.join(' | '));
  await c.close();
}

// スマホ幅でカードのパネルが溢れない
{
  const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await c.newPage();
  await p.addInitScript(() => { window.__OSHI_TEST = true; });
  await p.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' });
  await sampleData(p); await p.click('#btn-card'); await p.waitForTimeout(200);
  const g = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, cw: Math.round(document.getElementById('card-canvas').getBoundingClientRect().width) }));
  check('スマホ幅（390px）: レポート画像パネルで横溢れなし・プレビューが見える大きさ', g.over <= 0 && g.cw >= 200 && g.cw <= 300, JSON.stringify(g));
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'mobile-card.png'), fullPage: true });
  await c.close();
}


console.log('\n── 15. Android アプリ（Google Play 課金・圏外起動・manifest）──');
// Digital Goods API と Payment Request を合成して差し込む（実機の Play が無いヘッドレスで、購入・復元・返金・取消を通す）。
// 設定は localStorage の __playcfg に置き、再読み込みをまたいで「持っている／返金された」を切り替える
const PLAY_MOCK = () => {
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('__playcfg') || '{}'); } catch (e) { /* 既定 */ }
  if (cfg.web) return;
  window.__OSHI_TEST = true; window.__OSHI_ANDROID = true;
  const st = window.__play = { purchases: cfg.owned ? [{ itemId: 'oshikatsu_pro', purchaseToken: 'tok-old', acknowledged: cfg.ack !== false }] : [], acks: [], prs: [] };
  if (cfg.unsupported) return;
  window.getDigitalGoodsService = async (id) => id !== 'https://play.google.com/billing' ? null : {
    getDetails: async (ids) => ids.map((i) => ({ itemId: i, title: 'Pro', price: { currency: 'JPY', value: '980' } })),
    listPurchases: async () => { if (cfg.listFail) throw Object.assign(new Error('offline'), { name: 'NetworkError' }); return st.purchases; },
    acknowledge: async (t, k) => { st.acks.push([t, k]); },
  };
  window.PaymentRequest = class {
    constructor(m, d) { st.prs.push({ m, d }); }
    async show() {
      if (cfg.cancel) throw Object.assign(new Error('cancel'), { name: 'AbortError' });
      st.purchases.push({ itemId: 'oshikatsu_pro', purchaseToken: 'tok-new', acknowledged: false });
      return { details: { purchaseToken: 'tok-new' }, complete: async () => {} };
    }
  };
};
const playCtx = async (cfg, extra) => {
  const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.addInitScript(() => { window.__OSHI_TEST = true; });
  if (extra) await p.addInitScript(extra.fn, extra.arg);
  await p.addInitScript(PLAY_MOCK);
  await p.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
  await p.evaluate((c) => { localStorage.clear(); localStorage.setItem('__playcfg', JSON.stringify(c)); }, cfg);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(150);
  const setCfg = async (c2, seed) => { await p.evaluate(([c, s]) => { localStorage.setItem('__playcfg', JSON.stringify(c)); if (s) Object.entries(s).forEach(([k, v]) => v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v)); }, [c2, seed || null]); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200); };
  const info = () => p.evaluate(() => ({ on: window.OSHI_DEBUG.getPro().on, id: window.OSHI_DEBUG.getPro().id, flag: localStorage.getItem('oshikatsu_play_v1'), play: window.__play, msg: document.getElementById('pro-play-msg').textContent }));
  return { c, p, errs, setCfg, info };
};

{
  const { c, p, errs, setCfg, info } = await playCtx({});
  await p.click('#btn-go-settings'); await p.waitForTimeout(100);
  const ui = await p.evaluate(() => ({ android: window.OSHI_DEBUG.isAndroidApp(), form: !document.getElementById('form-pro').hidden, booth: !document.getElementById('pro-buy').hidden || !document.getElementById('pro-soon').hidden, play: !document.getElementById('pro-play').hidden, label: document.getElementById('pro-play-buy').textContent }));
  check('Android: BOOTHへの導線とキー入力欄を出さず、Google Play の購入だけを出す（Play の決済ポリシー）', ui.android && !ui.form && !ui.booth && ui.play, JSON.stringify(ui));
  check('Android: 購入ボタンに Play から取った価格が出る', /980/.test(ui.label), ui.label);
  await p.click('#pro-play-buy'); await p.waitForTimeout(200);
  let r = await info();
  const pr = r.play.prs[0];
  check('購入: Payment Request に Play の決済方法と商品ID（oshikatsu_pro）を渡す', pr && pr.m[0].supportedMethods === 'https://play.google.com/billing' && pr.m[0].data.sku === 'oshikatsu_pro', JSON.stringify(pr));
  check('購入: Pro が有効になり、購入の印を覚える', r.on && r.id === 'play' && r.flag === '1');
  check('購入: 1回きりの購入として「確認済み」にする（しないと3日後に自動返金）', r.play.acks.some(([t, k]) => t === 'tok-new' && k === 'onetime'), JSON.stringify(r.play.acks));
  check('Play で買った Pro は「この端末で解除」を出さない（解除しても次の起動で戻るだけ）', !(await p.isVisible('#pro-remove')));
  await setCfg({ owned: true });
  r = await info();
  check('再起動: Play に購入があれば Pro のまま', r.on && r.id === 'play');
  await setCfg({ owned: true, listFail: true });
  r = await info();
  check('圏外（購入の照会に失敗）: 覚えていた印で Pro のまま使える', r.on && r.flag === '1');
  await setCfg({ owned: false });
  r = await info();
  check('返金・取り消し（照会に成功して購入が無い）: Pro を外し、印も消す', !r.on && r.flag === null, JSON.stringify({ on: r.on, flag: r.flag }));
  await p.click('#btn-go-settings'); await p.click('#pro-play-restore'); await p.waitForTimeout(150);
  r = await info();
  check('「購入を復元」で何も無ければ、理由を画面に残す', r.msg.includes('見つかりませんでした'), r.msg);
  check('Android の購入まわりで例外0件', errs.length === 0, errs.join(' | '));
  await c.close();
}
{
  const { c, p, errs, info } = await playCtx({ cancel: true });
  await p.click('#btn-go-settings'); await p.click('#pro-play-buy'); await p.waitForTimeout(150);
  const r = await info();
  check('購入をやめた: Pro にならず、「請求されていません」と伝える・ボタンは押せる状態に戻る', !r.on && r.flag === null && r.msg.includes('請求されていません') && !(await p.isDisabled('#pro-play-buy')) && errs.length === 0, r.msg);
  await c.close();
}
{
  const { c, p, info } = await playCtx({ owned: true, ack: false });
  const r = await info();
  check('別の端末で買っていた（未確認の購入）: 起動時に黙って復元し、確認済みにする', r.on && r.play.acks.some(([t]) => t === 'tok-old'), JSON.stringify(r.play.acks));
  await c.close();
}
{
  const { c, p, errs } = await playCtx({ unsupported: true });
  await p.click('#btn-go-settings'); await p.click('#pro-play-buy'); await p.waitForTimeout(150);
  check('Play の購入を使えない端末: 例外を出さず、次の一手（ストアとChromeの更新）を出す', errs.length === 0 && (await p.textContent('#pro-play-msg')).includes('最新に'));
  await c.close();
}
{
  const { c, p } = await playCtx({ owned: false }, { fn: (o) => { window.__OSHI_PRO_TEST_OPTS = o; }, arg: { jwk: pubJwk } });
  await p.evaluate((k) => localStorage.setItem('oshikatsu_pro_v1', k), goodKey); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  const r = await p.evaluate(() => window.OSHI_DEBUG.getPro());
  check('Android: Web で買ったキーが保存済みなら、Play に購入が無くても Pro のまま（返金扱いで消さない）', r.on && r.id === 'verify0001', JSON.stringify(r));
  await c.close();
}
{
  const { c, p } = await playCtx({ web: true });
  await p.click('#btn-go-settings');
  check('Web版（アプリ外）では Play の購入欄を出さず、従来のキー入力を出す', !(await p.isVisible('#pro-play')) && await p.isVisible('#form-pro'));
  await c.close();
}

// manifest・アイコン・事前キャッシュ・TWA 設定の突き合わせ（書き間違えても例外は出ず、静かに別ページが開く／圏外で開かない）
{
  const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
  const manHref = (html.match(/<link rel="manifest" href="([^"]+)"/) || [])[1];
  const man = manHref ? JSON.parse(fs.readFileSync(path.join(ROOT, manHref), 'utf8')) : null;
  const manUrl = new URL(manHref || 'x', `${BASE}/${PAGE}`);
  const pngSize = (f) => { const b = fs.readFileSync(f); return b.slice(1, 4).toString() === 'PNG' ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` : 'not-png'; };
  const icons = (man?.icons || []).map((i) => ({ ...i, real: fs.existsSync(path.join(ROOT, i.src)) ? pngSize(path.join(ROOT, i.src)) : 'missing' }));
  check('manifest: ページ専用の manifest があり、start_url が推し活ログを指す', !!man && new URL(man.start_url, manUrl).pathname === `/${PAGE}`, man && man.start_url);
  check('manifest: アイコンが実在し、書いた大きさと実寸が一致・maskable と 512 がある', icons.length >= 3 && icons.every((i) => i.real === i.sizes) && icons.some((i) => i.purpose === 'maskable') && icons.some((i) => i.sizes === '512x512'), JSON.stringify(icons.map((i) => i.sizes + '=' + i.real)));
  const metaTheme = (html.match(/<meta name="theme-color" content="([^"]+)"/) || [])[1];
  check('manifest: 色がページと同じ（違うと起動直後に色が光る）', man && man.theme_color === metaTheme && man.background_color === metaTheme, `${man && man.theme_color} / ${metaTheme}`);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const pre = [...(sw.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/) || [, ''])[1].matchAll(/'([^']+)'/g)].map((m) => m[1].replace(/^\.\//, ''));
  const needs = [PAGE, manHref, ...[...html.matchAll(/<script src="(assets\/[^"]+)"/g)].map((m) => m[1]), (html.match(/rel="apple-touch-icon" href="([^"]+)"/) || [])[1]].filter(Boolean);
  const notPre = needs.filter((u) => !pre.includes(u));
  check('圏外起動: ページ・manifest・読み込むスクリプト（?v= まで一字一句）が sw.js の事前キャッシュに入っている', notPre.length === 0, notPre.join(', '));
  const ghost = pre.filter((u) => u && u !== '' && !fs.existsSync(path.join(ROOT, u.split('?')[0] || 'index.html')));
  check('事前キャッシュの一覧に実在しないファイルが無い（addAll は1件の失敗で全部空になる）', ghost.length === 0, ghost.join(', '));
  const twa = JSON.parse(fs.readFileSync(path.join(ROOT, 'android/twa-manifest.json'), 'utf8'));
  const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'android/user-site/.well-known/assetlinks.json'), 'utf8'));
  check('TWA: 起動URLはクエリ無しで推し活ログを指す（クエリ付きは sw.js が素通しして圏外で開かない）', twa.startUrl === `/main/${PAGE}` && !twa.startUrl.includes('?'), twa.startUrl);
  check('TWA: Play 課金が有効・パッケージ名が assetlinks と一致・アイコンURLの実体がある', twa.features?.playBilling?.enabled === true && links[0].target.package_name === twa.packageId
    && [twa.iconUrl, twa.maskableIconUrl].every((u) => fs.existsSync(path.join(ROOT, new URL(u).pathname.replace(/^\/main\//, '')))));
  check('TWA: assetlinks の置き場は Jekyll に消されない（.nojekyll がある）', fs.existsSync(path.join(ROOT, 'android/user-site/.nojekyll')));
}

// 実際に Service Worker を動かし、圏外で開けるかを確かめる
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${BASE}/${PAGE}`, { waitUntil: 'load' });
  const ready = await p.evaluate(async () => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
    if (!reg) return false;
    for (let i = 0; i < 40; i++) { const k = await caches.keys(); if (k.length && (await (await caches.open(k[0])).keys()).length > 10) return true; await new Promise((r) => setTimeout(r, 150)); }
    return false;
  });
  await c.setOffline(true);
  let offline = { ok: false };
  try {
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
    offline = await p.evaluate(() => ({ ok: true, pro: typeof window.OshiPro === 'object', research: typeof window.OshiResearch !== 'undefined' || typeof window.OR !== 'undefined' || true, title: document.title, hero: !!document.getElementById('hero-num') }));
  } catch (e) { offline = { ok: false, err: e.message }; }
  check('圏外: Service Worker が入り、通信を切って開き直してもアプリと Pro の部品が動く', ready && offline.ok && offline.pro && offline.hero && errs.length === 0, JSON.stringify({ ready, ...offline, errs }));
  await c.close();
}

if (INJECT) {
  console.log('\n── 故障注入（この下が ❌ にならなければ、検査は素通りしている）──');
  await fresh();
  const threw = await page.evaluate(() => {
    try { const s = window.OSHI_DEBUG.getState(); s.expenses.push({ id: 'bad', date: undefined, oshiId: '', category: 'グッズ', amount: 100 }); window.OSHI_DEBUG.renderAll(); return false; } catch (e) { return true; }
  });
  check('【注入】sanitize を通さない壊れた日付は描画で例外になる（＝入口の検疫が要る証拠）', !threw);
  // 署名の確認を外した oshi-pro.js を差し込む → 偽造キーが通る＝上の「別の鍵で偽造」検査が ❌ になるべき
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/oshi-pro.js'), 'utf8').replace("if (!good) return { ok: false, reason: 'signature' };", '');
  const { c, p } = await proCtx({ jwk: pubJwk, route: (rt) => rt.fulfill({ body: src, contentType: 'text/javascript' }) });
  await p.click('#tab-settings'); await p.fill('#pro-key', forgedKey); await p.click('#form-pro button[type=submit]'); await p.waitForTimeout(150);
  check('【注入】署名確認を外すと偽造キーで Pro が開く（＝署名確認が効いている証拠）', !(await p.evaluate(() => window.OSHI_DEBUG.getPro().on)));
  await c.close();
  // 購入の「確認済み」処理を外したページを差し込む → 3日後に自動返金される壊れ方。上の「確認済みにする」検査が ❌ になるべき
  {
    const bad = fs.readFileSync(path.join(ROOT, PAGE), 'utf8').replace("return s.acknowledge(p.purchaseToken, 'onetime');", 'return null;');
    const { c, p, info } = await playCtx({});
    await p.route(`${BASE}/${PAGE}`, (rt) => rt.fulfill({ body: bad, contentType: 'text/html; charset=utf-8' }));
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(150);
    await p.click('#btn-go-settings'); await p.click('#pro-play-buy'); await p.waitForTimeout(200);
    const r = await info();
    check('【注入】acknowledge を外すと購入が確認済みにならない（＝確認の検査が効いている証拠）', r.play.acks.length > 0);
    await c.close();
  }
}

await browser.close(); server.close();
console.log(`\n==> verify-oshikatsu: ${pass} 項目 ✅ / ${fail} 項目 ❌`);
process.exit(fail ? 1 : 0);
