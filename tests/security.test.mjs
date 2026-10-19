import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker, { VocalisBudget } from '../cloudflare-worker/gemini-proxy.js';
import notebook from '../cloudflare-worker/notebook-worker.js';
import { allowedOrigin, readJson, SITE_ORIGIN } from '../cloudflare-worker/request-security.js';
import { securePage, pages } from '../scripts/security-csp.mjs';

const ctx = { waitUntil: () => assert.fail('Public conversations must not be persisted') };
/** The real VocalisBudget Durable Object on in-memory storage, one instance per name (like idFromName). */
function budgetNamespace() {
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
function env(extra = {}) {
  return { RATE_LIMITER: { limit: async () => ({ success: true }) }, AI: { run: async () => ({ response: 'テスト回答' }) }, VOCALIS_BUDGET: budgetNamespace(), ...extra };
}
function req(body = { message: 'こんにちは' }, path = '/', headers = {}, method = 'POST') {
  return new Request('https://worker.test' + path, { method,
    headers: { Origin: SITE_ORIGIN, 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET' || method === 'OPTIONS' ? {} : { body: JSON.stringify(body) }),
  });
}

for (const origin of ['https://hifukasawa77-lgtm.github.io.evil.test', 'https://hifukasawa77-lgtm.github.io@evil.test', 'http://localhost.evil.test', 'null', '']) {
  test(`Origin rejects ${origin || '(missing)'}`, async () => {
    assert.equal(allowedOrigin(origin), false);
    for (const handler of [worker, notebook]) {
      const response = await handler.fetch(req({}, '/', { Origin: origin }), env(), ctx);
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
  });
}
test('Local development requires explicit opt-in and an exact loopback host', () => {
  assert.equal(allowedOrigin('http://localhost:5500'), false);
  assert.equal(allowedOrigin('http://localhost:5500', { ALLOW_LOCAL_DEV: 'true' }), true);
  assert.equal(allowedOrigin('http://localhost.evil:5500', { ALLOW_LOCAL_DEV: 'true' }), false);
});
for (const body of [null, [], 'text', 42]) {
  test(`Malformed shape ${JSON.stringify(body)} returns 400`, async () => {
    assert.equal((await worker.fetch(req(body), env(), ctx)).status, 400);
    assert.equal((await notebook.fetch(req(body), env(), ctx)).status, 400);
  });
}
test('Content-type and malformed JSON rejected', async () => {
  assert.equal((await worker.fetch(req({}, '/', { 'Content-Type': 'text/plain' }), env(), ctx)).status, 415);
  const request = new Request('https://worker.test', { method:'POST', headers: { Origin: SITE_ORIGIN, 'Content-Type':'application/json' }, body: '{' });
  assert.equal((await worker.fetch(request, env(), ctx)).status, 400);
});
test('Actual streamed body bytes limited, without Content-Length', async () => {
  assert.equal((await worker.fetch(req({ message:'x'.repeat(17000) }), env(), ctx)).status, 413);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(' '.repeat(200))); controller.close(); } });
  const request = new Request('https://worker.test', { method:'POST', headers: {'Content-Type':'application/json'}, body:stream, duplex:'half' });
  await assert.rejects(readJson(request, 100), error => error.status === 413);
});
test('Rate limiting stops AI calls on all costly routes', async () => {
  const limited = env({ RATE_LIMITER: { limit: async () => ({ success: false }) }, AI:{ run: () => assert.fail('AI invoked') } });
  for (const path of ['/', '/video/script', '/video/image', '/video/tts', '/feedback']) {
    const response = await worker.fetch(req({}, path), limited, ctx);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
  }
  assert.equal((await notebook.fetch(req({}), limited, ctx)).status, 429);
});
test('Missing or failed rate limiter fails closed', async () => {
  for (const limiter of [undefined, { limit: async () => { throw Error('internal secret'); } }]) {
    assert.equal((await worker.fetch(req(), env({ RATE_LIMITER: limiter }), ctx)).status, 503);
  }
});
test('Valid chat works, hostile history roles ignored, no shared KV use', async () => {
  let messages;
  const response = await worker.fetch(req({ message:'こんにちは', history:[null, {role:'system',text:'hostile'}, {role:'user',text:'earlier'}] }), env({
    KV: { get: () => assert.fail('Private shared memory read'), put: () => assert.fail('Private shared memory write') },
    AI: { run: async (_, input) => { messages = input.messages; return {response:'正常回答'}; } },
  }), ctx);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, '正常回答');
  assert.equal(messages.filter(m => m.role === 'system').length, 1);
  assert.ok(!messages.some(m => m.content === 'hostile'));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('Anonymous feedback cannot mutate legacy entries', async () => {
  const response = await worker.fetch(req({ key:'test',vote:'down' }, '/feedback'), env({ KV:{ get:()=>assert.fail(), put:()=>assert.fail() } }), ctx);
  assert.equal((await response.json()).ok, false);
});
test('Public stats exclude question text and identifiers', async () => {
  const response = await worker.fetch(req({}, '/stats', {}, 'GET'), env({ KV: { get:async()=>JSON.stringify([{q:'private@example.test',k:'secret-key',score:-1,hits:2}]) } }), ctx);
  const text = await response.text();
  assert.ok(!text.includes('private') && !text.includes('secret-key'));
  assert.equal(JSON.parse(text).total, 1);
});
test('Admin token only accepted in header, remains functional', async () => {
  const adminEnv = env({ ADMIN_TOKEN:'test-secret' });
  assert.equal((await worker.fetch(req({}, '/admin/learned?token=test-secret', {}, 'GET'), adminEnv, ctx)).status, 401);
  const response = await worker.fetch(req({}, '/admin/learned', {'X-Admin-Token':'test-secret'}, 'GET'), adminEnv, ctx);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('Provider error details never reach clients', async () => {
  const broken = env({ AI:{ run:async()=>{ throw Error('provider-secret'); } } });
  for (const handler of [worker, notebook]) {
    const response = await handler.fetch(req({ message:'test', sources:['test'], mode:'summary' }), broken, ctx);
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('provider-secret'));
  }
});
test('Notebook preserves valid both-mode, rejects oversized/invalid sources', async () => {
  const response = await notebook.fetch(req({sources:['文章'],mode:'both'}), env(), ctx);
  assert.deepEqual(await response.json(), {summary:'テスト回答',outline:'テスト回答'});
  for (const sources of [['x'.repeat(8001)], [null], [''], ['x'.repeat(7000), 'y'.repeat(7000), 'z'.repeat(7000)]]) {
    assert.equal((await notebook.fetch(req({sources,mode:'summary'}), env(), ctx)).status, 400);
  }
});
for (const page of pages) {
  test(`${page}: CSP matches exact code and excludes event attributes`, () => {
    const html = fs.readFileSync(new URL('../' + page, import.meta.url),'utf8');
    assert.equal(html, securePage(html, page));
    const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    assert.ok(!policy.match(/script-src [^;]*(?:unsafe-inline|unsafe-eval|https:;)/));
    assert.match(policy, /script-src-attr 'none'/);
    assert.ok(!/\son(?:click|change|load|error|mouseover|mouseout|input)\s*=/i.test(html));
    for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!script[1].includes('application/ld+json')) new vm.Script(script[2], {filename:page});
    }
    assert.notEqual(securePage(html.replace('</script>', '\n// modified\n</script>'), page), html);
  });
}
test('Every Worker reply carries hardening headers, including plain-text errors', async () => {
  const replies = [
    await worker.fetch(req({}, '/no-such-route', {}, 'GET'), env(), ctx),
    await worker.fetch(req({}, '/', { Origin: 'https://evil.test' }), env(), ctx),
    await worker.fetch(req({ message: '' }), env(), ctx),
    await notebook.fetch(req({}, '/', {}, 'GET'), env(), ctx),
    await notebook.fetch(req({}, '/', {}, 'OPTIONS'), env(), ctx),
  ];
  for (const response of replies) {
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
    assert.match(response.headers.get('Content-Security-Policy'), /default-src 'none'.*frame-ancestors 'none'/);
    assert.match(response.headers.get('Strict-Transport-Security'), /max-age=\d+/);
  }
});

// ── Security gate: block → syslog → notify ─────────────────────────────────────────────
import { syslogLine, detectAttack, alertText, maskIp, BAN_SECONDS, SELFTEST_PREFIX } from '../cloudflare-worker/security-monitor.js';

// Fake webhook (not a secret). Split so the secret scanner in release-check does not flag the fixture.
const FAKE_SLACK_WEBHOOK = 'https://hooks.slack.com/' + 'services/TEST/TEST/TEST';
function harness({ webhook = FAKE_SLACK_WEBHOOK, abuse } = {}) {
  const store = new Map();
  const logs = [];
  const posts = [];
  const waits = [];
  const saved = { caches: globalThis.caches, fetch: globalThis.fetch, warn: console.warn, error: console.error };
  globalThis.caches = { default: {
    match: async key => store.get(String(key)),
    put: async (key, res) => { store.set(String(key), res); },
  } };
  globalThis.fetch = async (url, init) => { posts.push({ url: String(url), body: JSON.parse(init.body) }); return new Response('ok'); };
  console.warn = line => logs.push(line);
  console.error = line => logs.push(line);
  const restore = () => Object.assign(globalThis, { caches: saved.caches, fetch: saved.fetch }) &&
    Object.assign(console, { warn: saved.warn, error: saved.error });
  const e = env({ SECURITY_ALERT_WEBHOOK_URL: webhook, ADMIN_TOKEN: 'correct-token', ...(abuse ? { ABUSE_LIMITER: abuse } : {}) });
  const c = { waitUntil: p => waits.push(p) };
  const settle = () => Promise.all(waits.splice(0));
  return { store, logs, posts, e, c, settle, restore };
}

test('syslog lines are RFC 5424 with the authpriv facility and cannot be split by injected newlines', () => {
  const line = syslogLine({ severity: 'alert', service: 'ai-proxy', host: 'w.test', kind: 'x', ip: '1.2.3.4',
    path: '/a"]\nfake <0>1 line', time: '2026-10-08T00:00:00.000Z' });
  assert.match(line, /^<81>1 2026-10-08T00:00:00\.000Z w\.test ai-proxy - SECURITY \[sec@32473 /);
  assert.ok(!line.includes('\n'));
  assert.match(line, /path="\/a\\"\\\] fake <0>1 line"/);
  assert.match(syslogLine({ severity: 'notice', kind: 'k' }), /^<85>1 /);
});

for (const [path, kind] of [['/../../etc/passwd', 'path-traversal'], ['/wp-admin/setup.php', 'scanner-probe'],
  ['/.env', 'scanner-probe'], ['/?q=%3Cscript%3Ealert(1)%3C/script%3E', 'markup-injection'],
  ['/?id=1%20UNION%20SELECT%20password', 'sql-injection'], ['/?x=${jndi:ldap://e/a}', 'template-injection']]) {
  test(`Attack-shaped request ${path} is refused before the handler and logged`, async () => {
    assert.equal(detectAttack(new URL('https://w.test' + path)), kind);
    const h = harness();
    try {
      const response = await worker.fetch(req({}, path), h.e, h.c);
      await h.settle();
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
      assert.ok(h.logs.some(l => l.includes(`kind="${kind}"`)), h.logs.join('\n'));
      assert.equal(h.posts.length, 1, 'owner is notified');
      assert.match(h.posts[0].body.text, /攻撃を検知して遮断/);
    } finally { h.restore(); }
  });
}
test('Ordinary requests are not mistaken for attacks', () => {
  for (const p of ['/', '/feedback', '/video/script', '/oshi/research', '/vocal/usage', '/stats'])
    assert.equal(detectAttack(new URL('https://w.test' + p)), null);
});

test('Admin token guessing is logged at alert level, notified once, then throttled', async () => {
  const h = harness();
  try {
    for (let i = 0; i < 3; i++) {
      const r = await worker.fetch(req({}, '/admin/list', { 'X-Admin-Token': 'guess' + i }, 'GET'), h.e, h.c);
      assert.equal(r.status, 401);
      await h.settle();
    }
    assert.equal(h.logs.filter(l => l.startsWith('<81>1') && l.includes('kind="admin-auth-failure"')).length, 3);
    assert.equal(h.posts.length, 1, 'same kind within the throttle window → one message');
  } finally { h.restore(); }
});

test('An IP that keeps getting rejected is banned and refused before reaching the handler', async () => {
  let strikes = 0;
  const h = harness({ abuse: { limit: async () => ({ success: ++strikes <= 2 }) } });
  try {
    for (let i = 0; i < 3; i++) await worker.fetch(req({}, '/', { Origin: 'https://evil.test', 'CF-Connecting-IP': '203.0.113.9' }), h.e, h.c);
    await h.settle();
    assert.ok(h.logs.some(l => l.includes('kind="ip-banned"')), 'ban is logged');
    assert.ok(h.posts.some(p => /ip-banned/.test(p.body.text) && /203\.0\.113\.x/.test(p.body.text)), 'ban is notified, IP masked');
    let handlerRan = false;
    const r = await worker.fetch(req({ message: 'hi' }, '/', { 'CF-Connecting-IP': '203.0.113.9' }),
      { ...h.e, AI: { run: async () => { handlerRan = true; return { response: 'x' }; } } }, h.c);
    assert.equal(r.status, 403);
    assert.equal(handlerRan, false);
    const other = await worker.fetch(req({ message: 'hi' }, '/', { 'CF-Connecting-IP': '198.51.100.1' }), h.e, { waitUntil() {} });
    assert.equal(other.status, 200, 'other visitors are unaffected');
    assert.equal(BAN_SECONDS, 900);
  } finally { h.restore(); }
});

test('Page reports: only from the site, small, known kinds; framing is notified', async () => {
  const h = harness();
  const report = (body, origin = SITE_ORIGIN) => worker.fetch(new Request('https://w.test/security/report', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain;charset=UTF-8' }, body }), h.e, h.c);
  try {
    assert.equal((await report(JSON.stringify({ kind: 'framed', page: '/main/', framer: 'https://evil.test' }))).status, 204);
    assert.equal((await report(JSON.stringify({ kind: 'framed' }), 'https://evil.test')).status, 403);
    assert.equal((await report('{"kind":"nope"}')).status, 400);
    assert.equal((await report('x'.repeat(5000))).status, 400);
    await h.settle();
    assert.ok(h.logs.some(l => l.includes('kind="framed"') && l.includes('framer=https://evil.test')));
    assert.equal(h.posts.filter(p => /framed/.test(p.body.text)).length, 1);
  } finally { h.restore(); }
});

test('Alerts only go to real webhook hosts, and nothing is sent when no webhook is configured', async () => {
  for (const webhook of ['https://evil.test/hook', 'http://hooks.slack.com/x', '']) {
    const h = harness({ webhook });
    try {
      await worker.fetch(req({}, '/.env'), h.e, h.c);
      await h.settle();
      assert.equal(h.posts.length, 0, webhook);
      assert.ok(h.logs.some(l => l.includes('kind="scanner-probe"')), 'still logged');
    } finally { h.restore(); }
  }
  assert.equal(maskIp('2001:db8:1:2::5'), '2001:db8:1:…');
  assert.match(alertText({ severity: 'err', kind: 'k', method: 'GET', host: 'h', path: '/p', ip: '1.2.3.4' }), /1\.2\.3\.x/);
});

test('Deploy self-test probe is blocked and logged but never pages the owner or uses the throttle', async () => {
  const h = harness();
  try {
    const r = await worker.fetch(req({}, SELFTEST_PREFIX + '.env', {}, 'GET'), h.e, h.c);
    await h.settle();
    assert.equal(r.status, 403);
    assert.ok(h.logs.some(l => l.includes('kind="scanner-probe"')));
    assert.equal(h.posts.length, 0, 'no alert for the self-test');
    await worker.fetch(req({}, '/.env', {}, 'GET'), h.e, h.c);
    await h.settle();
    assert.equal(h.posts.length, 1, 'a real probe right after the self-test is still notified');
  } finally { h.restore(); }
});

test('A mistyped user access code is counted but not paged; a wrong admin token is', async () => {
  const h = harness();
  try {
    const r = await worker.fetch(req({}, '/vocal/usage', { 'X-Vocalis-Code': 'typo' }, 'GET'),
      { ...h.e, VOCALIS_ACCESS_PIN: 'right' }, h.c);
    await h.settle();
    assert.equal(r.status, 401);
    assert.ok(h.logs.some(l => l.includes('kind="access-code-failure"') && l.startsWith('<85>1')), h.logs.join('\n'));
    assert.equal(h.posts.length, 0, 'user typo must not alert');
    await worker.fetch(req({}, '/admin/list', { 'X-Admin-Token': 'guess' }, 'GET'), h.e, h.c);
    await h.settle();
    assert.equal(h.posts.length, 1);
    assert.match(h.posts[0].body.text, /admin-auth-failure/);
  } finally { h.restore(); }
});

test('Page reports are labelled unverified and a forged flood gets the sender banned', async () => {
  let strikes = 0;
  const h = harness({ abuse: { limit: async () => ({ success: ++strikes <= 3 }) } });
  const report = () => worker.fetch(new Request('https://w.test/security/report', {
    method: 'POST', headers: { Origin: SITE_ORIGIN, 'Content-Type': 'text/plain', 'CF-Connecting-IP': '192.0.2.7' },
    body: JSON.stringify({ kind: 'framed', framer: 'https://x.test' }) }), h.e, h.c);
  try {
    const first = await report();
    assert.equal(first.status, 204);
    for (let i = 0; i < 4; i++) await report();
    await h.settle();
    assert.ok(h.posts.some(p => /検証できない/.test(p.body.text)), 'alert says the report is unverified');
    assert.ok(h.logs.some(l => l.includes('kind="ip-banned"')), 'forged flood is banned');
    assert.equal((await report()).status, 403);
  } finally { h.restore(); }
});

// ── 2026-10-19 点検の穴 ──────────────────────────────────────────────────────────────────────
test('Daily AI quota is shared by all visitors: chat, video and notebook stop at the limit and the model is not called', async () => {
  let calls = 0;
  const e = env({ AI_DAILY_UNITS: '3', AI: { run: async () => { calls += 1; return { response: 'x', image: 'aW1n' }; } } });
  for (let i = 0; i < 3; i++) assert.equal((await worker.fetch(req({ message: 'hi' }), e, ctx)).status, 200);
  const over = await worker.fetch(req({ message: 'hi' }), e, ctx);
  assert.equal(over.status, 429, 'the 4th chat ran past the daily limit');
  assert.match((await over.json()).error, /上限/);
  assert.equal(calls, 3, 'the model was called past the limit');
  // An image costs more than one unit, so it cannot slip through a nearly-full budget
  const fresh = env({ AI_DAILY_UNITS: '9', AI: { run: async () => { calls += 1; return { image: 'aW1n' }; } } });
  calls = 0;
  assert.equal((await worker.fetch(req({ prompt: 'cat', steps: 8 }, '/video/image'), fresh, ctx)).status, 429, '8-step image fit in 9 units');
  assert.equal((await worker.fetch(req({ prompt: 'cat', steps: 4 }, '/video/image'), fresh, ctx)).status, 200);
  assert.equal(calls, 1);
  // Notebook (72B) counts 5, or 10 for both modes, against the same budget
  const shared = env({ AI_DAILY_UNITS: '9' });
  const nb = body => notebook.fetch(new Request('https://nb.test/', { method: 'POST', headers: { Origin: SITE_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), shared, ctx);
  assert.equal((await nb({ sources: ['資料'], mode: 'both' })).status, 429);
  assert.equal((await nb({ sources: ['資料'], mode: 'summary' })).status, 200);
  assert.equal((await worker.fetch(req({ message: 'hi' }), shared, ctx)).status, 200);
  assert.equal((await worker.fetch(req({ message: 'hi' }), shared, ctx)).status, 200);
  assert.equal((await worker.fetch(req({ message: 'hi' }), shared, ctx)).status, 200);
  assert.equal((await worker.fetch(req({ message: 'hi' }), shared, ctx)).status, 200);
  assert.equal((await worker.fetch(req({ message: 'hi' }), shared, ctx)).status, 429, 'chat did not count what the notebook already used (they must share one budget)');
});

test('Daily AI quota fails closed: no budget binding, or a broken one, refuses instead of running uncounted', async () => {
  let calls = 0;
  const ai = { run: async () => { calls += 1; return { response: 'x' }; } };
  const missing = env({ VOCALIS_BUDGET: undefined, AI: ai });
  assert.equal((await worker.fetch(req({ message: 'hi' }), missing, ctx)).status, 503);
  const broken = env({ AI: ai, VOCALIS_BUDGET: { idFromName: n => n, get: () => ({ fetch: async () => { throw new Error('down'); } }) } });
  assert.equal((await worker.fetch(req({ message: 'hi' }), broken, ctx)).status, 503);
  assert.equal(calls, 0);
});

test('Rate limits and bans count an IPv6 /64 as one client (rotating addresses inside it does not reset the count)', async () => {
  const keys = [];
  const e = env({ RATE_LIMITER: { limit: async ({ key }) => { keys.push(key); return { success: true }; } } });
  for (const ip of ['2001:db8:1:2::1', '2001:db8:1:2:aaaa:bbbb:cccc:dddd', '2001:0db8:0001:0002::ffff']) {
    await worker.fetch(req({ message: 'hi' }, '/', { 'CF-Connecting-IP': ip }), e, ctx);
  }
  assert.equal(new Set(keys).size, 1, `each address got its own count: ${keys.join(', ')}`);
  keys.length = 0;
  await worker.fetch(req({ message: 'hi' }, '/', { 'CF-Connecting-IP': '2001:db8:1:3::1' }), e, ctx);
  await worker.fetch(req({ message: 'hi' }, '/', { 'CF-Connecting-IP': '203.0.113.7' }), e, ctx);
  assert.deepEqual(keys, ['2001:db8:1:3::/64', '203.0.113.7']);
});

test('Forged page reports cannot ping @channel/@everyone or plant disguised links in the owner\'s Slack/Discord', async () => {
  for (const webhook of [FAKE_SLACK_WEBHOOK, 'https://discord.com/api/webhooks/1/abc']) {
    const h = harness({ webhook });
    try {
      const evil = '<!channel> <https://evil.example/verify|Cloudflare: ログイン確認> @everyone [確認](https://evil.example/x)';
      const r = await worker.fetch(new Request('https://w.test/security/report', { method: 'POST',
        headers: { Origin: SITE_ORIGIN, 'Content-Type': 'text/plain' }, body: JSON.stringify({ kind: 'framed', framer: evil }) }), h.e, h.c);
      assert.equal(r.status, 204);
      await h.settle();
      assert.equal(h.posts.length, 1);
      const body = h.posts[0].body;
      const text = body.text ?? body.content;
      for (const bad of ['<!channel>', '<https://', '@everyone', '](https://', 'https://evil']) {
        assert.ok(!text.includes(bad), `${bad} reached the alert: ${text}`);
      }
      assert.match(text, /evil\.example/, 'the report content is still visible (defanged), not dropped');
      if (body.content !== undefined) assert.deepEqual(body.allowed_mentions, { parse: [] });
    } finally { h.restore(); }
  }
});

test('One sender cannot mute alerts for everyone: the throttle is per kind and per (masked) source', async () => {
  const h = harness();
  try {
    const report = ip => worker.fetch(new Request('https://w.test/security/report', { method: 'POST',
      headers: { Origin: SITE_ORIGIN, 'Content-Type': 'text/plain', 'CF-Connecting-IP': ip }, body: JSON.stringify({ kind: 'framed', framer: 'x' }) }), h.e, h.c);
    await report('198.51.100.20'); await report('198.51.100.20');
    await h.settle();
    assert.equal(h.posts.length, 1, 'the same source is still summarised');
    await report('192.0.2.30');
    await h.settle();
    assert.equal(h.posts.length, 2, 'an attacker\'s cheap event silenced the real alert from another source');
  } finally { h.restore(); }
});

test('The URL attack filter stays fast on hostile input and still catches template injection', () => {
  const started = performance.now();
  detectAttack(new URL('https://w.test/?' + '%3C%25'.repeat(8000)));
  assert.ok(performance.now() - started < 50, 'quadratic regex: a 48KB URL took too long (CPU per request)');
  assert.equal(detectAttack(new URL('https://w.test/?t=%3C%25%3D%207*7%20%25%3E')), 'template-injection');
});

test('Syslog values are cut before escaping, so a long run of quotes cannot break the structured-data block', () => {
  const line = syslogLine({ severity: 'notice', kind: 'k', ua: 'a' + '"'.repeat(400), country: 'JP' });
  const sd = line.slice(line.indexOf('[sec@32473 '), line.lastIndexOf(']') + 1);
  // Every parameter value must close: ua="…" followed by the next parameter
  assert.match(sd, /ua="(?:[^"\\]|\\.)*" country="JP"\]/, `broken structured data: ${sd.slice(-80)}`);
});

test('Vocalis returns fixed error text, never the upstream exception message', async () => {
  const e = env({ VOCALIS_ACCESS_PIN: 'pin-123456', AI: { run: async () => { throw new Error('internal account 1234 quota detail'); } } });
  for (const [path, body] of [['/vocal/portrait', { profile: { name: 'A', voice: 'female', appearance: 'short hair', style: 'アニメ' } }],
    ['/vocal/song', { theme: 'sky', minutes: 1, voice: 'female', genre: 'J-POP' }]]) {
    const r = await worker.fetch(req(body, path, { 'X-Vocalis-Code': 'pin-123456' }), e, { waitUntil() {} });
    const text = await r.text();
    assert.ok(r.status >= 400);
    assert.ok(!text.includes('internal account'), `${path} leaked the upstream message: ${text}`);
  }
});
