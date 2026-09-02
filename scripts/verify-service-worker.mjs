#!/usr/bin/env node
/**
 * Service Worker（sw.js）の検査。
 *
 * ★SWはスコープ内のページが出す**全ての**GETを横取りできる。横取り先で起きた失敗は、
 *   ページ側には理由の消えた `TypeError: Failed to fetch` としてしか届かない——
 *   HTTPの状態もCSP違反もURLも残らない。2026-09-02、ZERO-1 Mobile が
 *   huggingface.co から2.5GBのモデルを取る途中でこれを踏み、画面には
 *   「Failed to fetch」だけが残って原因に辿り着けなかった。
 *   **例外もエラーも出さずに壊れる**ので、目視レビューでは絶対に見つからない。
 *
 * そこでSWを本物のブラウザ無しで動かし（node:vm に偽の self / caches / fetch を渡す）、
 * 「別オリジンには手を出さない」「SWの中で拒否を投げっぱなしにしない」を機械で確かめる。
 * 純粋な静的検査（"origin" という文字が在るか）にしないのは、周りを壊しても
 * 素通りしてしまうため（＝壊したときに違いが出る所を通す）。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW = path.join(ROOT, 'sw.js');
const SCOPE = 'https://hifukasawa77-lgtm.github.io/main/';

let pass = 0, fail = 0;
const ok = (n, e = '') => { pass++; console.log(`  ✅ ${n}${e ? '  ' + e : ''}`); };
const ng = (n, e = '') => { fail++; console.log(`  ❌ ${n}${e ? '  ' + e : ''}`); };
const check = (n, cond, e = '') => (cond ? ok(n, e) : ng(n, e));

console.log('\n🔧 Service Worker の検査\n');

// --- SWを偽の環境で起動する -------------------------------------------------
/**
 * @param {object} opts
 *  - networkFails: fetch を必ず失敗させる（圏外・回線断の再現）
 *  - cacheBroken:  caches.match を必ず失敗させる（Cache Storage が使えない端末の再現）
 *  - cached:       キャッシュに当たりを返す
 */
function boot(opts = {}) {
  const listeners = new Map();
  const calls = { fetched: [], matched: [], put: [] };
  const cache = {
    addAll: async (urls) => { if (opts.precacheFails) throw new Error('404'); calls.added = urls; },
    put: async (req, res) => { calls.put.push(typeof req === 'string' ? req : req.url); },
  };
  const self = {
    location: new URL(`${SCOPE}sw.js`),
    addEventListener: (type, fn) => { listeners.set(type, [...(listeners.get(type) ?? []), fn]); },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  };
  const sandbox = {
    self, URL, Headers, Response, Request, console, setTimeout, Promise,
    caches: {
      open: async () => cache,
      keys: async () => ['hide-portfolio-v1'],
      delete: async () => true,
      match: async (req) => {
        calls.matched.push(typeof req === 'string' ? req : req.url);
        if (opts.cacheBroken) throw new Error('Cache Storage が使えません');
        return opts.cached ? new Response('cached', { status: 200 }) : undefined;
      },
    },
    fetch: async (req) => {
      calls.fetched.push(typeof req === 'string' ? req : req.url);
      if (opts.networkFails) throw new TypeError('Failed to fetch');
      return new Response('live', { status: 200 });
    },
  };
  sandbox.globalThis = sandbox;
  const source = fs.readFileSync(SW, 'utf8') + '\n;globalThis.__PRECACHE = PRECACHE_URLS; globalThis.__CACHE_NAME = CACHE_NAME;';
  vm.runInNewContext(source, sandbox, { filename: 'sw.js' });
  return { listeners, calls, sandbox };
}

/** fetch イベントを1つ流し、SWが横取りしたかどうかを返す */
async function dispatchFetch(sw, url, { method = 'GET', accept = '', mode = 'no-cors' } = {}) {
  const event = {
    request: { url, method, mode, headers: new Headers(accept ? { accept } : {}) },
    respondWith(promise) { event.responded = promise; },
    waitUntil() {},
    responded: null,
  };
  for (const fn of sw.listeners.get('fetch') ?? []) fn(event);
  if (!event.responded) return { intercepted: false };
  try { return { intercepted: true, response: await event.responded, rejected: false }; }
  catch (cause) { return { intercepted: true, rejected: true, cause }; }
}

// --- 1〜3. 別オリジンには手を出さない（これがZERO-1を止めていた） ----------
{
  const sw = boot();
  // ZERO-1 Mobile が実際に取りに行く先そのもの
  const weights = await dispatchFetch(sw, 'https://huggingface.co/mlc-ai/gemma-2-2b-jpn-it-q4f32_1-MLC/resolve/main/params_shard_0.bin');
  check('1. モデルの重み（huggingface.co）を横取りしない', weights.intercepted === false);

  const wasm = await dispatchFetch(sw, 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/x.wasm');
  check('2. 実行用WebAssembly（raw.githubusercontent.com）を横取りしない', wasm.intercepted === false);

  const lib = await dispatchFetch(sw, 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/lib/index.js');
  check('3. ライブラリ（cdn.jsdelivr.net）を横取りしない', lib.intercepted === false);

  check('4. 別オリジンにはSW自身も一切通信しない（素通し）', sw.calls.fetched.length === 0 && sw.calls.matched.length === 0,
    `fetch ${sw.calls.fetched.length}件 / match ${sw.calls.matched.length}件`);
}

// --- 5〜6. 自分のサイトの資源は今までどおり扱う -----------------------------
{
  const sw = boot();
  const asset = await dispatchFetch(sw, `${SCOPE}assets/logo/favicon.svg`);
  check('5. 同じサイトの静的アセットはキャッシュ優先で扱う',
    asset.intercepted === true && sw.calls.matched.length === 1);

  const sw2 = boot();
  const page = await dispatchFetch(sw2, `${SCOPE}zero-1-mobile.html`, { mode: 'navigate', accept: 'text/html' });
  check('6. 同じサイトのHTMLはネットワーク優先で取る（更新が必ず反映される）',
    page.intercepted === true && sw2.calls.fetched.length === 1 && sw2.calls.matched.length === 0);
}

// --- 7. GET以外は触らない ---------------------------------------------------
{
  const sw = boot();
  const posted = await dispatchFetch(sw, `${SCOPE}api`, { method: 'POST' });
  check('7. GET以外のリクエストには触らない', posted.intercepted === false);
}

// --- 8〜9. SWの中で拒否を投げっぱなしにしない -------------------------------
{
  const sw = boot({ networkFails: true, cacheBroken: true });
  const asset = await dispatchFetch(sw, `${SCOPE}assets/logo/favicon.svg`);
  check('8. Cache Storageが壊れ回線も切れても、静的アセットで拒否を投げっぱなしにしない',
    asset.intercepted === true && asset.rejected === false,
    asset.rejected ? `${asset.cause}` : '');

  const sw2 = boot({ networkFails: true, cacheBroken: true });
  const page = await dispatchFetch(sw2, `${SCOPE}index.html`, { mode: 'navigate', accept: 'text/html' });
  check('9. 同じ条件でも、HTMLで拒否を投げっぱなしにしない',
    page.intercepted === true && page.rejected === false,
    page.rejected ? `${page.cause}` : '');
}

// --- 10. オフラインではキャッシュのページを返す -----------------------------
{
  const sw = boot({ networkFails: true, cached: true });
  const page = await dispatchFetch(sw, `${SCOPE}index.html`, { mode: 'navigate', accept: 'text/html' });
  check('10. 圏外ではキャッシュしたページを返す',
    page.intercepted === true && page.response?.status === 200 && page.response?.type !== 'error');
}

// --- 11. 事前キャッシュのパスがスコープの中にある ---------------------------
{
  const sw = boot();
  const urls = sw.sandbox.__PRECACHE ?? [];
  const outside = urls.filter((u) => new URL(u, `${SCOPE}sw.js`).href.startsWith(SCOPE) === false);
  check('11. 事前キャッシュのパスが全部スコープの中にある（オリジン直下を取りに行かない）',
    urls.length > 0 && outside.length === 0, outside.join(' / '));
}

console.log(`\n  合計: ${pass} 件合格 / ${fail} 件不合格\n`);
process.exit(fail ? 1 : 0);
