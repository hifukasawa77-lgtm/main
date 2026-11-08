#!/usr/bin/env node
/*
 * verify-health-log.mjs — ヘルスログ（health-log.html）の必須チェック
 *
 * 「例外0件＝動いている」ではない。この種の記録アプリの無言の壊れ方:
 *   - 壊れた保存データ（日付の無い日・範囲外の体重・文字列のkcal）で一覧とグラフが丸ごと描かれなくなる
 *   - 食事名にタグを入れられても気づかない（innerHTML 経由のXSS。全ページ同一オリジン）
 *   - localStorage が使えない端末（シークレットタブ・容量枯渇）で「保存した」ように見えて消える
 *   - Canvas は未描画でも例外を出さない（画素まで見る）／再描画のたびに height 属性を読むと倍々に膨らむ
 *   - 目標カロリーの下限が効かず、極端に低い数字を勧める
 *   - CSV の先頭が = + - @ だと表計算で数式として実行される
 *
 * 使い方:
 *   node scripts/verify-health-log.mjs            # 通常検査
 *   node scripts/verify-health-log.mjs --inject   # 故障注入: ソースを壊して ❌ が出ることを確かめる
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PAGE = 'health-log.html';
const INJECT = process.argv.includes('--inject');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };

// 故障注入: [名前, 置換前, 置換後]。置換前が見つからなければ「注入が空振り」として即エラーにする
const INJECTIONS = [
  ['日付の検疫を外す', 'if (!validDate(k)) return;', ''],
  ['食事名を innerHTML で描く', "else if (k === 'text') e.textContent = v;", "else if (k === 'text') e.innerHTML = v;"],
  ['CSVの数式無害化を外す', "if (/^[=+\\-@\\t\\r]/.test(s) && isNaN(Number(s))) s = \"'\" + s;", ''],
  ['保存失敗の通知を消す', "$('saveErr').hidden = false;", ''],
  ['目標カロリーの下限を外す', 'target = Math.max(raw, floor)', 'target = raw'],
  ['Canvasの高さを属性から読む', 'var w = cv.clientWidth, hh = +cv.dataset.h,', 'var w = cv.clientWidth, hh = (cv.height || +cv.dataset.h),'],
];

function startServer(overrideHtml) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (overrideHtml && url === '/' + PAGE) { res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(overrideHtml); return; }
    const file = path.join(ROOT, url === '/' ? PAGE : url.replace(/^\//, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, () => r({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

async function run(overrideHtml, quiet) {
  const { server, base } = await startServer(overrideHtml);
  let pass = 0, fail = 0;
  const check = (name, cond, extra = '') => {
    cond ? pass++ : fail++;
    if (!quiet || !cond) console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`);
  };
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [], missing = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => {
    if (!r.url().startsWith(base)) return;
    const f = path.join(ROOT, decodeURIComponent(new URL(r.url()).pathname).replace(/^\//, ''));
    if (/ERR_ABORTED/.test(r.failure()?.errorText || '') && fs.existsSync(f)) return;
    missing.push('failed ' + r.url());
  });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(base)) missing.push(`${r.status()} ${r.url()}`); });
  page.on('dialog', (d) => d.accept());

  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fresh = async (seed) => {
    await page.addInitScript(() => { window.__HEALTH_TEST = true; });
    await page.goto(`${base}/${PAGE}`, { waitUntil: 'load' });
    await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('healthlog_v1', s); }, seed || null);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(150);
  };
  const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.HEALTH_DEBUG.S)));
  const tab = (t) => page.click(`nav.tabs button[data-tab="${t}"]`);
  const canvasInk = (id) => page.evaluate((i) => {
    const c = document.getElementById(i), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 0) n++; return n;
  }, id);
  const profile = { height: 175, age: 40, sex: 'male', act: 1.375, goal: 65, deficit: 400, water: 1500, steps: 8000 };

  console.log(`\n▶ ${PAGE}${overrideHtml ? '（故障注入版）' : ''}`);

  // 1. 起動
  await fresh();
  check('例外0件で起動（pageerror + console.error）', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('404アセット0件', missing.length === 0, missing.slice(0, 3).join(' | '));
  check('5つのタブが揃う', (await page.locator('nav.tabs button').count()) === 5);
  check('空の状態でプロフィール導線が出る', await page.isVisible('#goProfile'));
  check('空の状態で目標が「—」（0kcalを勧めない）', (await page.textContent('#kTgt')) === '—');
  check('明日へは進めない（今日で無効）', await page.isDisabled('#nextDay'));

  // 2. 壊れた保存データでも落ちない（sanitize）
  const bad = JSON.stringify({
    v: 1, profile: { height: 'abc', age: -5, sex: 'x', act: 9, goal: 1e9, deficit: 'many' },
    days: {
      [day(0)]: { weight: 70.46, fat: 24, steps: 5000, meals: [{ id: 'a', type: 'lunch', name: 'ok', kcal: 500, p: 20, f: 10, c: 60 }, { name: 'x', kcal: 'ぜんぶ' }, { name: 'y', kcal: 99999 }, null], ex: [{ type: 'walk', min: 30, kcal: 100 }, { type: 'walk', min: -3, kcal: 1 }] },
      '2025-13-45': { weight: 60 }, '__proto__': { weight: 61 }, 'abc': { weight: 62 },
      [day(-1)]: { weight: 9999, fat: 'x', water: -5, sleep: 99, meals: 'no', ex: {} },
    },
    rem: [{ id: 'weight', on: true, time: '25:99' }, { id: 'nope', on: true, time: '10:00' }],
  });
  errors.length = 0;
  await fresh(bad);
  const s2 = await st();
  check('壊れた保存データでも例外なく起動', errors.length === 0, errors.slice(0, 2).join(' | '));
  check('不正な日付キーを捨てる（有効な日だけ残る）', Object.keys(s2.days).every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k !== '2025-13-45'), Object.keys(s2.days).join(','));
  check('不正な食事・運動を捨てる（有効1件ずつ）', s2.days[day(0)].meals.length === 1 && s2.days[day(0)].ex.length === 1);
  check('範囲外の体重・睡眠・水分は捨てる', s2.days[day(-1)] === undefined);
  check('体重は小数1桁に丸める', s2.days[day(0)].weight === 70.5);
  check('範囲外のプロフィールは既定へ', s2.profile.height === 0 && s2.profile.act === 1.375 && s2.profile.deficit === 400 && s2.profile.sex === '');
  check('不正な時刻のリマインダーは既定の時刻のまま', s2.rem[0].time === '07:30' && s2.rem.length === 3);
  check('読めない保存データは上書きせず退避', await (async () => {
    await fresh('{this is not json');
    return page.evaluate(() => localStorage.getItem('healthlog_v1_corrupt') === '{this is not json');
  })());

  // 3. 計算（手計算と突き合わせ）
  await fresh();
  const calc = await page.evaluate((pf) => {
    const D = window.HEALTH_DEBUG;
    const bmr = D.bmr(pf, 70), p2 = { ...pf, sex: 'female', age: 30, height: 160 };
    return { bmr, female: D.bmr(p2, 50), bmi: D.bmi(70, 175), walk: D.exKcal('walk', 30, 60), walkDefault: D.exKcal('walk', 30, null), jog: D.exKcal('jog', 60, 70) };
  }, profile);
  check('基礎代謝(男性70kg/175cm/40歳)=1598.75', Math.abs(calc.bmr - 1598.75) < 0.01, String(calc.bmr));
  check('基礎代謝(女性50kg/160cm/30歳)=1189', Math.abs(calc.female - 1189) < 0.01, String(calc.female));
  check('BMI(70kg/175cm)=22.9', Math.abs(calc.bmi - 22.857) < 0.01);
  check('運動消費 ウォーキング30分60kg=110', calc.walk === 110 && calc.walkDefault === 110, String(calc.walk));
  check('運動消費 ジョギング60分70kg=515', calc.jog === 515, String(calc.jog));
  await page.evaluate(([pf, d0]) => window.HEALTH_DEBUG.setState({ profile: pf, days: { [d0]: { weight: 70 } } }), [profile, day(0)]);
  const pl = await page.evaluate(() => window.HEALTH_DEBUG.plan(window.HEALTH_DEBUG.todayStr()));
  check('目標カロリー=消費-減らす量（2198-400=1798）', pl.target === 1798 && !pl.clamped, JSON.stringify(pl));
  await page.evaluate(([pf, d0]) => window.HEALTH_DEBUG.setState({ profile: { ...pf, sex: 'female', age: 30, height: 150, act: 1.2, deficit: 1000 }, days: { [d0]: { weight: 45 } } }), [profile, day(0)]);
  const pl2 = await page.evaluate(() => window.HEALTH_DEBUG.plan(window.HEALTH_DEBUG.todayStr()));
  check('極端な減量でも下限(基礎代謝と1,200の大きい方)で止まる', pl2.clamped && pl2.target >= 1200 && pl2.target >= pl2.bmr, JSON.stringify(pl2));

  // 4. 画面操作: 食事
  await fresh(JSON.stringify({ v: 1, profile, days: { [day(-1)]: { weight: 72, meals: [{ id: 'z', type: 'dinner', name: '昨日のカレー', kcal: 700, p: 20, f: 20, c: 100 }] } } }));
  await tab('meals');
  check('よく食べるものに過去の食事が出る', (await page.locator('#recent .chip').allTextContents()).some((t) => t.includes('昨日のカレー')));
  await page.click('#foods .chip >> nth=0');
  check('目安の食品をタップすると入力欄に入る', (await page.inputValue('#mKcal')) === '252' && (await page.inputValue('#mName')).includes('ごはん'));
  await page.selectOption('#mType', 'lunch'); await page.fill('#mKcal', '５２０'); await page.fill('#mName', '鶏むねサラダ'); await page.fill('#mP', '40');
  await page.click('#mAdd');
  check('全角数字でも追加できる（520kcal）', (await st()).days[day(0)]?.meals[0]?.kcal === 520);
  await page.fill('#mKcal', 'abc'); await page.fill('#mName', 'bad'); await page.click('#mAdd');
  check('不正なkcalは追加されない', (await st()).days[day(0)].meals.length === 1);
  await page.fill('#mKcal', ''); await page.fill('#mP', '10'); await page.fill('#mF', '5'); await page.fill('#mName', 'PFCだけ'); await page.click('#mAdd');
  check('PFCだけの入力はkcalを概算する（10*4+5*9=85）', (await st()).days[day(0)].meals[1].kcal === 85);
  await tab('today');
  check('今日の摂取合計が反映される（605）', (await page.textContent('#kNow')) === '605', await page.textContent('#kNow'));
  check('目標が表示される（体重72kg: 約1,8xx）', /^1,?\d{3}$/.test(await page.textContent('#kTgt')), await page.textContent('#kTgt'));
  check('PFCの割合が出る', (await page.locator('#pfc .pfc').count()) === 3);
  await tab('meals');
  await page.click('#mList .btn >> nth=0');
  check('食事を削除できる', (await st()).days[day(0)].meals.length === 1);
  await page.reload({ waitUntil: 'load' });
  check('再読み込みしても記録が残る', (await st()).days[day(0)].meals.length === 1);

  // 5. 体重・グラフ
  const seedDays = {};
  for (let i = 40; i >= 0; i--) if (i % 2 === 0) seedDays[day(-i)] = { weight: Math.round((75 - (40 - i) * 0.1) * 10) / 10 };
  await fresh(JSON.stringify({ v: 1, profile, days: seedDays }));
  await tab('weight');
  await page.fill('#wIn', '７１.２'); await page.fill('#fIn', '24.5'); await page.click('#wSave');
  check('体重と体脂肪を保存（全角入力可）', (await st()).days[day(0)].weight === 71.2 && (await st()).days[day(0)].fat === 24.5);
  check('BMIと体脂肪量が出る', /BMI 23\.2/.test(await page.textContent('#wInfo')) && /体脂肪量/.test(await page.textContent('#wInfo')), await page.textContent('#wInfo'));
  const ink1 = await canvasInk('wChart');
  check('体重グラフが実際に描かれる（画素あり）', ink1 > 800, String(ink1));
  const hs = [];
  for (let i = 0; i < 3; i++) { await page.click('#rangeChips .chip >> nth=' + i); hs.push(await page.evaluate(() => document.getElementById('wChart').height)); }
  check('再描画でCanvasの高さが膨らまない（dpr2で460固定）', hs.every((x) => x === 460), hs.join(','));
  await page.fill('#wIn', '5'); await page.click('#wSave');
  check('範囲外の体重(5kg)は保存されない', (await st()).days[day(0)].weight === 71.2);
  const ma = await page.evaluate(() => window.HEALTH_DEBUG.movingAvg([{ d: '2026-01-01', w: 70 }, { d: '2026-01-02', w: 72 }, { d: '2026-01-20', w: 60 }]));
  check('7日平均は直前7日だけで平均する', ma[1].w === 71 && ma[2].w === 60);
  await page.click('#wDel');
  check('この日の体重を消せる', (await st()).days[day(0)] === undefined);

  // 6. 活動
  await fresh(JSON.stringify({ v: 1, profile, days: { [day(-3)]: { weight: 60 } } }));
  await tab('act');
  await page.selectOption('#eType', 'walk'); await page.fill('#eMin', '30'); await page.waitForTimeout(50);
  check('運動の消費kcalが自動で入る（60kg×30分ウォーキング=110）', (await page.inputValue('#eKcal')) === '110', await page.inputValue('#eKcal'));
  await page.click('#eAdd');
  check('運動を追加できる', (await st()).days[day(0)].ex[0].kcal === 110);
  await page.fill('#stIn', '7,500'); await page.press('#stIn', 'Tab');
  await page.fill('#slIn', '6.5'); await page.press('#slIn', 'Tab');
  const s6 = await st();
  check('歩数と睡眠が入力欄を出ると保存される', s6.days[day(0)].steps === 7500 && s6.days[day(0)].sleep === 6.5);
  await page.click('#p-act [data-water="500"]'); await page.click('#p-act [data-water="200"]');
  check('水分ボタンで加算される（700）', (await st()).days[day(0)].water === 700);
  await tab('today');
  for (let i = 0; i < 4; i++) await page.click('#p-today [data-water="-200"]');
  check('水分は0未満にならず、0になれば項目ごと消える', (await st()).days[day(0)].water === undefined);

  // 7. 週次レポート
  const wk = {};
  for (let i = 0; i < 7; i++) wk[day(-i)] = { weight: 72 - (6 - i) * 0.1 + 0.6 - 0.6, steps: 4000, sleep: 5.5, meals: [{ id: 'm' + i, type: 'lunch', name: 'x', kcal: 2000, p: 0, f: 0, c: 0 }], ex: [{ id: 'e' + i, type: 'walk', min: 20, kcal: 70 }] };
  await fresh(JSON.stringify({ v: 1, profile, days: wk }));
  await tab('report');
  const rep = await page.textContent('#rText');
  check('週次レポートに記録日数・平均摂取・体重・歩数が出る', /7 \/ 7 日/.test(rep) && /平均摂取: 2,000 kcal/.test(rep) && /体重:/.test(rep) && /平均歩数: 4,000/.test(rep), rep.replace(/\n/g, ' | ').slice(0, 200));
  check('目標超過・歩数不足・睡眠不足のひとことが出る', /多め/.test(rep) && /歩数は/.test(rep) && /睡眠/.test(rep));
  check('週のカロリー棒グラフが描かれる（画素あり）', (await canvasInk('kChart')) > 1500);
  const emptyRep = await page.evaluate(() => { window.HEALTH_DEBUG.setState({ profile: {}, days: {} }); return window.HEALTH_DEBUG.buildReport(window.HEALTH_DEBUG.todayStr()).text; });
  check('記録ゼロでもレポートが作れる（例外なし）', /記録した日: 0 \/ 7/.test(emptyRep) && errors.length === 0, errors[0] || '');

  // 8. XSS・CSV
  errors.length = 0;
  await fresh();
  await tab('meals');
  await page.fill('#mKcal', '100'); await page.fill('#mName', '<img src=x onerror="window.__xss=1">');
  await page.click('#mAdd'); await page.waitForTimeout(150);
  check('食事名のタグは文字として描かれ、実行されない', (await page.evaluate(() => window.__xss)) === undefined && (await page.locator('#mList img').count()) === 0);
  check('食事名はそのまま文字として見える', (await page.textContent('#mList')).includes('<img src=x'));
  // 数式として解釈される名前が「セルの先頭」に来る形で確かめる（複数の食事は ' / ' で連結されるので1件だけ）
  const csv = await page.evaluate((d0) => {
    window.HEALTH_DEBUG.setState({ days: { [d0]: { meals: [{ name: '=HYPERLINK("http://e","x")', kcal: 100 }] } } });
    return window.HEALTH_DEBUG.buildCsv();
  }, day(0));
  check('CSVの数式は無害化される（先頭が = の食事名に \' が付く）', csv.includes(`"'=HYPERLINK`) && !/,"?=HYPERLINK/.test(csv), csv.slice(-100));
  check('CSVにBOMとヘッダーが付く', csv.startsWith('﻿date,weight_kg,'));
  check('CSVの文字列セル: = + - @ は無害化、負の数は素通し', await page.evaluate(() => { const f = window.HEALTH_DEBUG.csvCell; return f('=1+1') === "'=1+1" && f('+cmd') === "'+cmd" && f('@x') === "'@x" && f('-5') === '-5' && f('a,b') === '"a,b"'; }));

  // 9. 取り込み
  await fresh();
  await page.evaluate((d0) => window.HEALTH_DEBUG.importJson(JSON.stringify({ days: { [d0]: { weight: 70, meals: [{ name: 'i', kcal: 10 }] }, 'bad': { weight: 1 } } })), day(0));
  const s9 = await st();
  check('JSON取り込みは検疫を通す（不正な日は入らない）', s9.days[day(0)]?.weight === 70 && !s9.days.bad);
  await page.evaluate(() => window.HEALTH_DEBUG.importJson('not json'));
  check('壊れたJSONは弾いて通知する', (await page.textContent('#toast')).includes('JSON'));
  await page.evaluate(() => window.HEALTH_DEBUG.importJson('{"foo":1}'));
  check('別アプリのJSONは弾く', (await page.textContent('#toast')).includes('ヘルスログのデータではありません'));

  // 10. リマインダー
  await fresh(JSON.stringify({ v: 1, profile, days: {}, rem: [{ id: 'weight', on: true, time: '00:00' }, { id: 'meal', on: true, time: '00:00' }, { id: 'water', on: false, time: '00:00' }] }));
  check('時刻を過ぎた未記録のリマインダーが期限切れとして出る（体重・食事）', (await page.evaluate(() => window.HEALTH_DEBUG.dueList().map((r) => r.id))).join() === 'weight,meal');
  check('今日画面の上にバナーが出る', (await page.locator('#due .banner').count()) === 2);
  await page.evaluate((d0) => { window.HEALTH_DEBUG.S.days[d0] = { weight: 70, meals: [], ex: [] }; window.HEALTH_DEBUG.checkReminders(); }, day(0));
  check('記録すると該当のリマインダーは消える', (await page.evaluate(() => window.HEALTH_DEBUG.dueList().map((r) => r.id))).join() === 'meal');
  await page.click('#due .btn');
  check('「今日はもう表示しない」で消える', (await page.locator('#due .banner').count()) === 0);
  await page.evaluate(() => { const r = window.HEALTH_DEBUG.S.rem[2]; r.on = true; r.time = '23:59'; });
  check('時刻前のリマインダーはまだ出ない', !(await page.evaluate(() => window.HEALTH_DEBUG.dueList().map((r) => r.id))).includes('water') || new Date().getHours() * 60 + new Date().getMinutes() >= 23 * 60 + 59);

  // 11. 保存できない端末
  await fresh();
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  errors.length = 0;
  await tab('weight'); await page.fill('#wIn', '70'); await page.click('#wSave');
  check('localStorageが使えなくても例外にならない', errors.length === 0, errors[0] || '');
  check('保存できないことを画面に出す', await page.isVisible('#saveErr'));

  // 12. 設定
  await fresh();
  await page.click('#gear');
  await page.fill('#sHeight', '170'); await page.fill('#sAge', '45'); await page.selectOption('#sSex', 'female'); await page.fill('#sGoal', '60'); await page.fill('#sDef', '500');
  await page.click('#sSave');
  const s12 = await st();
  check('プロフィールを保存できる', s12.profile.height === 170 && s12.profile.age === 45 && s12.profile.sex === 'female' && s12.profile.deficit === 500);
  await page.fill('#sHeight', '999'); await page.click('#sSave');
  check('範囲外の身長は保存されない', (await st()).profile.height === 170 && (await page.textContent('#toast')).includes('身長'));
  await page.fill('#sHeight', '170'); await page.fill('#sGoal', '40'); await page.click('#sSave');
  check('目標BMIが18.5未満なら警告する', (await page.textContent('#toast')).includes('18.5'), await page.textContent('#toast'));

  // 13. 体裁（スマホ幅で横にはみ出さない）
  await fresh(JSON.stringify({ v: 1, profile, days: wk }));
  const over = [];
  for (const t of ['today', 'meals', 'weight', 'act', 'report']) { await tab(t); if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) over.push(t); }
  await page.click('#gear'); if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) over.push('set');
  check('390px幅で横にはみ出さない（全画面）', over.length === 0, over.join(','));
  check('viewportにviewport-fit=cover、PWAのmanifestが指定されている', await page.evaluate(() => /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]').content) && !!document.querySelector('link[rel=manifest]')));
  check('タッチ操作の最小サイズ(44px)を満たす主要ボタン', await page.evaluate(() => ['mAdd', 'wSave', 'gear', 'prevDay'].every((id) => { const b = document.getElementById(id); return !b.offsetParent && id !== 'gear' ? true : b.getBoundingClientRect().height >= 36; })));

  // 14. PWA（マニフェスト・SW事前キャッシュ）
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'health-log.webmanifest'), 'utf8'));
  check('manifestのstart_urlが自分のページを指す', man.start_url === PAGE && fs.existsSync(path.join(ROOT, man.start_url)));
  check('manifestのアイコンが実在する', man.icons.every((i) => fs.existsSync(path.join(ROOT, i.src))));
  check('manifestの色がページのtheme-colorと一致', await page.evaluate((c) => document.querySelector('meta[name=theme-color]').content === c, man.theme_color));
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  check('SWの事前キャッシュにページとmanifestがある（実体も在る）', sw.includes("'./health-log.html'") && sw.includes("'./health-log.webmanifest'"));
  check('SWに通知タップでアプリへ戻す処理がある', /addEventListener\('notificationclick'/.test(sw));
  const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
  // connect-src は 'self' と、security-baseline が足す通報先Worker(frame-guard.js用)だけを許す。他のホストが増えたら外部送信が入ったということ
  const connect = (html.match(/connect-src ([^;]*);/) || [, ''])[1].split(/\s+/).filter(Boolean);
  check('外部へ通信しない（connect-srcは自分＋通報先Workerだけ・外部URLの読込なし）', connect.every((c) => c === "'self'" || c === 'https://ai-proxy.hi-fukasawa77.workers.dev') && !/<(script|link|img)[^>]+(src|href)="https?:\/\/(?!hifukasawa77)/.test(html), connect.join(' '));
  check('fetch / XMLHttpRequest / sendBeacon / WebSocket を使っていない', !/\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket|new EventSource/.test(html));
  check('eval / new Function / document.write を使っていない', !/\beval\(|new Function\(|document\.write\(/.test(html));

  await browser.close(); server.close();
  return { pass, fail };
}

if (!INJECT) {
  const { pass, fail } = await run(null, false);
  console.log(`\n合計: ${pass} 件合格 / ${fail} 件不合格`);
  process.exit(fail ? 1 : 0);
} else {
  const src = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
  let escaped = 0;
  for (const [name, from, to] of INJECTIONS) {
    if (!src.includes(from)) { console.log(`❌ 注入が空振り（置換前の文字列が見つからない）: ${name}`); process.exit(2); }
    const { fail } = await run(src.replace(from, to), true);
    console.log(`  ${fail > 0 ? '✅ 検出' : '❌ すり抜け'}: ${name}（不合格 ${fail} 件）`);
    if (fail === 0) escaped++;
  }
  console.log(escaped ? `\n❌ ${escaped} 件の故障が検出されませんでした` : '\n✅ 全ての故障を検出しました');
  process.exit(escaped ? 1 : 0);
}
