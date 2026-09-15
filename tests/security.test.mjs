import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../cloudflare-worker/gemini-proxy.js';
import notebook from '../cloudflare-worker/notebook-worker.js';
import { allowedOrigin, readJson, SITE_ORIGIN } from '../cloudflare-worker/request-security.js';
import { securePage, pages } from '../scripts/security-csp.mjs';

const ctx = { waitUntil: () => assert.fail('Public conversations must not be persisted') };
function env(extra = {}) {
  return { RATE_LIMITER: { limit: async () => ({ success: true }) }, AI: { run: async () => ({ response: 'テスト回答' }) }, ...extra };
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
