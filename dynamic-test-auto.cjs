const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node dynamic-test.cjs <path-to-html>'); process.exit(1); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const jsErrors = [];
  const notFound = [];

  page.on('console', msg => {
    if (msg.type() === 'error') jsErrors.push(msg.text());
  });
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('response', res => {
    if (res.status() === 404) notFound.push(res.url());
  });

  await page.goto(`file://${path.resolve(filePath)}`);
  await page.waitForTimeout(2000);

  const screenshotDir = path.join(path.dirname(filePath), 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  const timestamp = Date.now();
  const screenshotName = `${path.basename(filePath, '.html')}_${timestamp}.png`;
  const screenshotPath = path.join(screenshotDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const canvasResult = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { hasCanvas: false };
    try {
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100)).data;
      const hasDrawing = Array.from(data).some((v, i) => i % 4 !== 3 && v !== 0);
      return { hasCanvas: true, hasDrawing, width: canvas.width, height: canvas.height };
    } catch (e) {
      return { hasCanvas: true, hasDrawing: null, error: e.message };
    }
  });

  const bodyEmpty = await page.evaluate(() => document.body.innerHTML.trim() === '');

  await browser.close();

  console.log(JSON.stringify({
    jsErrors,
    notFound,
    canvasResult,
    bodyEmpty,
    screenshotPath
  }, null, 2));
})();
