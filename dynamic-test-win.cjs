const { chromium } = require('./node_modules/playwright');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node dynamic-test-win.cjs <path-to-html>'); process.exit(1); }

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

  const resolvedPath = path.resolve(filePath).replace(/\\/g, '/');
  await page.goto('file:///' + resolvedPath);
  await page.waitForTimeout(3000);

  const screenshotDir = path.join(path.dirname(filePath), 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  const timestamp = Date.now();
  const screenshotName = path.basename(filePath, '.html') + '_' + timestamp + '.png';
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

  const forbiddenWords = ['ZELDA QUEST', 'zelda quest', 'octorok', 'moblin', 'rupee'];
  const textChecks = {};
  for (const word of forbiddenWords) {
    const found = await page.evaluate((w) => {
      return document.body.innerText.toLowerCase().includes(w.toLowerCase());
    }, word);
    textChecks[word] = found;
  }

  const expectedWords = ['FAHREN QUEST', 'ファーレンクエスト'];
  const expectedChecks = {};
  for (const word of expectedWords) {
    const found = await page.evaluate((w) => {
      return document.body.innerText.toLowerCase().includes(w.toLowerCase());
    }, word);
    expectedChecks[word] = found;
  }

  const pageTitle = await page.title();

  await browser.close();

  console.log(JSON.stringify({
    jsErrors,
    notFound,
    canvasResult,
    bodyEmpty,
    screenshotPath,
    textChecks,
    expectedChecks,
    pageTitle
  }, null, 2));
})();
