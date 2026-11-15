import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { VocalisBudget } from '../cloudflare-worker/gemini-proxy.js';
import { SITE_ORIGIN } from '../cloudflare-worker/request-security.js';
import { validateImage, extractJson, sanitizeResult, estimateFoodPhoto, FOOD_PHOTO_MODELS, MAX_IMAGE_BASE64 } from '../cloudflare-worker/food-photo.js';

// 最小のJPEG（先頭バイト FF D8 FF）。中身は画像として正しくなくてよい（種類の照合だけを見る）
const JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]).toString('base64');
const OK_JSON = JSON.stringify({ notFood: false, items: [{ name: '白ごはん', grams: 150, kcal: 252, p: 3.8, f: 0.5, c: 55.7 }, { name: '鮭の塩焼き', grams: 80, kcal: 160, p: 18, f: 9, c: 0 }] });

const ctx = { waitUntil: () => {} };
function budgetNamespace() {
  const objects = new Map();
  const storage = () => { const d = new Map(); const api = { get: async k => d.get(k), put: async (k, v) => { d.set(k, structuredClone(v)); }, delete: async k => d.delete(k) }; return { ...api, transaction: async fn => fn(api) }; };
  return { idFromName: n => n, get: n => { if (!objects.has(n)) objects.set(n, new VocalisBudget({ storage: storage() }, {})); const o = objects.get(n); return { fetch: (u, i) => o.fetch(new Request(u, i)) }; } };
}
const env = (ai, extra = {}) => ({ RATE_LIMITER: { limit: async () => ({ success: true }) }, AI: ai || { run: async () => ({ response: OK_JSON }) }, VOCALIS_BUDGET: budgetNamespace(), ...extra });
const req = (body, headers = {}) => new Request('https://worker.test/health/photo', { method: 'POST', headers: { Origin: SITE_ORIGIN, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('validateImage: 画像でないもの・種類と中身が違うもの・大きすぎるものを断る', () => {
  assert.equal(validateImage({}).error, 'image_required');
  assert.equal(validateImage({ image: 'hello' }).error, 'image_format');
  assert.equal(validateImage({ image: 'data:text/html;base64,PHNjcmlwdD4=' }).error, 'image_format');
  assert.equal(validateImage({ image: 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64') }).error, 'image_mismatch', 'PNGと名乗る別物');
  assert.equal(validateImage({ image: 'data:image/jpeg;base64,' + 'A'.repeat(MAX_IMAGE_BASE64 + 100) }).status, 413);
  assert.ok(validateImage({ image: JPEG }).image);
  assert.equal(validateImage(null).error, 'image_required');
});

test('extractJson: コードブロックや前置きが付いても拾う／壊れていれば null', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('はい、こちらです。{"a":2} 以上'), { a: 2 });
  assert.equal(extractJson('JSONではありません'), null);
  assert.equal(extractJson('{壊れた'), null);
  assert.equal(extractJson(null), null);
});

test('sanitizeResult: 範囲・名前・件数・kcalの食い違いを正す', () => {
  const r = sanitizeResult({ items: [
    { name: '<img src=x onerror=1>カレー', grams: 99999, kcal: '750', p: 17, f: 22, c: 120 },     // 4*17+9*22+4*120=746 → 食い違いなし
    { name: '作り話', grams: 100, kcal: 5, p: 30, f: 30, c: 100 },                              // 4*30+9*30+400=790 に対し kcal=5 → 計算し直し
    { name: '', kcal: 100 }, { name: 'kcalなし' }, null, 'x',
    { name: '巨大', kcal: 999999, p: 0, f: 0, c: 0 },
  ] });
  assert.equal(r.items.length, 3);
  assert.ok(!/[<>]/.test(r.items[0].name), 'タグの記号は落とす');
  assert.equal(r.items[0].grams, 2000);
  assert.equal(r.items[0].kcal, 750);
  assert.equal(r.items[0].adjusted, false);
  assert.equal(r.items[1].kcal, 790);
  assert.equal(r.items[1].adjusted, true);
  assert.equal(r.items[2].kcal, 3000, 'kcalは上限へ丸める');
  assert.equal(sanitizeResult({ items: Array.from({ length: 20 }, (_, i) => ({ name: 'x' + i, kcal: 10 })) }).items.length, 8);
  assert.deepEqual(sanitizeResult({ notFood: true, items: [] }), { notFood: true, items: [] });
  assert.equal(sanitizeResult({ items: [] }), null, '空で notFood でもない＝読めていない');
  assert.equal(sanitizeResult(null), null);
  assert.equal(sanitizeResult({ notFood: true, items: [{ name: 'a', kcal: 1 }] }).notFood, false, '品目があるなら食べ物');
});

test('estimateFoodPhoto: 画像をチャット形式で渡し、先頭モデルが失敗したら次へ', async () => {
  const calls = [];
  const ai = { run: async (model, input) => { calls.push({ model, input }); if (calls.length === 1) throw new Error('not available'); return { choices: [{ message: { content: '```json\n' + OK_JSON + '\n```' } }] }; } };
  const r = await estimateFoodPhoto({ AI: ai }, { image: JPEG });
  assert.equal(r.status, 200);
  assert.equal(r.body.items.length, 2);
  assert.equal(r.body.model, FOOD_PHOTO_MODELS[1]);
  const user = calls[1].input.messages.find(m => m.role === 'user');
  assert.ok(user.content.some(c => c.type === 'image_url' && c.image_url.url === JPEG), '画像が渡る');
  assert.equal(calls[0].input.messages[0].role, 'system');
});

test('estimateFoodPhoto: 全滅は model_unavailable、読めない出力は unreadable（空の成功にしない）', async () => {
  assert.deepEqual((await estimateFoodPhoto({ AI: { run: async () => { throw new Error('x'); } } }, { image: JPEG })).body, { error: 'model_unavailable' });
  const r = await estimateFoodPhoto({ AI: { run: async () => ({ response: 'おいしそうですね！' }) } }, { image: JPEG });
  assert.equal(r.status, 502); assert.equal(r.body.error, 'unreadable');
  assert.equal((await estimateFoodPhoto({}, { image: JPEG })).status, 503);
  assert.equal((await estimateFoodPhoto({ AI: { run: async () => { throw new Error('no'); } } }, { image: 'x' })).status, 400, '画像が不正ならAIを呼ばない');
});

test('/health/photo: 本物のWorkerを通る（Origin・本文上限・クォータ）', async () => {
  const res = await worker.fetch(req({ image: JPEG }), env(), ctx);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).items[0].name, '白ごはん');
  assert.equal((await worker.fetch(req({}), env(), ctx)).status, 400);
  assert.equal((await worker.fetch(req({ image: JPEG }, { Origin: 'https://evil.test' }), env(), ctx)).status, 403);
  const big = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(700_000)]).toString('base64');
  assert.equal((await worker.fetch(req({ image: big }), env(), ctx)).status, 200, '約0.9MBの縮小済み写真は通る');
  const huge = 'data:image/jpeg;base64,' + 'A'.repeat(1_500_000);
  assert.equal((await worker.fetch(req({ image: huge }), env(), ctx)).status, 413, '大きすぎる本文は断る');
  const other = new Request('https://worker.test/', { method: 'POST', headers: { Origin: SITE_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'a'.repeat(20000) }) });
  assert.equal((await worker.fetch(other, env(), ctx)).status, 413, '他の経路の上限(16KB)は変わらない');
  const e = env(null, { AI_DAILY_UNITS: '6' });
  assert.equal((await worker.fetch(req({ image: JPEG }), e, ctx)).status, 200);
  assert.equal((await worker.fetch(req({ image: JPEG }), e, ctx)).status, 429, '1回6単位で数える（上限6なら2回目は止まる）');
});
