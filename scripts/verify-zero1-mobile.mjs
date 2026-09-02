#!/usr/bin/env node
/*
 * verify-zero1-mobile.mjs — zero-1-mobile.html（スマホ内で動くAI）の必須チェック
 *
 * このページは**この環境では推論そのものを検査できない**。WebGPUのあるGPUが要り、
 * モデルの重みも1GB級のダウンロードが要るため。だから「動く／動かない」ではなく、
 * その手前で静かに壊れる部分を見る:
 *   - 起動して例外0件か（モジュール読み込み・importmap・CSPの誤りはここで出る）
 *   - WebGPUが無い端末に、**理由と打つ手を出しているか**（黙って白い画面にしない）
 *   - モデルIDが実在するか（実在しないIDは読み込みが始まらず理由も出ない）
 *   - 端末メモリからのモデル選びが、載らないモデルを既定にしないか
 *   - 会話の組み立てで、最後の質問を落としていないか
 *
 * 使い方: node scripts/verify-zero1-mobile.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'zero-1-mobile.html';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.join(ROOT, url === '/' ? PAGE : url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (n, e='') => { pass++; console.log(`  ✅ ${n}${e ? '  ' + e : ''}`); };
const ng = (n, e='') => { fail++; console.log(`  ❌ ${n}${e ? '  ' + e : ''}`); };
const check = (n, cond, e='') => (cond ? ok(n, e) : ng(n, e));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--no-sandbox'],
});
// スマホの画面で見る。PCの幅で確かめると、実機でだけ崩れる崩れ方を見逃す
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
});

const errors = [];
const missing = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });

console.log('\n== ZERO-1 Mobile の検査 ==');
await page.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 }).catch(() => {});

check('1. 起動時の例外が0件', errors.length === 0, errors.slice(0, 2).join(' / '));
check('2. 読み込めないファイルが無い', missing.length === 0, missing.slice(0, 2).join(' / '));
check('3. 検査用の橋渡しが開いている', await page.evaluate(() => typeof window.ZERO1_MOBILE?.recommendModel === 'function'));

// --- WebGPU が無い端末の見え方 ------------------------------------------------
// ヘッドレスChromiumにはWebGPUが無い。深澤さんの古い端末で起きうる状態と同じなので、
// ここで「黙って白い画面」になっていないかを確かめられる
// ★`navigator.gpu` の有無で分岐してはいけない。オブジェクトは在るのにアダプタが
//   取れない環境（このヘッドレスChromiumがまさにそれ）では非対応と判定されるため、
//   一番確かめたい「非対応時の見え方」がまるごと対象外になる（実際に一度そうなった）。
//   ページ自身の判定と同じ経路で聞く。
const runnable = await page.evaluate(async () => {
  let adapter = null;
  try { adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null; } catch { adapter = null; }
  return window.ZERO1_MOBILE.canRun({ webgpu: Boolean(adapter), secure: window.isSecureContext });
});
const checksText = await page.locator('#checks').innerText();
check('4. 端末の確認結果を必ず出す', checksText.trim().length > 0, checksText.split('\n')[0]);
if (!runnable) {
  check('5. WebGPU非対応を、理由付きで伝える', /WebGPU/.test(checksText) && /対応していません|unavailable/i.test(checksText));
  check('6. 打つ手を書いている（Chromeの更新）', /Chrome/.test(checksText) || /Chrome/.test(await page.locator('#progress-note').innerText()));
  check('7. 動かせない端末では起動ボタンを押させない', await page.locator('#btn-start').isDisabled());
} else {
  // 動かせる環境なら、起動ボタンは押せる状態でなければならない
  check('5-7. 動かせる端末では起動できる', !(await page.locator('#btn-start').isDisabled()));
}

// --- モデル一覧 ---------------------------------------------------------------
const models = await page.evaluate(() => window.ZERO1_MOBILE.MODELS);
check('8. モデルが4段階そろっている', models.length === 4, models.map((m) => m.name).join(' / '));
check('9. モデルの選択肢が画面に出る', await page.locator('#models .model').count() === models.length);
check('10. 大きさをGBで見せる（落とす前に分かる）',
  /GB/.test(await page.locator('#models .model .size').first().innerText()));

// ★実在しないモデルIDは、読み込みが始まらず理由も出ない。npm の実体と突き合わせる
const shipped = path.join(ROOT, 'node_modules/@mlc-ai/web-llm/lib/index.js');
if (fs.existsSync(shipped)) {
  const { prebuiltAppConfig } = await import(`file://${shipped}`);
  const available = prebuiltAppConfig.model_list.map((m) => m.model_id);
  const bogus = models.filter((m) => !available.includes(m.id));
  check('11. すべてのモデルIDが実在する', bogus.length === 0, bogus.map((m) => m.id).join(' / '));
} else {
  console.log('  ⏭️ 11. モデルIDの実在確認は skip（npm i @mlc-ai/web-llm で有効になります）');
}

// ★版を上げて integrity を取り直し忘れると、CDNの中身と一致せず**読み込みが丸ごと失敗**する。
//   版とハッシュが同じURLを指しているかだけは、ここで必ず突き合わせる
const importmap = JSON.parse(fs.readFileSync(path.join(ROOT, PAGE), 'utf8')
  .match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
const libUrl = importmap.imports['web-llm'];
check('11b. ライブラリの版を固定している', /@mlc-ai\/web-llm@\d+\.\d+\.\d+\//.test(libUrl), libUrl);
// ★検査に使う版が、ページが実際に読む版と違っては意味がない。
//   package.json を ^ 付きにすると別の版が入り、違う一覧に対してIDを確かめてしまう
const pinned = libUrl.match(/web-llm@([\d.]+)\//)?.[1];
const declared = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  .devDependencies?.['@mlc-ai/web-llm'];
check('11a. 検査に使う版と、ページが読む版が同じ', declared === pinned, `package.json ${declared} / ページ ${pinned}`);
check('11c. 固定した版そのものに integrity が付いている',
  typeof importmap.integrity?.[libUrl] === 'string' && importmap.integrity[libUrl].startsWith('sha384-'),
  Object.keys(importmap.integrity ?? {}).join(' / '));

// --- モデル選び ---------------------------------------------------------------
const pick = await page.evaluate(() => {
  const { recommendModel, MODELS } = window.ZERO1_MOBILE;
  const all = MODELS.map((m) => m.id);
  return {
    tiny: recommendModel(2, all)?.id,
    mid: recommendModel(4, all)?.id,
    big: recommendModel(8, all)?.id,
    unknown: recommendModel(NaN, all)?.id,
    narrowed: recommendModel(8, [MODELS[0].id])?.id,
    empty: recommendModel(8, []),
  };
});
check('12. メモリが少ない端末には軽いモデル', pick.tiny === models[0].id, pick.tiny);
check('13. メモリに余裕があれば大きいモデル', pick.big === models[3].id, pick.big);
check('14. メモリが分からないときは真ん中（落としてから失敗させない）',
  pick.unknown === models[1].id, pick.unknown);
check('15. 使えるIDだけから選ぶ', pick.narrowed === models[0].id, pick.narrowed);
check('16. 候補が空なら黙って壊れずnullを返す', pick.empty === null);

// ★メモリだけ見て空き容量を見ないと、載るのに保存できないモデルを勧めてしまう。
//   8GBメモリでも空きが1GBしかない端末は珍しくない。2.4GB落としてから失敗するのは、
//   携帯回線なら通信量まで無駄になる一番痛い外し方（実際にこの実装をしていた）
const storage = await page.evaluate(() => {
  const { recommendModel, storageFit, MODELS } = window.ZERO1_MOBILE;
  const all = MODELS.map((m) => m.id);
  return {
    tight: recommendModel(8, all, 1.0)?.id,     // メモリは潤沢だが空きが1GB
    roomy: recommendModel(8, all, 20)?.id,      // 空きも潤沢
    unknown: recommendModel(8, all, NaN)?.id,   // 空きが分からない端末は妨げない
    none: recommendModel(8, all, 0.2)?.id,      // どれも入らない → 一番軽いもの
    fitNo: storageFit(MODELS[3], 1.0),
    fitTight: storageFit(MODELS[0], 1.0),
    fitYes: storageFit(MODELS[0], 20),
    fitUnknown: storageFit(MODELS[3], NaN),
  };
});
check('16b. 空きが少ない端末には、保存できるモデルを勧める',
  storage.tight === models[0].id, storage.tight);
check('16c. 空きが十分ならメモリ基準で選ぶ', storage.roomy === models[3].id, storage.roomy);
check('16d. 空きが分からない端末を妨げない', storage.unknown === models[3].id, storage.unknown);
check('16e. どれも入らなくても、一番軽いものを返す（nullで詰まらせない）',
  storage.none === models[0].id, storage.none);
check('16f. 入る／ぎりぎり／入らない を区別する',
  storage.fitNo === 'no' && storage.fitTight === 'tight' && storage.fitYes === 'yes' && storage.fitUnknown === 'unknown',
  `${storage.fitNo}/${storage.fitTight}/${storage.fitYes}/${storage.fitUnknown}`);

// 失敗したとき、スマホには開発者ツールが無い。そのまま渡せる手掛かりを画面へ出すこと
const failureFields = await page.evaluate(() => {
  const box = document.getElementById('failure-detail');
  return { exists: Boolean(box), copy: Boolean(document.getElementById('btn-copy')) };
});
check('16g. 失敗の手掛かりを画面に出す仕掛けがある', failureFields.exists && failureFields.copy);

// ★実機で踏んだ壁（2026-09-01）。WebGPUは「対応しています」と緑で出るのに、
//   float16 が使えない端末では q4f16 のモデルがシェーダーのコンパイルで落ちる:
//   「[Invalid ShaderModule] ... entryPoint: "index_kernel"」
//   画面上は緑なのに起動だけ失敗するので、対応の有無を必ず見て切り替える
const precision = await page.evaluate(() => {
  const { resolveModels, MODEL_TIERS, deviceReport } = window.ZERO1_MOBILE;
  const f16 = resolveModels(true);
  const f32 = resolveModels(false);
  return {
    f16ids: f16.map((m) => m.id),
    f32ids: f32.map((m) => m.id),
    tiers: MODEL_TIERS.length,
    sameKeys: f16.every((m, i) => m.key === f32[i].key),
    f32Bigger: f16.every((m, i) => f32[i].sizeMB >= m.sizeMB),
    noteWhenMissing: deviceReport({ webgpu: true, f16: false, secure: true, memoryGB: 4, storageGB: 10 })
      .map((r) => r.text).join(' / '),
    noteWhenPresent: deviceReport({ webgpu: true, f16: true, secure: true, memoryGB: 4, storageGB: 10 })
      .map((r) => r.text).join(' / '),
  };
});
check('16h. float16の有無で別のモデルへ切り替える',
  precision.f16ids.every((id) => /q4f16_1/.test(id)) && precision.f32ids.every((id) => /q4f32_1/.test(id)),
  precision.f32ids[1]);
check('16i. どちらの精度でも段（軽い〜かしこい）が揃っている',
  precision.tiers === 4 && precision.sameKeys && precision.f16ids.length === 4 && precision.f32ids.length === 4);
check('16j. float32版は容量が大きいことを正しく持っている', precision.f32Bigger);
check('16k. float16が無い端末に、その旨と対処を伝える',
  /float16/.test(precision.noteWhenMissing) && /float32/.test(precision.noteWhenMissing),
  precision.noteWhenMissing.split(' / ')[1]);
check('16l. float16がある端末には余計な警告を出さない',
  /float16 が使えます/.test(precision.noteWhenPresent));

// float32版のIDも実在しなければ、切り替えた先で同じように失敗する
if (fs.existsSync(shipped)) {
  const { prebuiltAppConfig } = await import(`file://${shipped}`);
  const available = prebuiltAppConfig.model_list.map((m) => m.model_id);
  const bogus = [...precision.f16ids, ...precision.f32ids].filter((id) => !available.includes(id));
  check('16m. 両方の精度のモデルIDが実在する', bogus.length === 0, bogus.join(' / '));
}

// --- 会話の組み立て -----------------------------------------------------------
const built = await page.evaluate(() => {
  const history = Array.from({ length: 14 }, (unused, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant', text: `発言${i}`,
  }));
  // 長文を貼られた直後に質問する、という実際にありがちな並び
  history.push({ role: 'assistant', text: 'あ'.repeat(5000) });
  const question = 'これを3行にまとめて'.repeat(200);
  history.push({ role: 'user', text: question });
  const messages = window.ZERO1_MOBILE.buildMessages(history, 4, 100);
  const last = messages[messages.length - 1];
  return {
    first: messages[0].role,
    lastWhole: last.content === question,
    lastLength: last.content.length,
    longestPast: Math.max(...messages.slice(1, -1).map((m) => m.content.length)),
    length: messages.length,
  };
});
check('17. 人格を必ず先頭に置く', built.first === 'system');
// ★ここを切ると、残った文脈に対して答えてしまい、例外も出ないまま見当違いの返事になる
check('18. 直近の質問だけは長くても切らない', built.lastWhole, `${built.lastLength}文字`);
check('19. 過去の長文は切って送る（窓を食い潰させない）', built.longestPast <= 101, `最長 ${built.longestPast}文字`);
check('20. 古い会話は落として送る', built.length <= 6, `${built.length}件`);

// --- 進捗の見せ方 -------------------------------------------------------------
const progress = await page.evaluate(() => [
  window.ZERO1_MOBILE.progressText({ progress: 0.42, text: 'Fetching param cache' }),
  window.ZERO1_MOBILE.progressText({}),
]);
check('21. 進捗は%と中身の両方を出す（止まって見えないように）',
  progress[0].percent === 42 && /Fetching/.test(progress[0].label), progress[0].label);
check('22. 進捗が空でも壊れない', progress[1].percent === 0);

// --- 画面（スマホ幅） ---------------------------------------------------------
const layout = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  inputFont: parseFloat(getComputedStyle(document.getElementById('input')).fontSize),
}));
check('23. 横スクロールが出ない', layout.overflow <= 1, `はみ出し ${layout.overflow}px`);
// canvas は置換要素で既定300×150。inset:0 だけでは伸びず、背景の残像が左上にだけ残って
// 矩形の切れ目が出る（実際にスクリーンショットで見つけた）
const bg = await page.evaluate(() => {
  const canvas = document.getElementById('bg-canvas');
  return { w: canvas.offsetWidth, h: canvas.offsetHeight, vw: window.innerWidth, vh: window.innerHeight };
});
check('23b. 背景canvasが画面いっぱいに広がっている',
  bg.w >= bg.vw - 1 && bg.h >= bg.vh - 1, `${bg.w}x${bg.h} / 画面 ${bg.vw}x${bg.vh}`);
// 16px未満だと、入力欄をタップした瞬間にブラウザが勝手にズームして画面が崩れる
check('24. 入力欄の文字が16px以上（タップ時の自動ズーム回避）', layout.inputFont >= 16, `${layout.inputFont}px`);

// --- 人格 ---------------------------------------------------------------------
const prompt = await page.evaluate(() => window.ZERO1_MOBILE.SYSTEM_PROMPT);
check('25. 事故1（英語で書いてから訳す）への対策が入っている', /訳す/.test(prompt) && /禁止/.test(prompt));
check('26. 事故2（聞き返しだけを返す）への対策が入っている', /質問だけを返しては/.test(prompt));
check('27. 健康・法律・お金を断定させない', /健康|医療/.test(prompt) && /専門家/.test(prompt));

// --- 端末を丸ごと再現して、画面が本当に切り替えているかを見る -------------------
// ★純粋関数が正しくても、画面がそれを使っていなければ意味がない。
//   実際、resolveModels は正しいのに画面が固定の一覧を使う改変が、
//   関数だけの検査ではすり抜けた（故障注入で判明）。ここは通しで確かめる。
async function withDevice({ f16, memoryGB, quotaGB }) {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(([hasF16, mem, quota]) => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: async () => ({ features: new Set(hasF16 ? ['shader-f16'] : []) }),
    }});
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: mem });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      estimate: async () => ({ quota: quota * 1e9, usage: 0 }),
    }});
  }, [f16, memoryGB, quotaGB]);
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  const result = await scoped.evaluate(() => ({
    checks: document.getElementById('checks').innerText,
    selected: window.ZERO1_MOBILE_STATE?.model ?? '',
    sizes: [...document.querySelectorAll('.model .size')].map((n) => n.textContent),
    startEnabled: !document.getElementById('btn-start').disabled,
  }));
  await scoped.close();
  return result;
}

// 深澤さんの端末そのもの（WebGPUあり・float16なし・メモリ4GB・空き10.7GB）
const noF16 = await withDevice({ f16: false, memoryGB: 4, quotaGB: 10.7 });
check('28. float16が無い端末で、画面がfloat32版を並べる',
  /q4f32_1/.test(noF16.selected), noF16.selected);
check('29. その端末にも「float32を使う」と伝える', /float32/.test(noF16.checks));
check('30. 一覧の容量もfloat32版の値になる', noF16.sizes[0] === '1.0GB', noF16.sizes.join(' '));
check('31. その端末でも起動できる（止めない）', noF16.startEnabled);

const withF16 = await withDevice({ f16: true, memoryGB: 4, quotaGB: 10.7 });
check('32. float16がある端末では軽いfloat16版を並べる',
  /q4f16_1/.test(withF16.selected), withF16.selected);
check('33. 一覧の容量もfloat16版の値になる', withF16.sizes[0] === '0.9GB', withF16.sizes.join(' '));

const shot = path.join(ROOT, 'test-screenshots');
fs.mkdirSync(shot, { recursive: true });
await page.screenshot({ path: path.join(shot, 'zero-1-mobile.png'), fullPage: false });

await browser.close();
server.close();
console.log(`\n  合計: ${pass} 件合格 / ${fail} 件不合格`);
process.exit(fail ? 1 : 0);
