// Deterministic browser regression: all external APIs are blocked; no live writes.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };
(async () => {
  const server = http.createServer((req,res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'}).end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless:true, ...(process.platform === 'win32' ? {channel:'msedge'} : {}) });
    const context = await browser.newContext({ serviceWorkers:'block' });
    const base = `http://127.0.0.1:${server.address().port}`;
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function cspAttack() {
      await page.evaluate(() => {
        window.__attack = 0;
        const script = document.createElement('script');
        script.textContent = 'window.__attack = 1';
        document.body.append(script);
        const button = document.createElement('button');
        button.setAttribute('onclick', 'window.__attack = 2');
        document.body.append(button); button.click(); button.remove();
      });
      assert.equal(await page.evaluate(() => window.__attack), 0);
    }
    await page.goto(base + '/index.html');
    await page.locator('#pomo-setting-btn').click();
    assert.equal(await page.locator('#pomo-setting-btn').getAttribute('data-home-action'), 'pomoToggleSetting');
    await page.locator('#pomo-btn').click();
    assert.match(await page.locator('#pomo-btn').textContent(), /停止|一時停止|Pause/);
    await page.locator('[data-home-action="pomodoroReset"]').click();
    await cspAttack();
    console.log('PASS home: timer controls and CSP block inline script/events');

    await page.goto(base + '/dashboard.html');
    await page.locator('#todo-input').fill('security test <img src=x onerror=alert(1)>');
    await page.locator('#todo-add-btn').click();
    assert.ok((await page.locator('.todo-text').last().textContent()).includes('<img'));
    assert.equal(await page.locator('#todo-list img').count(), 0);
    await page.locator('input[data-toggle-todo]').last().check();
    await page.locator('[data-action="filter"][data-filter="done"]').click();
    assert.ok(await page.locator('.todo-item.done').count());
    await page.locator('.todo-del').last().click();
    assert.equal(await page.locator('.todo-item').count(), 0);
    await page.locator('#blog-title').fill('Test');
    await page.locator('#blog-body').fill('Test memo');
    await page.locator('#blog-post-btn').click();
    assert.equal(await page.locator('.blog-post').count(), 1);
    // deletePost asks the user before deleting; authorize the test fixture only.
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-action="deletePost"]').click();
    assert.equal(await page.locator('.blog-post').count(), 0);
    await cspAttack();
    console.log('PASS dashboard: add/toggle/filter/delete TODO, add/delete memo, text injection blocked');

    const payload = [{id:'test" onclick="window.__attack=3',title:'Safe title',updated_at:'2026-09-14',content:[
      {type:'stamp',x:0,y:0,size:80,svg:'<svg xmlns="http://www.w3.org/2000/svg" onload="parent.__attack=5"><script>parent.__attack=6</script><circle cx="40" cy="40" r="30" fill="orange"/></svg>'},
    ]}];
    await context.route('**/blogs.json*', route => route.fulfill({json:payload}));
    await page.goto(base + '/blog.html');
    await page.locator('#filter-all').click();
    assert.equal(await page.locator('.blog-card[onclick]').count(), 0);
    assert.equal(await page.locator('.blog-card').count(), 1);
    await page.locator('.blog-card').click();
    await page.locator('.pe-stamp img').waitFor();
    assert.equal(await page.locator('.pe-stamp svg, .pe-stamp script').count(), 0);
    await cspAttack();
    console.log('PASS blog: encoded IDs, inert SVG stamps, legitimate navigation');

    await page.goto(base + '/cloudflare-worker/admin.html');
    await page.evaluate(() => localStorage.setItem('agentAdminToken','legacy-test-token'));
    await page.reload();
    assert.equal(await page.evaluate(() => localStorage.getItem('agentAdminToken')), null);
    await cspAttack();
    console.log('PASS admin: legacy token removed and CSP active');
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log('PASS no browser runtime errors');
  } finally { if (browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
