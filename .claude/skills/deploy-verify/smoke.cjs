// smoke.cjs — 本番URLをヘッドレスChromiumで開き、pageerror/console.errorを収集する
// 使い方: node .claude/skills/deploy-verify/smoke.cjs <URL>
const { chromium } = require('playwright');

const url = process.argv[2];
if (!url) { console.error('Usage: node smoke.cjs <URL>'); process.exit(2); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  try {
    const res = await page.goto(url, { timeout: 30000, waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const status = res ? res.status() : 0;
    await browser.close();
    if (status !== 200) { console.log(`NG status=${status}`); process.exit(1); }
    if (errors.length) { console.log(`NG errors: ${errors.slice(0, 3).join(' | ').slice(0, 200)}`); process.exit(1); }
    console.log('OK');
  } catch (e) {
    await browser.close();
    console.log(`NG ${e.message.slice(0, 150)}`);
    process.exit(1);
  }
})();
