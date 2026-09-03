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

// --- 起動の失敗を、打つ手のある形で見せているか -------------------------------
// ★2026-09-02、深澤さんの端末で起動に失敗し、画面に残ったのは
//   「TypeError: Failed to fetch」の一行だけだった。原因は sw.js が別オリジンの通信まで
//   横取りしていたこと（scripts/verify-service-worker.mjs で別途検査）。
//   ブラウザは Failed to fetch の理由を伏せるので、**ページ側で手掛かりを足さないと
//   誰も原因に辿り着けない**。ここは合成のライブラリを差し込んで通しで確かめる。
//   ★純粋関数（preflight 等）だけを叩く検査にしないこと。画面がそれを使っていなければ
//     「関数は正しいのに動かない」を見逃す（エアタッチの移植で実際に踏んだ）。
async function withEngine({ reachable = true, failTimes = 0, failWith = 'network', noWorker = false,
  workerLoads = true, timeouts = null, hang = false, gpuLoss = 0, ask = '', longAnswer = false, stopAt = 0,
  speak = false, reply = '', chip = -1 } = {}) {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(([canReach, times, kind, banWorker, clocks, neverFinishes, gpuLossTimes, streamsLong, readsAloud, fixedReply]) => {
    window.__ZERO1_LONG = streamsLong;
    window.__ZERO1_REPLY = fixedReply;
    // 読み上げが実際に走った回数を数える。止めたのに読み上げが続いたら止めた意味が無い
    window.__ZERO1_SPOKEN = 0;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel() {}, speak() { window.__ZERO1_SPOKEN++; },
    }});
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    if (readsAloud) { try { localStorage.setItem('zero1-mobile-speak', 'true'); } catch { /* 無視 */ } }
    if (clocks) window.__ZERO1_TIMEOUTS = clocks;
    window.__ZERO1_HANG = neverFinishes;
    window.__ZERO1_GPU_LOSS = gpuLossTimes;
    // 画面を消させない仕掛けを使っているかを見る（実機で切れた原因そのもの）
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
      request: async () => { window.__ZERO1_PROBE.wakeLocks++; return { release: async () => {} }; },
    }});
    if (banWorker) {
      // Worker が作れない端末の再現（作れなければ画面と同じ糸へ落ちるはず）
      Object.defineProperty(window, 'Worker', { configurable: true, value: function () { throw new Error('Worker は使えません'); } });
    }
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: async () => ({ features: new Set() }),   // float16なし = 深澤さんの端末
    }});
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      estimate: async () => ({ quota: 10.7e9, usage: 0 }),
    }});
    window.__ZERO1_PROBE = { attempts: 0, requests: [], workerUsed: 0, mainThreadUsed: 0, wakeLocks: 0, asked: 0 };
    // 取得先への問い合わせだけを横取りする（ページ自身の読み込みは素通し）
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (/huggingface\.co|raw\.githubusercontent\.com/.test(url)) {
        window.__ZERO1_PROBE.requests.push({ url, method: init?.method ?? 'GET', headers: Object.keys(init?.headers ?? {}), signal: Boolean(init?.signal) });
        if (canReach === 'hang') {
          // ★相手が接続だけ受けて何も返さない状態の再現。時間切れを渡していなければ
          //   ここは永遠に解決せず、検査は待ちきれずに落ちる（＝時間切れの有無を見ている）
          return new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal.reason)));
        }
        if (!canReach) return Promise.reject(new TypeError('Failed to fetch'));
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      return original(input, init);
    };
    window.__ZERO1_WEBLLM = {
      get prebuiltAppConfig() {
        const tiers = window.ZERO1_MOBILE?.MODEL_TIERS ?? [];
        return { model_list: tiers.flatMap((t) => [t.f16, t.f32]).map((v) => ({
          model_id: v.id,
          model: `https://huggingface.co/mlc-ai/${v.id}`,
          model_lib: `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/${v.id}.wasm`,
        })) };
      },
      CreateWebWorkerMLCEngine: async (worker, id, opts) => {
        window.__ZERO1_PROBE.workerUsed++;
        window.__ZERO1_PROBE.workerIsWorker = worker instanceof Worker;
        // 返事が返ってこないまま黙る糸の再現（実際に深澤さんの端末で起きた形）
        if (window.__ZERO1_HANG) return new Promise(() => {});
        return window.__ZERO1_WEBLLM.CreateMLCEngine(id, opts);
      },
      CreateMLCEngine: async (id, opts) => {
        if (!window.__ZERO1_PROBE.workerUsed || window.__ZERO1_PROBE.attempts) window.__ZERO1_PROBE.mainThreadUsed++;
        window.__ZERO1_PROBE.attempts++;
        opts?.initProgressCallback?.({ progress: 0.5, text: 'Fetching param cache' });
        if (window.__ZERO1_PROBE.attempts <= times) {
          throw kind === 'network' ? new TypeError('Failed to fetch') : new Error('[Invalid ShaderModule] entryPoint: "index_kernel"');
        }
        return { chat: { completions: { create: async () => {
          window.__ZERO1_PROBE.asked++;
          // ★実機で出たそのままの文言。GPUとの接続が切れた形を再現する
          if (window.__ZERO1_GPU_LOSS > 0) {
            window.__ZERO1_GPU_LOSS--;
            const lost = new Error("Failed to execute 'mapAsync' on 'GPUBuffer': A valid external Instance reference no longer exists.");
            lost.name = 'AbortError';
            throw lost;
          }
          // 長い返答（止める操作を確かめるため）。interruptGenerate で打ち切れること、
          // 打ち切れなくても受け取る側が抜けることの両方を見たいので、止まるのは
          // **ページ側が抜けたとき**だけにしてある
          if (window.__ZERO1_LONG) {
            return (async function* () {
              for (let i = 0; i < 400; i++) {
                if (window.__ZERO1_PROBE.interrupted) return;
                yield { choices: [{ delta: { content: `あ${i} ` } }] };
                await new Promise((r) => setTimeout(r, 12));
              }
            })();
          }
          // 返答の中身を差し替えられるようにしておく（体裁の組み立てを通しで確かめるため）
          const tokens = window.__ZERO1_REPLY
            ? window.__ZERO1_REPLY.match(/[\s\S]{1,8}/g)
            : ['こんに', 'ちは', '。'];
          return (async function* () {
            for (const token of tokens) yield { choices: [{ delta: { content: token } }] };
          })();
        } } },
        // 止めろと言われたことが、ちゃんとモデル側まで届いているか
        interruptGenerate: () => { window.__ZERO1_PROBE.interrupted = true; } };
      },
    };
  }, [reachable, failTimes, failWith, noWorker, timeouts, hang, gpuLoss, longAnswer, speak, reply]);
  // ★worker は実物を動かす（合図の受け渡しごと確かめる）。ただしCDNへは出ない
  await scoped.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({
    status: workerLoads ? 200 : 503, contentType: 'text/javascript',
    body: 'export class WebWorkerMLCEngineHandler { onmessage() {} }',
  }));
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  await scoped.locator('#btn-start').click();
  await scoped.waitForFunction(
    () => !document.getElementById('failure').hidden || !document.getElementById('chat').classList.contains('hidden'),
    { timeout: 20_000 });
  if (chip >= 0) {
    await scoped.locator('#chips button').nth(chip).click();
    await scoped.waitForFunction(() => window.ZERO1_MOBILE_STATE?.busy === false
      && (window.ZERO1_MOBILE_STATE?.history?.length ?? 0) >= 2, { timeout: 20_000 }).catch(() => {});
  }
  if (ask) {
    await scoped.locator('#input').fill(ask);
    await scoped.locator('#btn-send').click();
    if (stopAt) {
      // 流れ始めてから止める（まだ1文字も出ていない状態で押すと、何を止めたのか分からない）
      await scoped.waitForFunction(() => (document.querySelector('#msgs .msg:last-child .body')?.textContent ?? '').length > 4,
        { timeout: 10_000 }).catch(() => {});
      await scoped.waitForTimeout(stopAt);
      const sawWhileStreaming = await scoped.evaluate(() => ({
        label: document.getElementById('btn-send').getAttribute('aria-label'),
        stopClass: document.getElementById('btn-send').classList.contains('stop'),
        disabled: document.getElementById('btn-send').disabled,
        length: (document.querySelector('#msgs .msg:last-child .body')?.textContent ?? '').length,
      }));
      await scoped.locator('#btn-send').click();
      scoped.__stopped = sawWhileStreaming;
    }
    await scoped.waitForFunction(() => {
      const last = document.querySelector('#msgs .msg:last-child');
      return last && !last.classList.contains('pending')
        && !/考えています|載せ直して/.test(last.textContent)
        && window.ZERO1_MOBILE_STATE?.busy === false;
    }, { timeout: 30_000 }).catch(() => {});
  }
  const result = await scoped.evaluate(() => ({
    reply: document.querySelector('#msgs .msg:last-child')?.textContent ?? '',
    body: document.querySelector('#msgs .msg:last-child .body')?.textContent ?? '',
    tag: document.querySelector('#msgs .msg:last-child .tag')?.textContent ?? '',
    sendLabel: document.getElementById('btn-send').getAttribute('aria-label'),
    sendStop: document.getElementById('btn-send').classList.contains('stop'),
    stored: JSON.parse(localStorage.getItem('zero1-mobile-history') ?? '[]'),
    bodyHtml: document.querySelector('#msgs .msg.ai:last-of-type .body')?.innerHTML ?? '',
    announced: document.getElementById('announce').textContent,
    chips: [...document.querySelectorAll('#chips button')].map((b) => b.textContent),
    copyable: Boolean(document.querySelector('#msgs .msg.ai:last-of-type .tools button')),
    pwned: window.__PWNED ?? 0,
    spoken: window.__ZERO1_SPOKEN,
    detail: document.getElementById('failure-detail').textContent,
    hint: document.getElementById('failure-hint').textContent,
    failed: !document.getElementById('failure').hidden,
    chatting: !document.getElementById('chat').classList.contains('hidden'),
    stage: window.ZERO1_MOBILE_STATE?.stage ?? '',
    mainThreadOnly: window.ZERO1_MOBILE_STATE?.mainThreadOnly ?? null,
    workerError: window.ZERO1_MOBILE_STATE?.workerError ?? '',
    probe: window.__ZERO1_PROBE,
  }));
  result.whileStreaming = scoped.__stopped ?? null;
  await scoped.close();
  return result;
}

const unreachable = await withEngine({ reachable: false });
check('34. 取得先へ届かないとき、どのホストで切れたのかを残す',
  /huggingface\.co/.test(unreachable.detail) && /raw\.githubusercontent\.com/.test(unreachable.detail),
  unreachable.detail.split('\n').find((l) => l.startsWith('届かなかった')) ?? '（行が無い）');
check('35. 2.5GB落とし始める前に、届くかを先に確かめる',
  unreachable.probe.attempts === 0 && /接続/.test(unreachable.stage), `${unreachable.stage} / 取得試行 ${unreachable.probe.attempts}回`);
check('36. Failed to fetch に、打つ手を1行添える',
  /再読み込み/.test(unreachable.hint) && /Wi-Fi/.test(unreachable.hint), unreachable.hint.slice(0, 40));
check('37. 通信を仲介しているService Workerの有無を手掛かりに残す',
  /配信経路/.test(unreachable.detail),
  unreachable.detail.split('\n').find((l) => l.startsWith('配信経路')) ?? '（行が無い）');
check('38. 確認の問い合わせに独自ヘッダを足さない（CORSの事前問い合わせで誤検知しない）',
  unreachable.probe.requests.length === 2
    && unreachable.probe.requests.every((r) => r.headers.length === 0)
    && unreachable.probe.requests.some((r) => r.method === 'HEAD'),
  JSON.stringify(unreachable.probe.requests.map((r) => `${r.method}:${r.headers.join(',')}`)));

// 途中で切れるのは携帯回線では当たり前。落とした分は端末に残るので続きからやり直す
const flaky = await withEngine({ failTimes: 2, failWith: 'network' });
check('39. 通信が切れても、続きからやり直して起動する',
  flaky.chatting && !flaky.failed && flaky.probe.attempts === 3, `取得試行 ${flaky.probe.attempts}回`);

// ★端末側の理由（シェーダーのコンパイル失敗など）で3回繰り返すのは、時間を捨てるだけ
const broken = await withEngine({ failTimes: 9, failWith: 'device' });
check('40. 通信起因でない失敗は、やり直さず即座に理由を出す',
  broken.failed && broken.probe.attempts === 1, `取得試行 ${broken.probe.attempts}回`);
check('41. GPUが原因のときは、GPU向けの打つ手を出す',
  /かるい|GPU/.test(broken.hint), broken.hint.slice(0, 40));

// --- 読み込み中に画面が固まらないか（0%のまま動かない、の正体） ---------------
// ★2026-09-03、深澤さんの端末で「エラーは出ないが0%のまま進まない」。
//   モデルの読み込み（取得・WebAssemblyのコンパイル・GPUへの転送）を画面と同じ糸で
//   やると、その数分ぶん画面がまるごと固まる。進捗も再描画されないので、進んでいるのか
//   止まっているのかすら分からない。**例外は一切出ない**ので検査で押さえるしかない。
const worker = await withEngine({});
check('42. モデルは画面とは別の糸（Web Worker）で動かす',
  worker.probe.workerUsed === 1 && worker.probe.workerIsWorker === true && worker.mainThreadOnly === false,
  `別の糸 ${worker.probe.workerUsed}回 / 実物のWorker ${worker.probe.workerIsWorker}`);

// Worker が使えない端末では画面と同じ糸へ落とす（動かないより固まる方がまし）。
// ただし落ちた事実は隠さない
const fallback = await withEngine({ noWorker: true });
check('43. Workerが作れない端末でも起動する（画面と同じ糸へ落ちる）',
  fallback.chatting && fallback.mainThreadOnly === true, `固まる経路: ${fallback.mainThreadOnly}`);

// --- 「0%」が固まりなのか進行中なのかを、利用者が区別できるか -----------------
const clock = await page.evaluate(() => {
  const { clockText, elapsedText } = window.ZERO1_MOBILE;
  return { moving: clockText(30, 3), stalled: clockText(400, 200), fmtSec: elapsedText(45), fmtMin: elapsedText(125) };
});
check('44. 進捗が止まったら「止まっている」と分かる文言になる',
  !/進んでいません/.test(clock.moving) && /進んでいません/.test(clock.stalled) && /軽いモデル/.test(clock.stalled),
  clock.stalled.slice(0, 40));
check('45. 経過時間は分秒で読める形にする', clock.fmtSec === '45秒' && clock.fmtMin === '2分05秒',
  `${clock.fmtSec} / ${clock.fmtMin}`);

// 経過時計が実際に動くこと＝画面の糸が空いていること。ここが止まるなら固まっている
const ticking = await (async () => {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ features: new Set() }) } });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: async () => ({ quota: 10.7e9, usage: 0 }) } });
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (/huggingface\.co|raw\.githubusercontent\.com/.test(url)) return Promise.resolve(new Response('{}', { status: 200 }));
      return original(input, init);
    };
    window.__ZERO1_WEBLLM = {
      get prebuiltAppConfig() {
        const tiers = window.ZERO1_MOBILE?.MODEL_TIERS ?? [];
        return { model_list: tiers.flatMap((t) => [t.f16, t.f32]).map((v) => ({
          model_id: v.id, model: `https://huggingface.co/mlc-ai/${v.id}`,
          model_lib: `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/${v.id}.wasm`,
        })) };
      },
      // 読み込みに時間がかかる状態（進捗を1度も返さない）の再現
      CreateWebWorkerMLCEngine: () => new Promise(() => {}),
      CreateMLCEngine: () => new Promise(() => {}),
    };
  });
  await scoped.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'export class WebWorkerMLCEngineHandler { onmessage() {} }',
  }));
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  await scoped.locator('#btn-start').click();
  await scoped.waitForFunction(() => !document.getElementById('progress-clock').hidden, { timeout: 10_000 });
  const first = await scoped.locator('#progress-clock').innerText();
  await scoped.waitForFunction((was) => document.getElementById('progress-clock').innerText !== was, first, { timeout: 8_000 })
    .catch(() => {});
  const second = await scoped.locator('#progress-clock').innerText();
  await scoped.close();
  return { first, second };
})();
check('46. 進捗が0%のあいだも、経過時間が動き続ける（固まっていないことが分かる）',
  ticking.first !== '' && ticking.second !== ticking.first, `${ticking.first} → ${ticking.second}`);

// --- 相手が応答しないとき、0%で永久に待たない -------------------------------
// ★fetch には既定の制限時間が無い。時間切れを渡していないと、この検査は
//   永遠に待って落ちる（＝時間切れの有無そのものを見ている）
const hung = await withEngine({ reachable: 'hang' });
check('47. 取得先が応答しないときは時間切れにする（0%で永久に待たない）',
  hung.failed && /応答がありません/.test(hung.detail),
  hung.detail.split('\n').find((l) => l.startsWith('届かなかった')) ?? '（行が無い）');
check('48. 時間切れの仕掛けを実際に渡している',
  hung.probe.requests.length > 0 && hung.probe.requests.every((r) => r.signal === true));

// --- メモリが足りないモデルを、黙って選ばせない -------------------------------
// ★空き容量（保存できるか）とメモリ（動かせるか）は別の話。メモリ4GBの端末に
//   2.5GBのモデルを警告なしで選ばせていた。載らないと取得は最後まで進むのに
//   GPUへ載せる段で固まる——例外が出ないので「進まない」としか見えない
const heavy = await (async () => {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ features: new Set() }) } });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: async () => ({ quota: 10.7e9, usage: 0 }) } });
  });
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  // 深澤さんが実際に選んでいた「日本語に強い」（必要メモリ6GB）を押す
  const japanese = scoped.locator('.model').nth(2);
  const label = await japanese.innerText();
  await japanese.click();
  const note = await scoped.locator('#progress-note').innerText();
  await scoped.close();
  return { label, note };
})();
check('49. メモリが足りないモデルは、一覧の時点で重すぎると伝える',
  /重すぎます/.test(heavy.label), heavy.label.replace(/\n/g, ' ').slice(0, 50));
check('50. 選んだ後も、必要なメモリの目安を出す（止めはしない）',
  /重すぎます/.test(heavy.note) && /6GB/.test(heavy.note), heavy.note.slice(0, 50));

// --- Workerが読む版が、ページの importmap と同じか ---------------------------
// ★ずれると、integrity を通った版とは別の版を読み込んでしまう
const workerSrc = fs.readFileSync(path.join(ROOT, 'assets/js/zero1-worker.js'), 'utf8');
const workerUrl = workerSrc.match(/WEBLLM_URL\s*=\s*'([^']+)'/)?.[1] ?? '';
check('51. workerが読むライブラリの版が、ページの importmap と同じ',
  workerUrl === libUrl, `worker ${workerUrl} / ページ ${libUrl}`);

// --- 別の糸が「作れても動かない」場合に、待ち続けないか -----------------------
// ★2026-09-03、深澤さんの端末は経過時計だけが動き、進捗は1度も出ないまま止まった。
//   worker は読み込みに失敗しても例外を投げず**ただ黙る**ので、仕事を渡した側は
//   返事を待ち続けて 0% のまま永久に止まる。例外もエラーも出ない
const deadWorker = await withEngine({ workerLoads: false });
check('53. 別の糸が動き出さないときは、待たずに画面と同じ糸へ落とす',
  deadWorker.chatting && deadWorker.mainThreadOnly === true && deadWorker.workerError !== '',
  deadWorker.workerError.slice(0, 60));

// 返事が返らないまま黙る糸。待ち続けず、何秒進まなかったかを持って失敗にする
const stalled = await withEngine({ hang: true, timeouts: { firstProgress: 2500 } });
check('54. 進捗が1度も出ないまま止まったら、待ち続けずに失敗として出す',
  stalled.failed && /進みませんでした/.test(stalled.detail),
  stalled.detail.split('\n').find((l) => l.startsWith('理由')) ?? '（行が無い）');
check('55. 止まったときは「軽いモデル」という打つ手を出す',
  /軽いモデル/.test(stalled.hint), stalled.hint.slice(0, 40));
check('56. 進捗が1度も出なかった事実を手掛かりに残す',
  /進捗が1度でも出たか: いいえ/.test(stalled.detail));

// ★画面写真1枚で「どこで止まったか」が分かること。文字で聞き返す往復が消える
const staged = await page.evaluate(() => window.ZERO1_MOBILE.clockText(400, 200, 'モデルの取得と準備'));
check('57. 経過時計に、いまどの段階かを添える（画面写真だけで場所が分かる）',
  /モデルの取得と準備/.test(staged), staged.slice(0, 40));

// --- GPUとの接続が切れたときに、載せ直して答え直すか -------------------------
// ★2026-09-03、深澤さんの端末は起動には成功したのに、最初の返事で
//   `AbortError: Failed to execute 'mapAsync' on 'GPUBuffer':
//    A valid external Instance reference no longer exists.` を返した。
//   数分の読み込みのあいだに画面が消え、AndroidがGPUの資源を手放したため。
//   **モデルは端末に残っている**ので、載せ直せば数秒で戻る。諦めるのが一番もったいない。
const lostOnce = await withEngine({ ask: 'こんにちは', gpuLoss: 1 });
check('58. GPUとの接続が切れたら、載せ直して答え直す（打ち直させない）',
  /こんにちは。/.test(lostOnce.reply) && lostOnce.probe.asked === 2,
  `返答「${lostOnce.reply.slice(0, 20)}」/ 問い合わせ ${lostOnce.probe.asked}回`);

// 載せ直しても戻らないときは、打つ手（再読み込み）を出す
const lostForever = await withEngine({ ask: 'こんにちは', gpuLoss: 9 });
check('59. 載せ直しても戻らないときは、次の一手を出す',
  /再読み込み/.test(lostForever.reply) && /端末に残っている/.test(lostForever.reply),
  lostForever.reply.slice(0, 40));

const lostKinds = await page.evaluate(() => {
  const { isDeviceLost } = window.ZERO1_MOBILE;
  return {
    real: isDeviceLost({ name:'AbortError', message:"Failed to execute 'mapAsync' on 'GPUBuffer': A valid external Instance reference no longer exists." }),
    network: isDeviceLost(new TypeError('Failed to fetch')),
    shader: isDeviceLost(new Error('[Invalid ShaderModule] entryPoint: "index_kernel"')),
  };
});
check('60. GPUの切断と、通信・シェーダーの失敗を取り違えない',
  lostKinds.real === true && lostKinds.network === false && lostKinds.shader === false,
  JSON.stringify(lostKinds));

// ★そもそも切らせない。数分の読み込み中に画面が消えるのが引き金だった
check('61. 読み込みのあいだ、画面を消させない（wake lock を要求する）',
  lostOnce.probe.wakeLocks >= 1, `要求 ${lostOnce.probe.wakeLocks}回`);

// --- CSPが「別の糸」を止めていないか ------------------------------------------
// ★worker-src を締めると worker は**例外もエラーも出さずに黙る**（作られはするが動かない）。
//   そうなると読み込みが 0% から進まない状態へ逆戻りする
{
  const csp = fs.readFileSync(path.join(ROOT, PAGE), 'utf8')
    .match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
  const directive = (name) => (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) ?? '');
  const workerHost = new URL(workerUrl).origin;
  check('52. CSPが別の糸（worker）と、そこが読むライブラリを止めていない',
    /worker-src[^;]*'self'/.test(csp)
      && directive('script-src').includes(workerHost)
      && directive('connect-src').includes(workerHost),
    `worker-src: ${directive('worker-src') || '（無し）'}`);
}

// --- 生成を止められるか -------------------------------------------------------
// ★0.5〜3B級は的外れな長文を書き始めることがあり、出し切るまで数十秒かかる。
//   その間ずっとGPUが回るので電池にも効く。**待つ以外の選択肢を必ず1つ置く**。
//   例外もエラーも出ない類の不便なので、検査で押さえるしかない。
const stopped = await withEngine({ ask: '長い話をして', longAnswer: true, stopAt: 250, speak: true });
check('62. 生成中、送信ボタンは「止める」に変わる（押せないボタンにしない）',
  stopped.whileStreaming?.stopClass === true
    && /止める|Stop/.test(stopped.whileStreaming?.label ?? '')
    && stopped.whileStreaming?.disabled === false,
  JSON.stringify(stopped.whileStreaming));
check('63. 止めると、その場で生成が終わる',
  stopped.body.length > 0 && stopped.body.length < 400 * 4,
  `${stopped.body.length}文字で停止`);
check('64. 止めろがモデル側にも届く（受け取る側で抜けるだけにしない）',
  stopped.probe.interrupted === true);
check('65. 止めるまでに書けた分は捨てない（止める＝やり直しにしない）',
  stopped.stored.some((m) => m.role === 'assistant' && m.text.length > 0)
    && stopped.stored.at(-1)?.text === stopped.body,
  `履歴 ${stopped.stored.length}件 / 末尾 ${String(stopped.stored.at(-1)?.text ?? '').slice(0, 12)}`);
check('66. 止めたことが画面に残る（黙って途切れさせない）',
  /止め|Stopped/.test(stopped.tag), stopped.tag);
check('67. 止めたら読み上げも走らせない（止めた意味が消える）',
  stopped.spoken === 0, `読み上げ ${stopped.spoken}回`);
check('68. 止めたあとは、また送れる状態へ戻る',
  stopped.sendStop === false && /送信|Send/.test(stopped.sendLabel ?? ''), stopped.sendLabel);

// 止めなければ最後まで流れて、読み上げも走る（62〜68が「常に止まる」にすり替わらないこと）
const finished = await withEngine({ ask: 'こんにちは', speak: true });
check('69. 止めなければ最後まで答え、読み上げも走る',
  /こんにちは。/.test(finished.body) && finished.spoken === 1 && finished.tag === '',
  `${finished.body} / 読み上げ ${finished.spoken}回`);

// --- 端末に残っているモデルを、残っていると言えるか ---------------------------
// ★2回目以降は取得が要らないのに、画面は常に「初回だけダウンロードします」と言っていた。
//   すぐ起動するのに「これから2.5GB落ちる」ように見えるのは、そのまま離脱の理由になる。
async function withCaches({ seeded = [], broken = false, quotaGB = 10.7 } = {}) {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(([urls, throws, quota]) => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ features: new Set() }) } });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: async () => ({ quota: quota * 1e9, usage: 0 }) } });
    // 合成の Cache Storage。実物と同じく「名前 → 要求の一覧」の2段
    // モデル削除が会話を巻き込まないことを見るため、先に履歴を入れておく
    try { localStorage.setItem('zero1-mobile-history', JSON.stringify([{ role:'user', text:'消さないで' }])); } catch { /* 無視 */ }
    const store = new Map([['webllm/model', new Set(urls)], ['other-cache', new Set(['https://example.com/x'])]]);
    window.__ZERO1_CACHE = store;
    Object.defineProperty(window, 'caches', { configurable: true, value: {
      keys: async () => { if (throws) throw new DOMException('storage unavailable'); return [...store.keys()]; },
      open: async (name) => ({
        keys: async () => [...(store.get(name) ?? new Set())].map((url) => ({ url })),
        delete: async (url) => store.get(name)?.delete(url) ?? false,
      }),
    }});
  }, [seeded, broken, quotaGB]);
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  return scoped;
}

// 「ふつう」（q4f32版＝float16の無い端末）を落とし終えている状態を作る
const keptId = (await page.evaluate(() => window.ZERO1_MOBILE.resolveModels(false)[1].id));
const kept = await withCaches({ seeded: [
  `https://huggingface.co/mlc-ai/${keptId}/resolve/main/params_shard_0.bin`,
  `https://huggingface.co/mlc-ai/${keptId}/resolve/main/mlc-chat-config.json`,
] });
const keptView = await kept.evaluate(() => ({
  labels: [...document.querySelectorAll('#models .model')].map((b) => b.innerText),
  start: document.getElementById('btn-start').innerText,
  cached: [...(window.ZERO1_MOBILE_STATE?.cached ?? [])],
}));
check('70. 端末に残っているモデルを「保存済み」と伝える',
  /保存済み/.test(keptView.labels[1]) && keptView.cached.includes(keptId),
  keptView.labels[1].replace(/\n/g, ' ').slice(0, 46));
check('71. 保存済みでないモデルには「保存済み」と書かない（全部に付けない）',
  !/保存済み/.test(keptView.labels[0]) && !/保存済み/.test(keptView.labels[3]));
check('72. 起動ボタンも「すぐ起動する」と分かる文言になる',
  /保存済み|already/i.test(keptView.start), keptView.start);

// 消す口が画面にあること。無ければブラウザ設定でサイトデータを全消しするしかない
await kept.locator('#btn-settings').click();
const rowBefore = await kept.locator('#model-storage').innerText();
await kept.locator('#btn-drop').click();
await kept.waitForFunction(() => /削除しました|削除できません/.test(document.getElementById('model-storage').innerText), { timeout: 8_000 })
  .catch(() => {});   // ★解けなくても例外で落とさない（落とすと以降の検査が1件も走らない）
const dropped = await kept.evaluate(() => ({
  note: document.getElementById('model-storage').innerText,
  left: [...(window.__ZERO1_CACHE.get('webllm/model') ?? [])].length,
  other: [...(window.__ZERO1_CACHE.get('other-cache') ?? [])].length,
  labels: [...document.querySelectorAll('#models .model')].map((b) => b.innerText),
  history: localStorage.getItem('zero1-mobile-history'),
}));
await kept.close();
check('73. 消す前に、何をどれだけ空けるのかが分かる',
  /GB/.test(rowBefore) && /会話と設定は残ります/.test(rowBefore), rowBefore.slice(0, 46));
check('74. 削除すると、モデルの実体が端末から消える',
  dropped.left === 0 && /削除しました/.test(dropped.note), `残り ${dropped.left}件`);
check('75. 削除は他のキャッシュ・会話履歴を巻き込まない',
  dropped.other === 1 && /消さないで/.test(dropped.history ?? ''),
  `他キャッシュ ${dropped.other}件 / 会話 ${dropped.history ?? '(消えた)'}`);
check('76. 削除後は「保存済み」の表示も消える',
  !/保存済み/.test(dropped.labels[1]), dropped.labels[1].replace(/\n/g, ' ').slice(0, 40));

// ★保存済みなら、空き容量の警告より先にそれを言う。すでに端末にあるものへ
//   「空きが足りません」と出して起動を止めるのは端的に誤り
const tight = await withCaches({ quotaGB: 0.2, seeded: [
  `https://huggingface.co/mlc-ai/${keptId}/resolve/main/params_shard_0.bin`,
] });
const tightView = await tight.evaluate(() => {
  const models = [...document.querySelectorAll('#models .model')];
  models[1].click();
  return { disabled: document.getElementById('btn-start').disabled, note: document.getElementById('progress-note').innerText };
});
await tight.close();
check('77. 保存済みのモデルは、空きが少なくても起動を止めない',
  tightView.disabled === false && !/空き容量が足りません/.test(tightView.note),
  `起動不可: ${tightView.disabled} / ${tightView.note.slice(0, 30) || '（警告なし）'}`);

// ★Cache Storage はシークレットタブ・容量枯渇・破損で落ちる。落ちても画面を止めない
const noCaches = await withCaches({ broken: true });
const noCachesView = await noCaches.evaluate(() => ({
  count: document.querySelectorAll('#models .model').length,
  disabled: document.getElementById('btn-start').disabled,
  labels: [...document.querySelectorAll('#models .model')].map((b) => b.innerText).join(' '),
}));
await noCaches.close();
check('78. Cache Storage が使えない端末でも、起動画面が止まらない',
  noCachesView.count === 4 && noCachesView.disabled === false && !/保存済み/.test(noCachesView.labels),
  `モデル ${noCachesView.count}件 / 起動不可 ${noCachesView.disabled}`);

// --- 返答の体裁と、渡っていない文脈の見え方 -----------------------------------
// ★モデルの出力は `**強調**` や `- 箇条書き` を含むのに、素の文字として並べていたので
//   記号がそのまま読者に見えていた。ただし体裁を整える＝モデルの出力を解釈するので、
//   **HTMLを組み立てたら負け**（`<img onerror=…>` がそのまま動く道ができる）。
const FORMATTED = [
  '## 手順',
  '- **鍋**に水を入れる',
  '- `salt` をひとつまみ',
  '',
  '```js',
  'const x = 1 < 2;',
  '```',
  '',
  '危険なもの: <img src=x onerror="window.__PWNED=1"> と <script>window.__PWNED=1</script>',
].join('\n');
const rich = await withEngine({ ask: '教えて', reply: FORMATTED });
check('79. 箇条書き・見出し・コードを、記号のまま見せない',
  /<h3>/.test(rich.bodyHtml) && /<ul>/.test(rich.bodyHtml) && /<li>/.test(rich.bodyHtml)
    && /<pre>/.test(rich.bodyHtml) && /<strong>鍋<\/strong>/.test(rich.bodyHtml),
  rich.bodyHtml.slice(0, 60));
check('80. モデルの出力からHTMLを組み立てない（返答経由のXSSを作らない）',
  !/<img/i.test(rich.bodyHtml) && !/<script/i.test(rich.bodyHtml)
    && /&lt;img/i.test(rich.bodyHtml) && rich.pwned !== 1,
  rich.bodyHtml.includes('&lt;img') ? '文字として出ている' : rich.bodyHtml.slice(-60));
check('81. 返答をコピーできる口がある（指で長押しの範囲選択に頼らない）', rich.copyable);
// ★#msgs 自体を live 領域にすると、流れてくる途中を1トークンずつ読み上げてしまう
check('82. 画面読み上げへは、書き終わった全文を1度だけ渡す',
  rich.announced.includes('鍋') && rich.announced.includes('salt')
    && rich.announced === FORMATTED,
  `${rich.announced.length}文字`);

// --- 最初の一言のとっかかり ---------------------------------------------------
const chipped = await withEngine({ chip: 0 });
check('83. 起動直後に、聞き方の候補を出す',
  chipped.stored[0]?.role === 'user' && chipped.stored[0]?.text.length > 0,
  chipped.stored[0]?.text ?? '（送られていない）');
check('84. 一度話し始めたら候補は引っ込める（邪魔をしない）',
  chipped.chips.length === 0, `残っている候補 ${chipped.chips.length}件`);

// --- モデルに渡っていない分を、渡っていないと分かるようにする -----------------
// ★buildMessages は直近の数往復しか渡さないのに、画面には40件残る。
//   利用者からは全部覚えているように見えて、実際は覚えていない
const memory = await page.evaluate(() => {
  const st = window.ZERO1_MOBILE_STATE;
  const api = window.ZERO1_MOBILE;
  st.history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `発言${i}` }));
  api.renderHistory();
  const line = document.querySelector('#msgs .forget');
  const seen = { text: line?.textContent ?? '', above: line?.previousElementSibling?.textContent ?? '',
    below: line?.nextElementSibling?.textContent ?? '' };
  // 渡る分（8往復）に収まっているうちは、線を引かない
  st.history = st.history.slice(0, 4);
  api.renderHistory();
  seen.shortHasLine = Boolean(document.querySelector('#msgs .forget'));
  // 会話が空なら候補が戻る
  st.history = [];
  api.renderHistory();
  seen.chips = document.querySelectorAll('#chips button').length;
  return { ...seen, boundary: api.memoryBoundary(Array(12), 8), none: api.memoryBoundary(Array(4), 8) };
});
check('85. モデルに渡らなくなった位置に、境目を出す',
  /覚えて|memory/i.test(memory.text) && /発言4/.test(memory.below) && /発言3/.test(memory.above),
  `${memory.above.slice(0, 6)} ┃ ${memory.below.slice(0, 6)}`);
check('86. 境目の位置が、実際に渡す範囲（直近8件）と一致する',
  memory.boundary === 4 && memory.none === -1, `境目 ${memory.boundary} / 短い会話 ${memory.none}`);
check('87. 全部渡っているうちは境目を出さない（意味の無い線を引かない）',
  memory.shortHasLine === false);
check('88. 会話を消したら、候補がまた出る', memory.chips >= 3, `候補 ${memory.chips}件`);

// ★境目は「履歴の何番目か」で決めること。子要素の並び順で数えると、履歴に無い吹き出し
//   （起動直後のあいさつ、失敗の通知）の分だけ無言で1つずれる——例外は出ず、線だけが動く
const greeted = await page.evaluate(() => {
  const st = window.ZERO1_MOBILE_STATE;
  const api = window.ZERO1_MOBILE;
  st.history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `発言${i}` }));
  api.renderHistory();
  const hello = document.createElement('div');   // 起動直後のあいさつ（履歴には無い）
  hello.className = 'msg ai';
  hello.textContent = 'おかえりなさい';
  document.getElementById('msgs').prepend(hello);
  api.paintMemoryBoundary();
  const line = document.querySelector('#msgs .forget');
  return { below: line?.nextElementSibling?.textContent ?? '', above: line?.previousElementSibling?.textContent ?? '' };
});
check('89. 履歴に無い吹き出し（あいさつ等）が在っても、境目がずれない',
  /発言4/.test(greeted.below) && /発言3/.test(greeted.above),
  `${greeted.above.slice(0, 6)} ┃ ${greeted.below.slice(0, 6)}`);

const shot = path.join(ROOT, 'test-screenshots');
fs.mkdirSync(shot, { recursive: true });
await page.screenshot({ path: path.join(shot, 'zero-1-mobile.png'), fullPage: false });

await browser.close();
server.close();
console.log(`\n  合計: ${pass} 件合格 / ${fail} 件不合格`);
process.exit(fail ? 1 : 0);
