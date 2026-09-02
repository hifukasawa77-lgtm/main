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
async function withEngine({ reachable = true, failTimes = 0, failWith = 'network', noWorker = false } = {}) {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(([canReach, times, kind, banWorker]) => {
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
    window.__ZERO1_PROBE = { attempts: 0, requests: [], workerUsed: 0, mainThreadUsed: 0 };
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
        return window.__ZERO1_WEBLLM.CreateMLCEngine(id, opts);
      },
      CreateMLCEngine: async (id, opts) => {
        if (!window.__ZERO1_PROBE.workerUsed || window.__ZERO1_PROBE.attempts) window.__ZERO1_PROBE.mainThreadUsed++;
        window.__ZERO1_PROBE.attempts++;
        opts?.initProgressCallback?.({ progress: 0.5, text: 'Fetching param cache' });
        if (window.__ZERO1_PROBE.attempts <= times) {
          throw kind === 'network' ? new TypeError('Failed to fetch') : new Error('[Invalid ShaderModule] entryPoint: "index_kernel"');
        }
        return { chat: { completions: { create: async () => ({}) } } };
      },
    };
  }, [reachable, failTimes, failWith, noWorker]);
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  await scoped.locator('#btn-start').click();
  await scoped.waitForFunction(
    () => !document.getElementById('failure').hidden || !document.getElementById('chat').classList.contains('hidden'),
    { timeout: 20_000 });
  const result = await scoped.evaluate(() => ({
    detail: document.getElementById('failure-detail').textContent,
    hint: document.getElementById('failure-hint').textContent,
    failed: !document.getElementById('failure').hidden,
    chatting: !document.getElementById('chat').classList.contains('hidden'),
    stage: window.ZERO1_MOBILE_STATE?.stage ?? '',
    mainThreadOnly: window.ZERO1_MOBILE_STATE?.mainThreadOnly ?? null,
    probe: window.__ZERO1_PROBE,
  }));
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

const shot = path.join(ROOT, 'test-screenshots');
fs.mkdirSync(shot, { recursive: true });
await page.screenshot({ path: path.join(shot, 'zero-1-mobile.png'), fullPage: false });

await browser.close();
server.close();
console.log(`\n  合計: ${pass} 件合格 / ${fail} 件不合格`);
process.exit(fail ? 1 : 0);
