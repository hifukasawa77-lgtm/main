import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(process.env.PINBALL_OUTPUT || '/tmp/neon-pinball-test');
const before = process.env.PINBALL_BEFORE ? await readFile(process.env.PINBALL_BEFORE) : null;
const types = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2'
};

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  if (path === '/main/pinball-before.html' && before) {
    res.writeHead(200, { 'Content-Type': types['.html'] }).end(before);
    return;
  }
  const relative = path.replace(/^\/main\//, '').replace(/^\//, '');
  const file = resolve(root, relative || 'index.html');
  try {
    if (!file.startsWith(root)) throw new Error('Outside repository');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
});

function count(text) {
  return Number(text.replaceAll(',', ''));
}

async function readScore(page, id = '#score') {
  return count(await page.locator(id).textContent());
}

async function rafSample(page, duration) {
  return page.evaluate(durationMs => new Promise(resolve => {
    const frames = [];
    let start, last;
    function frame(now) {
      start ??= now;
      if (last !== undefined) frames.push(now - last);
      last = now;
      if (now - start < durationMs) requestAnimationFrame(frame);
      else {
        const sorted = [...frames].sort((a, b) => a - b);
        resolve({ frames: frames.length, fps: frames.length * 1000 / (now - start),
          p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)] });
      }
    }
    requestAnimationFrame(frame);
  }), duration);
}

await mkdir(output, { recursive: true });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = `http://127.0.0.1:${server.address().port}/main/`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    args: ['--disable-dev-shm-usage', '--disable-background-networking', '--no-proxy-server'],
    headless: true,
    timeout: 15000
  });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await desktop.route(url => url.origin !== new URL(base).origin, route => route.abort());
  const page = await desktop.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (location.pathname.endsWith('/pinball.html') && !localStorage.getItem('neon-pinball:best')) {
      localStorage.setItem('gamekit:neon-pinball:hiscore', '42');
    }
  });
  if (before) {
    await page.goto(base + 'pinball-before.html');
    await page.waitForFunction(() => window.GameKit && document.querySelector('canvas').width === 540);
    await page.waitForTimeout(350);
    await page.screenshot({ path: resolve(output, 'pinball-before-desktop.png') });
  }

  await page.goto(base + 'pinball.html');
  await page.waitForFunction(() => document.querySelector('#mission-name').textContent !== '');
  assert.equal(await readScore(page, '#best'), 42, 'legacy high score is read');
  await page.screenshot({ path: resolve(output, 'pinball-after-desktop.png') });
  await page.locator('#help').click();
  assert(await page.locator('#controls-dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.locator('#settings').click();
  await page.locator('#mute').check();
  await page.locator('#volume').fill('35');
  await page.locator('#reduced').check();
  await page.locator('#settings-dialog button').click();
  await page.locator('#play').click();

  await page.keyboard.down('Space');
  await page.waitForFunction(() => document.querySelector('#mode-meter').value > .25);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => document.querySelector('#launch').disabled);
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  assert(await page.locator('#left').evaluate(node => node.classList.contains('is-held')));
  assert(await page.locator('#right').evaluate(node => node.classList.contains('is-held')));
  await page.keyboard.up('ArrowLeft');
  assert(await page.locator('#right').evaluate(node => node.classList.contains('is-held')));
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('q');
  await page.keyboard.press('p');
  assert.equal(await page.locator('#overlay-kicker').textContent(), 'PAUSED');
  const frozen = await page.locator('#game').evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(160);
  assert.equal(await page.locator('#game').evaluate(canvas => canvas.toDataURL()), frozen);
  await page.locator('#play').click();
  await page.waitForFunction(() => Number(document.querySelector('#score').textContent.replaceAll(',', '')) > 42);

  for (let ball = 2; ball >= 1; ball--) {
    await page.waitForFunction(expected => Number(document.querySelector('#stock').textContent) === expected, ball, { timeout: 25000 });
    await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => ['GAME OVER', 'NEW HIGH SCORE'].includes(document.querySelector('#overlay-kicker').textContent), null, { timeout: 25000 });
  const best = await readScore(page, '#best');
  assert(best > 42);
  await page.locator('#play').click();
  assert.equal(await readScore(page, '#stock'), 3);
  await page.reload();
  await page.waitForFunction(expected => Number(document.querySelector('#best').textContent.replaceAll(',', '')) === expected, best);
  await page.locator('#settings').click();
  assert(await page.locator('#mute').isChecked());
  assert(await page.locator('#reduced').isChecked());
  assert.equal(await page.locator('#volume').inputValue(), '35');
  await page.locator('#reduced').uncheck();
  await page.locator('#mute').uncheck();
  await page.locator('#settings-dialog button').click();
  await page.locator('#play').click();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => Number(document.querySelector('#score').textContent.replaceAll(',', '')) > 0);
  await page.screenshot({ path: resolve(output, 'pinball-after-play.png') });
  const desktopFrames = await rafSample(page, 2500);

  const cdp = await desktop.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const throttledFrames = await rafSample(page, 2500);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    return (await cdp.send('Runtime.getHeapUsage')).usedSize;
  };
  const heapSamples = [await heap()];
  const soakSeconds = Number(process.env.PINBALL_SOAK_SECONDS || '45');
  for (let block = 0; block < 3; block++) {
    const until = Date.now() + soakSeconds * 1000 / 3;
    while (Date.now() < until) {
      if (await page.locator('#overlay').isVisible()) await page.locator('#play').click();
      if (await page.locator('#launch').isEnabled()) await page.keyboard.press('Space');
      await page.keyboard.down('ArrowLeft');
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(100);
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(150);
    }
    heapSamples.push(await heap());
  }
  assert(heapSamples.at(-1) - heapSamples[0] < 2_000_000, 'unexpected retained heap growth');
  assert.deepEqual(errors, [], 'pinball page errors');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobile.route(url => url.origin !== new URL(base).origin, route => route.abort());
  const phone = await mobile.newPage();
  const mobileErrors = [];
  phone.on('pageerror', error => mobileErrors.push(error.message));
  if (before) {
    await phone.goto(base + 'pinball-before.html');
    await phone.waitForFunction(() => window.GameKit && document.querySelector('canvas').width === 540);
    await phone.waitForTimeout(350);
    await phone.screenshot({ path: resolve(output, 'pinball-before-mobile.png') });
  }
  await phone.goto(base + 'pinball.html');
  await phone.waitForFunction(() => document.querySelector('#mission-name').textContent !== '');
  assert(await phone.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  const pad = await phone.locator('#left').boundingBox();
  assert(pad.y + pad.height <= 844, 'touch controls should fit in the initial viewport');
  await phone.screenshot({ path: resolve(output, 'pinball-after-mobile.png') });
  await phone.locator('#play').tap();
  await phone.locator('#launch').tap();
  await phone.waitForFunction(() => document.querySelector('#launch').disabled);
  const session = await mobile.newCDPSession(phone);
  const center = async (selector, id) => {
    const box = await phone.locator(selector).boundingBox();
    return { id, x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const points = [await center('#left', 1), await center('#right', 2)];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await phone.waitForFunction(() => [...document.querySelectorAll('#left, #right')].every(button => button.classList.contains('is-held')));
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await phone.waitForFunction(() => [...document.querySelectorAll('#left, #right')].every(button => !button.classList.contains('is-held')));
  const mobileFrames = await rafSample(phone, 2500);
  assert.deepEqual(mobileErrors, [], 'mobile pinball page errors');

  const home = await desktop.newPage();
  await home.goto(base, { waitUntil: 'domcontentloaded' });
  assert(await home.locator('a[href="pinball.html"]').count() >= 1);
  const response = await home.request.get(base + 'pinball.html');
  assert.equal(response.status(), 200);
  console.log(JSON.stringify({ result: 'pass', best, desktopFrames, mobileFrames, throttledFrames, soakSeconds, heapSamples, screenshots: output }, null, 2));
} finally {
  try { await browser?.close(); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
