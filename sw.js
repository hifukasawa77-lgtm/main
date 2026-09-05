// hide_0001 Portfolio — Service Worker
// HTML/ナビゲーションは network-first（常に最新を表示／更新が確実に反映される）、
// 静的アセットは cache-first（速度維持）。バージョン更新で旧キャッシュを破棄する。
//
// ★このSWが見るのは**同じオリジンの通信だけ**。別オリジンへは一切触らない（下の理由を参照）。
const CACHE_NAME = 'hide-portfolio-v5';

// ★パスは必ず相対で書く。このサイトは https://…github.io/main/ 配下にあり、
//   '/index.html' と書くとオリジン直下（= スコープ外の別サイト）を取りに行って
//   毎回404になる。addAll の失敗は握り潰しているので**例外もエラーも出ず、
//   ただ事前キャッシュが空のまま**になり、オフライン表示が無言で効かなくなる。
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  // ★ZERO-1 Mobile はモデルを端末に持つのに、ページ本体が取れないと起動できない。
  //   「圏外でも使えます」と謳っている以上、ページと worker は先に確保しておく
  //   （WebLLM本体はCDN＝別オリジンなので、ここでは触らない。下の理由を参照）
  './zero-1-mobile.html',
  './zero-1-mobile.webmanifest',
  './assets/js/zero1-worker.js',
  './assets/js/gesture-pointer.js',
  // 端末内ツール層とサイトの知識。これが取れないと ZERO-1 は起動しない
  // （import が解決できずモジュールごと落ちる）。圏外で使う前提なので必ず先に確保する
  './assets/js/zero1-tools.js',
  './assets/js/agent-data.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // ★別オリジンへの通信には手を出さない（respondWith を呼ばずに素通しする）。
  //
  //   SWはスコープ内のページが出す**全ての**GETを横取りする。相手が他所のサーバでも同じで、
  //   何もしなければ「ページ → SW → ネットワーク」と1段増えるだけの中継役になる。
  //   この中継が挟まると:
  //     ①SWの中で起きた失敗は、ページ側には理由の消えた `TypeError: Failed to fetch`
  //       としてしか届かない（HTTPステータスもCSP違反もURLも残らない）
  //     ②巨大なファイルの取得中にSWがメモリ回収で止められると、取得ごと落ちる
  //     ③ここは cache-first なので、取る前に毎回 caches.match() を通る（数百ファイルなら無駄も数百回）
  //
  //   2026-09-02、ZERO-1 Mobile（zero-1-mobile.html）がまさにこれを踏んだ。
  //   huggingface.co から2.5GBのモデルを取る途中で失敗し、画面には
  //   「TypeError: Failed to fetch」だけが残った——CSP違反の記録も、HTTPの状態も、
  //   どのホストで切れたのかも一切出ない。SWは自分のサイトの資源だけ見ればよく、
  //   他所への通信はブラウザに直接やらせるのが正しい。
  if (new URL(req.url).origin !== self.location.origin) return;

  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');

  // ★どちらの経路も、SWの中で例外を投げっぱなしにしないこと。
  //   respondWith に渡した約束が拒否で終わると、ページ側に届くのは理由の消えた
  //   `TypeError: Failed to fetch` だけになる。Cache Storage は端末によっては
  //   （容量枯渇・シークレットタブ・破損）使えないことがあり、caches.match 自体が落ちる。
  if (isHTML) {
    // network-first: 最新のページを取得し、成功時はキャッシュも更新。
    // オフライン時はキャッシュ→トップにフォールバック。
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      } catch (offline) {
        const hit = await matchInCache(req) || await matchInCache('./index.html');
        return hit || Response.error();
      }
    })());
    return;
  }

  // 静的アセット: cache-first（無ければネットワーク取得してキャッシュへ）。
  event.respondWith((async () => {
    const hit = await matchInCache(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (offline) {
      return Response.error();
    }
  })());
});

/** キャッシュ照会。Cache Storage が使えない端末でも、ここで止めない */
function matchInCache(request) {
  return caches.match(request).catch(() => undefined);
}
