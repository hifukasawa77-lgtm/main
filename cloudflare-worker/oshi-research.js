/**
 * 推し活ログ「イベントリサーチ」— ニュースRSSから推しの最新イベント候補を集める
 *
 * 取得先は assets/js/oshi-research.js の ALLOWED_HOSTS（news.google.com / www.bing.com）に固定する。
 * 利用者が決められるのは「推しの名前」だけで、URLは一切受け取らない（SSRF対策）。
 * キー不要・課金なし。取得結果はエッジに3時間キャッシュして、同じ名前の連打で上流を叩かない。
 *
 * 返すのは「見出し・日付(推定)・会場(推定)・出典URL」だけで、記事本文は持ち帰らない。
 * 日付と会場は見出し/要約から正規表現で拾った推定なので、画面側で必ず「要確認」と出典リンクを添える。
 */
import OR from '../assets/js/oshi-research.js';

const MAX_NAMES = 3;
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_000_000;
const UA = 'Mozilla/5.0 (compatible; OshikatsuLog/1.0; +https://hifukasawa77-lgtm.github.io/main/oshikatsu.html)';

async function fetchRss(f, url) {
  if (!OR.allowedHost(url)) throw new Error('host_not_allowed'); // 取得先はコード内の固定ホストのみ
  const res = await f(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cf: { cacheTtl: 10800, cacheEverything: true },
  });
  if (!res.ok) throw new Error('upstream_' + res.status);
  const text = await res.text();
  return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
}

// body: { names: ["推しの名前", ...] }  deps は検査用の差し込み口（fetch / now）
export async function researchOshi(body, deps = {}) {
  const f = deps.fetch || fetch;
  const now = deps.now ? deps.now() : new Date();
  const today = OR.todayISO(now);
  const names = [...new Set((Array.isArray(body && body.names) ? body.names : []).filter((n) => typeof n === 'string').map((n) => OR.cleanName(n)).filter(Boolean))].slice(0, MAX_NAMES);
  if (!names.length) return { status: 400, body: { error: 'names_required' } };

  let upstreamOk = 0, upstreamFail = 0;
  const results = [];
  for (const name of names) {
    const queries = OR.buildQueries(name);
    const settled = await Promise.allSettled(queries.map((q) => fetchRss(f, q.url)));
    const found = [];
    let fetched = 0;
    settled.forEach((r) => {
      if (r.status !== 'fulfilled') { upstreamFail++; return; }
      upstreamOk++;
      const items = OR.parseRss(r.value);
      fetched += items.length;
      items.forEach((it) => found.push(OR.fromNews(it, name, today)));
    });
    results.push({ name, items: OR.rank(found, name, 30), fetched });
  }
  if (upstreamOk === 0) return { status: 502, body: { error: 'upstream_unavailable' } };
  return { status: 200, body: { ok: true, today, fetchedAt: now.toISOString(), upstream: { ok: upstreamOk, failed: upstreamFail }, results } };
}
