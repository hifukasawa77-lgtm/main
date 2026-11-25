import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { VocalisBudget } from '../cloudflare-worker/gemini-proxy.js';
import { SITE_ORIGIN } from '../cloudflare-worker/request-security.js';

// サイト全体の訪問数（POST /visit で数え、GET /visits で読むだけ）。実物の Durable Object をメモリ上の保存先で動かす。
function namespace() {
  const objects = new Map();
  const storage = () => {
    const data = new Map();
    const api = { get: async k => data.get(k), put: async (k, v) => { data.set(k, structuredClone(v)); }, delete: async k => data.delete(k) };
    return { ...api, transaction: async fn => fn(api) };
  };
  return {
    idFromName: name => name,
    get: name => {
      if (!objects.has(name)) objects.set(name, new VocalisBudget({ storage: storage() }, {}));
      const object = objects.get(name);
      return { fetch: (url, init) => object.fetch(new Request(url, init)) };
    },
  };
}
const env = (extra = {}) => ({ RATE_LIMITER: { limit: async () => ({ success: true }) }, VOCALIS_BUDGET: namespace(), ...extra });
const call = (e, path, method, origin = SITE_ORIGIN) => worker.fetch(
  new Request('https://worker.test' + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) }),
  e, { waitUntil() {} });

test('POST /visit counts one visit; GET /visits only reads', async () => {
  const e = env();
  assert.deepEqual((await (await call(e, '/visits', 'GET')).json()).total, 0);
  for (let i = 1; i <= 3; i++) {
    const r = await call(e, '/visit', 'POST');
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.total, i);
    assert.equal(d.today, i);
  }
  const read = await (await call(e, '/visits', 'GET')).json();
  assert.equal(read.total, 3);   // 読むだけでは増えない
  assert.equal(read.today, 3);
  assert.equal(read.yesterday, 0);
  assert.equal(read.history.length, 7);
  assert.equal(read.history.at(-1).count, 3);
});

test('the counter does not mix with the AI daily quota or the Vocalis budget', async () => {
  const e = env();
  await call(e, '/visit', 'POST');
  const quota = await (await e.VOCALIS_BUDGET.get('ai-daily').fetch('https://budget/quota', { method: 'POST', body: JSON.stringify({ units: 1, limit: 10 }) })).json();
  assert.equal(quota.used, 1);
  assert.equal((await (await call(e, '/visits', 'GET')).json()).total, 1);
});

test('visit responses are CORS-limited to the site and not cacheable', async () => {
  const e = env();
  const ok = await call(e, '/visits', 'GET');
  assert.equal(ok.headers.get('Cache-Control'), 'no-store');
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), SITE_ORIGIN);
  for (const [path, method] of [['/visit', 'POST'], ['/visits', 'GET']]) {
    const bad = await call(e, path, method, 'https://evil.test');
    assert.equal(bad.status, 403, `${method} ${path} from a foreign origin`);
  }
  assert.equal((await (await call(e, '/visits', 'GET')).json()).total, 0);   // 拒否された呼び出しでは増えない
});

test('visit endpoints fail closed: no counter binding → 503, rate limited → 429 and nothing is counted', async () => {
  assert.equal((await call(env({ VOCALIS_BUDGET: undefined }), '/visit', 'POST')).status, 503);
  const e = env({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal((await call(e, '/visit', 'POST')).status, 429);
  assert.equal((await call(env(), '/visits', 'GET')).status, 200);
});

test('old days roll off and counts are kept per day', async () => {
  const e = env();
  const realNow = Date.now;
  try {
    Date.now = () => realNow() - 20 * 86400_000;   // 20日前に1回
    await call(e, '/visit', 'POST');
    Date.now = realNow;
    await call(e, '/visit', 'POST');
    const d = await (await call(e, '/visits', 'GET')).json();
    assert.equal(d.total, 2);          // 合計は残る
    assert.equal(d.today, 1);          // 日別は今日の分だけ
    assert.equal(d.history.reduce((n, h) => n + h.count, 0), 1);
  } finally { Date.now = realNow; }
});
