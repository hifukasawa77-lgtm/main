#!/usr/bin/env node
/*
 * verify-receipt-ocr.mjs — receipt-ocr.html（レシートOCR家計簿）の必須チェック
 *
 * 「例外0件＝読めている」ではない。2026-09-25 まで本ページは、Tesseract の日本語モデルが
 * 数字を「①②③」（丸数字）、¥を「\」で返すせいで、**価格を1件も拾えないまま例外も出さずに
 * 「0件の品目を抽出」と表示していた**（合成レシート12枚で0品目）。検査は抽出結果の中身まで見る。
 *
 *   1. 解析: 実際の Tesseract 出力（丸数字・\・漢字間の空白入り）から品目・値引・数量・外税・合計
 *   2. 画像補正: 傾けた・影を付けたレシートの角度・紙の検出（0°の偽ピーク回帰を含む）
 *   3. 画面: 偽のOCRエンジンで 取り込み→自動読取→検算→家計簿へ記録→集計→編集→削除→CSV
 *   4. 安全: 品目名に仕込んだHTMLが実行されない／localStorage が使えなくても起動する
 *
 * 実物の Tesseract で精度を測るときは --ocr を付ける（npm から本体と日本語モデルを取得。数分かかる）。
 *
 * 使い方: node scripts/verify-receipt-ocr.mjs [--ocr]
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL_OCR = process.argv.includes('--ocr');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.join(ROOT, url === '/' ? 'receipt-ocr.html' : url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? '  ' + extra : ''}`); }
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
});

// ---- 実際の Tesseract(jpn) の出力（2026-09-25 採取）。丸数字・「\」・漢字間の空白がそのまま入っている ----
const RAW_A = `フレッシュマート
青葉台店
TEL 0④⑤-⑨⑧①-②②③③
⑳②⑥年⑨月⑳日(日) ⑱:③②
レジ00③ 担当 佐藤

領 収 証

※牛乳 ⑩00ml                      \\②③⑧
※食パン ⑥枚切              \\ ⑮⑧
※バナナ                 \\①⑨⑧
※豚こま切落し              \\ ④⑨⑧

値引                         -①00
※たまご ⑩個

②個 x 単②⑤⑧                  \\⑤①⑥
※キャベツ                \\①⑦⑧
※醤油 ①L                       \\③②⑧
小計 。 ⑧点                   \\②, 0①④
外税⑧%対象額              \\ ②,0①④
外税⑧%                  \\①⑥①
合。 言                 \\②, ⑰⑤
お預り                       \\⑤, 000
お釣り                       \\②, ⑧②⑤

※印は軽減税率対象商品です
ありがとうございました`;

const RAW_C = `くすりのミドリ
中央通り店
TEL 06-6123-4567
R8.9.15 20:11
No. 4521

※シャンプー 詰替                                         \\ 548

値引                                                   -50
※ティッシュ 5箱             \\398
※歯ブラシ

3個 X 単198                                      \\594
※目薬                                                   \\880
※ヨーグルト               \\ 138
小計 7点                                       \\2, 508
外税10%対象額                                      \\2,508
外税10%                  \\ 250
合 計                                        \\2, 758
お預り                                                 \\5, 000
お釣り                                                 \\2, 242`;

// 偽のOCRエンジン: 渡されたテキストを行ごとの信頼度つきで返す。passes[i] が i 回目の読み取り結果
const fakeEngine = (passes) => `
  window.__RECEIPT_OCR_ENGINE = function () {
    var passes = ${JSON.stringify(passes)}, n = 0;
    window.__ocrCalls = [];
    return Promise.resolve({
      setParameters: function (p) { window.__ocrCalls.push({ psm: p.tessedit_pageseg_mode }); return Promise.resolve(); },
      recognize: function (img) {
        var t = passes[Math.min(n, passes.length - 1)]; n++;
        window.__ocrCalls[window.__ocrCalls.length - 1].w = img && img.width;
        var lines = t.split('\\n').map(function (s) { return { text: s + '\\n', confidence: /楽|衝/.test(s) ? 40 : 88 }; });
        return Promise.resolve({ data: { text: t, confidence: 85, blocks: [{ paragraphs: [{ lines: lines }] }] } });
      },
      terminate: function () {}
    });
  };`;

async function newPage(init = '') {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  // CDN（Tesseract本体）はこの検査では使わない。届かなくても偽エンジンで動くことを確かめる
  await page.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com)\//, (r) => r.fulfill({ status: 404, body: '' }));
  if (init) await page.addInitScript(init);
  await page.goto(`${BASE}/receipt-ocr.html`, { waitUntil: 'load' });
  return { page, errors };
}

// 合成レシート画像（canvas で描いて傾け・影を付ける）を PNG の Buffer で返す
async function makeReceiptImage(page, { rot = 0, shade = 0, bg = true, blur = 0, desk = '#4a3a2c' }) {
  const b64 = await page.evaluate(async ({ rot, shade, bg, blur, desk }) => {
    const lines = ['テストマート', '2026年9月20日 18:32', '------------------------', '牛乳 1000ml            ¥238',
      '食パン 6枚切           ¥158', 'バナナ                 ¥198', '豚こま切落し           ¥498', 'キャベツ               ¥178',
      '醤油 1L                ¥328', 'たまご 10個            ¥258', '------------------------', '小計                 ¥1,856',
      '合計                 ¥1,856', 'お預り               ¥2,000', 'お釣り                 ¥144'];
    const r = document.createElement('canvas'); r.width = 620; r.height = 60 + lines.length * 44;
    const x = r.getContext('2d'); x.fillStyle = '#fdfdfb'; x.fillRect(0, 0, r.width, r.height);
    x.fillStyle = '#222'; x.font = '26px "IPAGothic", monospace';
    // 実物のレシート同様、金額は右寄せ（空白での桁揃えはフォント次第で右端に来ない）
    lines.forEach((l, i) => {
      const m = l.match(/^(.*?)\s{2,}(¥[\d,]+)$/);
      if (!m) { x.textAlign = 'left'; x.fillText(l, 30, 60 + i * 44); return; }
      x.textAlign = 'left'; x.fillText(m[1], 30, 60 + i * 44);
      x.textAlign = 'right'; x.fillText(m[2], r.width - 30, 60 + i * 44);
    });
    const pad = bg ? 260 : 0, W = r.width + pad * 2, H = r.height + pad * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const y = c.getContext('2d');
    y.fillStyle = bg ? desk : '#fdfdfb'; y.fillRect(0, 0, W, H);
    y.save(); y.translate(W / 2, H / 2); y.rotate(rot * Math.PI / 180);
    if (blur) y.filter = `blur(${blur}px)`;
    y.drawImage(r, -r.width / 2, -r.height / 2); y.restore(); y.filter = 'none';
    if (shade) {
      const g = y.createRadialGradient(W * 0.85, H * 0.2, 10, W * 0.85, H * 0.2, Math.max(W, H) * 0.9);
      g.addColorStop(0, `rgba(0,0,0,${shade})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      y.fillStyle = g; y.fillRect(0, 0, W, H);
    }
    return c.toDataURL('image/png').split(',')[1];
  }, { rot, shade, bg, blur, desk });
  return Buffer.from(b64, 'base64');
}

/* ───────────────────────── 1. 解析 ───────────────────────── */
console.log('\n── 1. 解析（実際のTesseract出力から） ─────────');
{
  const { page, errors } = await newPage(fakeEngine(['']));
  const r = await page.evaluate(({ A, C }) => {
    const O = window.__receiptOCR;
    const pa = O.parseFull(A), ta = O.resolveTotals(pa.items, pa.info);
    const pc = O.parseFull(C), tc = O.resolveTotals(pc.items, pc.info);
    return {
      norm1: O.normalizeLine('\\②, 0①④'), norm2: O.normalizeLine('合 計'), norm3: O.normalizeLine('⑳②⑥年'),
      a: pa.items, ta, c: pc.items, tc,
      metaA: O.detectMeta(A), metaC: O.detectMeta(C),
      // 「合計」が読めなくても お預り−お釣り で合計を出せるか
      tFallback: O.detectTotal('※パン ¥300\n※牛乳 ¥200\n合。叶 ¥5?0\nお預り ¥1,000\nお釣り ¥500'),
      inlineQty: O.parseReceipt('卵 10個パック ¥258'),
      xss: O.parseReceipt('<img src=x onerror=alert(1)> ¥100')
    };
  }, { A: RAW_A, C: RAW_C });
  check('丸数字と「\\」を金額に直す（\\②, 0①④ → ¥2,014）', r.norm1 === '¥2,014', r.norm1);
  check('漢字の間の空白を詰める（合 計 → 合計）', r.norm2 === '合計', r.norm2);
  check('丸数字の年（⑳②⑥年 → 2026年）', r.norm3 === '2026年', r.norm3);
  const names = r.a.map((i) => i.name);
  check('品目を7件＋値引1件拾う（旧版は0件）', r.a.length === 8, JSON.stringify(r.a.map((i) => `${i.name}:${i.qty}×${i.price}`)));
  check('値引は直前の品目に付く負の金額（カテゴリーも元の品目と同じ）', r.a.some((i) => i.price === -100 && /値引.*豚こま/.test(i.name) && i.cat === '肉類'));
  const egg = r.a.find((i) => /たまご/.test(i.name));
  check('次の行の「2個×単258」を数量と単価にする', egg && egg.qty === 2 && egg.price === 258, egg && `${egg.qty}×${egg.price}`);
  check('「たまご 10個」の10個を数量と取り違えない', !r.a.some((i) => i.qty === 10));
  check('「合。言」（合計の誤読）でも合計 ¥2,175', r.ta.total === 2175, `total=${r.ta.total}`);
  check('外税 ¥161 を拾い、品目計＋外税＝合計', r.ta.taxOut === 161 && r.ta.sum + r.ta.taxOut === r.ta.total, `sum=${r.ta.sum} tax=${r.ta.taxOut}`);
  check('合計・小計・支払い行を品目にしない', !names.some((n) => /小計|合計|預|釣|外税/.test(n)));
  check('店名は2行を繋ぐ（フレッシュマート青葉台店）', r.metaA.store === 'フレッシュマート青葉台店', r.metaA.store);
  check('丸数字の日付を読む（2026-09-20）', r.metaA.date === '2026-09-20', r.metaA.date);
  check('和暦 R8.9.15 → 2026-09-15', r.metaC.date === '2026-09-15', r.metaC.date);
  check('「R8.9.15 20:11」の行を品目にしない（行末の11を金額にしない）', !r.c.some((i) => /R8|20/.test(i.name)), JSON.stringify(r.c.map((i) => i.name)));
  const brush = r.c.find((i) => /歯ブラシ/.test(i.name));
  check('品名だけの行＋「3個 X 単198 ¥594」を1品目にする', brush && brush.qty === 3 && brush.price === 198);
  check('ドラッグストア: 品目計＋外税＝合計 ¥2,758', r.tc.total === 2758 && r.tc.sum + r.tc.taxOut === 2758, `sum=${r.tc.sum} tax=${r.tc.taxOut}`);
  check('合計が読めなくても お預り−お釣り で合計を出す', r.tFallback === 500, `total=${r.tFallback}`);
  check('×の無い「10個」は数量にしない', r.inlineQty.length === 1 && r.inlineQty[0].qty === 1);
  check('例外0件', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ───────────────────────── 2. 画像補正 ───────────────────────── */
console.log('\n── 2. 画像補正（紙の検出・傾き・文字の高さ） ─────');
{
  const { page, errors } = await newPage(fakeEngine(['']));
  const cases = [
    { name: '傾き+3.5°・影あり', rot: 3.5, shade: 0.5, want: -3.5 },
    { name: '傾き-6.5°・影あり・ぼけ', rot: -6.5, shade: 0.6, blur: 1.2, want: 6.5 },
    { name: '傾き0°（机の上）', rot: 0, shade: 0, want: 0 },
    { name: 'スキャン（紙が画面いっぱい）', rot: 0, bg: false, want: 0, scan: true }
  ];
  for (const c of cases) {
    const png = await makeReceiptImage(page, { rot: c.rot, shade: c.shade || 0, bg: c.bg !== false, blur: c.blur || 0 });
    const an = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const a = window.__receiptOCR.analyzeImage(img);
      return { phi: a.phi, sideways: a.sideways, paperRatio: a.paperRatio, charH: a.charH };
    }, png.toString('base64'));
    check(`${c.name}: 角度 ${c.want}°±0.6`, Math.abs(an.phi - c.want) <= 0.6 && !an.sideways, `phi=${an.phi} sideways=${an.sideways}`);
    if (c.scan) check(`${c.name}: 切り抜かない（紙=100%）`, an.paperRatio === 1, `paper=${an.paperRatio}`);
    else check(`${c.name}: 影があっても紙を1枚として検出`, an.paperRatio > 0.2 && an.paperRatio < 0.8, `paper=${an.paperRatio.toFixed(2)}`);
    check(`${c.name}: 文字の高さを測れる`, an.charH > 10 && an.charH < 60, `charH=${an.charH && an.charH.toFixed(1)}`);
  }
  // 価格の列（右端）が補正後も残っているか。紙マスクで塗ると濃い影の所で列ごと白く消えていた。
  // 影あり/なしの比較だけだと、両方とも同じだけ消える壊れ方を見逃すので、右端の列に文字が
  // 「全体のインクの一定割合ある」ことを影なしでも確かめる
  const inkShare = async (png) => page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const O = window.__receiptOCR, c = O.renderProcessed(img, O.analyzeImage(img), { variant: 'norm' });
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let right = 0, all = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 128) { all++; if ((i / 4) % c.width > c.width * 0.66) right++; }
    return right / Math.max(1, all);
  }, png.toString('base64'));
  // 机は灰色（影の中の紙と色で区別できない、いちばん厳しい条件）
  const shClear = await inkShare(await makeReceiptImage(page, { rot: 2, shade: 0, desk: '#6a6a6a' }));
  const shShade = await inkShare(await makeReceiptImage(page, { rot: 2, shade: 0.85, desk: '#6a6a6a' }));
  check('価格の列（右端）が補正後も残る', shClear > 0.2, `右端のインク比率=${shClear.toFixed(2)}`);
  check('濃い影の側でも価格の列が消えない（影なしの8割以上）', shShade > shClear * 0.8, `影なし=${shClear.toFixed(2)} 影あり=${shShade.toFixed(2)}`);
  check('例外0件', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ───────────────────────── 3. 画面（取り込み→家計簿） ───────────────────────── */
console.log('\n── 3. 画面: 取り込み→自動読取→検算→家計簿 ─────');
{
  // 1回目は品目の金額が1つ読めていない（検算が合わない）→ 2回目で合う、を再現する
  const BAD = RAW_A.replace('※キャベツ                \\①⑦⑧', '※キャベツ');
  const XSS = RAW_A.replace('※バナナ', '※<img src=x onerror="window.__pwned=1">バナナ');
  const { page, errors } = await newPage(fakeEngine([BAD, XSS]));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  const png = await makeReceiptImage(page, { rot: 3, shade: 0.4 });
  await page.setInputFiles('#file', { name: 'r.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => /完了|失敗/.test(document.getElementById('status').textContent), null, { timeout: 30000 });
  const st = await page.evaluate(() => ({
    status: document.getElementById('status').textContent,
    rows: document.querySelectorAll('#rows tr').length,
    calls: window.__ocrCalls,
    ok: document.getElementById('reconcile').style.display !== 'none',
    store: document.getElementById('meta-store').value, date: document.getElementById('meta-date').value,
    tax: document.getElementById('meta-tax').value,
    total: document.getElementById('sum-total').textContent,
    low: document.querySelectorAll('#rows tr.low').length,
    pwned: !!window.__pwned, imgInTable: !!document.querySelector('#rows img')
  }));
  check('画像を選ぶだけで読み取りが始まる（ボタン不要）', /完了/.test(st.status), st.status);
  check('検算が合わない読み取りは、読み方を変えて読み直す', st.calls && st.calls.length === 2 && st.calls[0].psm !== st.calls[1].psm, JSON.stringify(st.calls));
  check('補正後の画像（数百px以上）をOCRへ渡す', st.calls && st.calls[0].w > 300, `w=${st.calls && st.calls[0].w}`);
  check('検算が合った読み取りを採用し「一致」を表示', st.ok && st.rows === 8, `rows=${st.rows}`);
  check('店名・日付・外税を自動入力', st.store === 'フレッシュマート青葉台店' && st.date === '2026-09-20' && st.tax === '161', `${st.store} ${st.date} tax=${st.tax}`);
  check('支払合計 ¥2,175', st.total === '¥2,175', st.total);
  check('品目名のHTMLを実行しない（XSS）', !st.pwned && !st.imgInTable);

  await page.click('#save-ledger');
  await page.waitForTimeout(200);
  const lg = await page.evaluate(() => ({
    month: document.getElementById('m-label').textContent,
    total: document.getElementById('st-total').textContent,
    entries: document.querySelectorAll('#entries .entry').length,
    cats: [...document.querySelectorAll('#cat-list .cat-row')].map((r) => r.textContent),
    stored: JSON.parse(localStorage.getItem('receiptOCR.ledger.v1') || '[]'),
    rowsAfter: document.querySelectorAll('#rows tr').length,
    csv: window.__receiptOCR.ledgerCSV('2026-09').csv
  }));
  check('家計簿に記録され、その月へ移動する', lg.entries === 1 && lg.month === '2026年9月', `${lg.month} entries=${lg.entries}`);
  check('月の支出＝支払合計（外税込み） ¥2,175', lg.total === '¥2,175', lg.total);
  check('カテゴリー別の合計が月の支出と一致（外税も按分）',
    lg.cats.length >= 4 && lg.stored[0] && Math.abs(Object.values(await page.evaluate(() => window.__receiptOCR.monthTotals(window.__receiptOCR.loadLedger(), '2026-09').cats)).reduce((a, b) => a + b, 0) - 2175) <= 3,
    lg.cats.slice(0, 3).join(' / '));
  check('記録後は入力欄が空に戻る', lg.rowsAfter === 0);
  check('家計簿CSVに外税の行と金額列がある', /外税/.test(lg.csv) && /購入日,店名,品目名,カテゴリー,個数,単価,金額,備考/.test(lg.csv));

  // 編集 → 更新（件数が増えない）
  await page.click('#entries .entry summary');
  await page.click('#entries .entry .acts .chip:not(.danger)');
  await page.fill('#meta-store', '編集後ストア');
  await page.click('#save-ledger');
  await page.waitForTimeout(200);
  const ed = await page.evaluate(() => ({ n: JSON.parse(localStorage.getItem('receiptOCR.ledger.v1')).length, store: JSON.parse(localStorage.getItem('receiptOCR.ledger.v1'))[0].store }));
  check('編集して更新しても記録は1件のまま', ed.n === 1 && ed.store === '編集後ストア', JSON.stringify(ed));

  // 再読込しても残る
  await page.reload();
  const kept = await page.evaluate(() => document.querySelectorAll('#entries .entry').length);
  check('再読込後も家計簿が残る', kept === 1);

  // 削除
  await page.click('#entries .entry summary');
  await page.click('#entries .entry .chip.danger');
  await page.waitForTimeout(100);
  const del = await page.evaluate(() => JSON.parse(localStorage.getItem('receiptOCR.ledger.v1')).length);
  check('削除できる', del === 0);
  check('例外0件', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ───────────────────────── 4. 保存領域が使えない端末 ───────────────────────── */
console.log('\n── 4. localStorage が使えない端末 ─────────────');
{
  const { page, errors } = await newPage(`
    Object.defineProperty(window, 'localStorage', { get: function () { throw new Error('SecurityError'); } });
    ${fakeEngine([RAW_A])}`);
  const ok = await page.evaluate(() => !!window.__receiptOCR && document.getElementById('m-label').textContent.length > 0);
  check('localStorage が例外を投げても起動する（シークレットタブ等）', ok && errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ───────────────────────── 5. 実物のTesseract（--ocr） ───────────────────────── */
if (REAL_OCR) {
  console.log('\n── 5. 実物のTesseractで読む（npmから取得） ─────');
  const cache = path.join(os.tmpdir(), 'receipt-ocr-npm');
  fs.mkdirSync(cache, { recursive: true });
  const pkgs = [['tesseract.js', 'tesseract.js-7.0.0.tgz', 'tjs'], ['tesseract.js-core', 'tesseract.js-core-7.0.0.tgz', 'core'], ['@tesseract.js-data/jpn', 'jpn-1.0.0.tgz', 'jpn']];
  for (const [name, tgz, dir] of pkgs) {
    if (fs.existsSync(path.join(cache, dir, 'package'))) continue;
    execFileSync('curl', ['-sfo', path.join(cache, tgz), `https://registry.npmjs.org/${name}/-/${tgz}`]);
    fs.mkdirSync(path.join(cache, dir), { recursive: true });
    execFileSync('tar', ['xzf', path.join(cache, tgz), '-C', path.join(cache, dir)]);
  }
  const map = (u) => {
    let m;
    if ((m = u.match(/tesseract\.js@v?[\d.]+\/dist\/(.+)$/))) return path.join(cache, 'tjs/package/dist', m[1]);
    if ((m = u.match(/tesseract\.js-core@v?[\d.]+\/(.+)$/))) return path.join(cache, 'core/package', m[1]);
    if ((m = u.match(/@tesseract\.js-data\/jpn@[\d.]+\/([\w.]+)\/(jpn\.traineddata\.gz)$/))) return path.join(cache, 'jpn/package', m[1], m[2]);
    return null;
  };
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\//, (r) => {
    const f = map(r.request().url());
    if (!f || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*',
      'Content-Type': f.endsWith('.js') ? 'application/javascript' : f.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' } });
  });
  await page.goto(`${BASE}/receipt-ocr.html`);
  for (const c of [{ name: '机の上・傾き3°・影', rot: 3, shade: 0.45 }, { name: 'スキャン', rot: 0, bg: false }]) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    const png = await makeReceiptImage(page, { rot: c.rot, shade: c.shade || 0, bg: c.bg !== false });
    await page.setInputFiles('#file', { name: 'r.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => /完了|失敗/.test(document.getElementById('status').textContent), null, { timeout: 300000 });
    const r = await page.evaluate(() => ({
      prices: [...document.querySelectorAll('#rows [data-k="price"]')].map((e) => +e.value),
      ok: document.getElementById('reconcile').style.display !== 'none', status: document.getElementById('status').textContent
    }));
    const want = [238, 158, 198, 498, 178, 328, 258];
    const hit = want.filter((p) => r.prices.includes(p)).length;
    check(`${c.name}: 価格7件中6件以上を正しく読む`, hit >= 6, `${hit}/7 ${r.status}`);
    check(`${c.name}: 合計と一致`, r.ok);
  }
  check('例外0件', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${fail ? '❌ FAIL' : '✅ PASS'}  ${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
