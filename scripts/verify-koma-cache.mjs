// 古いcache-first Service Workerが残った状態で新版を開けるか、本物のブラウザーで検証。
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'koma_ken.html'), 'utf8');
const sources = [...html.matchAll(/src="(assets\/koma-ken\/js\/[^"?]+\.js)/g)].map(m => m[1]);
const release = html.match(/data-koma-release="([^"]+)"/)[1];
let upgradeReady = false;
const servedModules = [];
const oldWorker = `
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil((async () => {
 const c = await caches.open('hide-portfolio-v9');
 for (const src of ${JSON.stringify(sources)}) await c.put(src, new Response('globalThis.__STALE_KOMA_LOADED = true;', {headers:{'Content-Type':'text/javascript'}}));
 await c.put('/koma_ken.html', new Response('OLD GAME HTML', {headers:{'Content-Type':'text/html'}}));
 await caches.open('webllm-models');
})()); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
 const u = new URL(e.request.url);
 if (u.origin !== self.location.origin) return;
 if (u.pathname.endsWith('.html')) { e.respondWith(fetch(e.request)); return; }
 e.respondWith(caches.open('hide-portfolio-v9').then(async c => (await c.match(e.request)) || fetch(e.request)));
});`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/sw.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(upgradeReady ? fs.readFileSync(path.join(root, 'sw.js')) : oldWorker); return; }
  if (url.pathname === '/seed.html') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Old cache fixture</title>'); return; }
  const file = path.resolve(root, '.' + url.pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  if (url.pathname.startsWith('/assets/koma-ken/js/')) servedModules.push(url.pathname + url.search);
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__swUpdateCalls = 0;
    const update = ServiceWorkerRegistration.prototype.update;
    ServiceWorkerRegistration.prototype.update = function () { window.__swUpdateCalls++; return update.call(this); };
  });
  await page.goto(base + '/seed.html');
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }));
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  assert.match(await page.evaluate(src => fetch('/' + src).then(r => r.text()), sources[0]), /__STALE_KOMA_LOADED/);
  console.log('PASS: unversioned scripts reproduce a stale cache-first response');
  await page.goto(base + '/koma_ken.html?v=' + release);
  await page.waitForFunction(() => window.__KOMA && window.__KOMA.assets.summary().total > 0);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.komaRelease), release);
  assert.equal(await page.evaluate(() => !!window.__STALE_KOMA_LOADED), false);
  assert.equal(new Set(servedModules.map(u => u.split('?')[0])).size, sources.length);
  assert.ok(servedModules.every(u => /\?v=[a-f0-9]{12}$/.test(u)));
  await page.locator('canvas').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__KOMA.game.state === 'play');
  assert.ok(await page.evaluate(() => typeof KOMA.SaveStore.read === 'function' && typeof KOMA.Audio === 'function' && document.querySelector('#touch-controls')));
  console.log('PASS: all 14 current modules load and play starts despite old cached scripts and HTML');
  await page.waitForFunction(() => window.__swUpdateCalls > 0);
  console.log('PASS: a direct game visit asks the existing Service Worker to update');
  upgradeReady = true;
  await page.goto(base + '/koma_ken.html');
  await page.waitForFunction(async () => !(await caches.keys()).includes('hide-portfolio-v9'));
  assert.ok(await page.evaluate(async () => (await caches.keys()).includes('webllm-models')));
  assert.deepEqual(errors, []);
  console.log('PASS: updated worker removes the old site cache, preserves model caches, and has no page errors');
  const fresh = await browser.newContext(), freshPage = await fresh.newPage();
  await freshPage.goto(base + '/koma_ken.html');
  await freshPage.waitForFunction(() => window.__KOMA);
  assert.equal(await freshPage.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  await fresh.close();
  console.log('PASS: a fresh game-only visit does not install a new Service Worker');
} finally { await browser.close(); server.close(); }
