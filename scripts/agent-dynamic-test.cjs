#!/usr/bin/env node
/*
 * agent-dynamic-test.cjs — hideの案内エージェントの動的テスト（Playwright）
 *
 * file:// では fetch(CORS) 等の擬似エラーが出るため、ローカルHTTPサーバー経由で検証する。
 * 外部ドメインへのリクエストはすべて abort し、決定的なテストにする（AIフォールバックは対象外）。
 *
 * シナリオ:
 *   1. ウィジェット開閉（FABクリック→パネルopen→welcome表示）
 *   2. ルールベース応答（「ゲーム一覧が見たい」→ゲームカード表示）
 *   3. タイポ耐性（「しょーぎ」→将棋ゲームカード）
 *   4. スロット追跡（「将棋」→「それの遊び方は？」で文脈解決）
 *   5. プロアクティブ提案（プロファイル/news仕込み→未読提案が出る）
 *   6. pageerror（未捕捉例外）ゼロ
 *
 * 使い方: node scripts/agent-dynamic-test.cjs [--scenarios=1,2,6]
 * 終了コード: 全PASS=0 / FAILあり=1
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8931;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let fp = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

const results = [];
function report(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function openAgent(page) {
  await page.waitForSelector('#agent-fab', { state: 'visible', timeout: 15000 });
  await page.click('#agent-fab');
  await page.waitForSelector('#agent-panel.open', { timeout: 5000 });
}

async function askAgent(page, text) {
  await page.fill('#agent-input', text);
  await page.press('#agent-input', 'Enter');
  // typing演出が終わってメッセージが安定するまで待つ
  await page.waitForTimeout(2500);
}

function lastBotText(page) {
  return page.evaluate(() => {
    const msgs = document.querySelectorAll('#agent-messages .agent-msg.bot .agent-bubble');
    const last = msgs[msgs.length - 1];
    return last ? last.textContent : '';
  });
}

async function newPage(browser, pageErrors, init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // 外部リクエストは全abort（決定的テスト・AIプロキシ/外部APIに依存しない）
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}

(async () => {
  const only = (process.argv.find(a => a.startsWith('--scenarios=')) || '').replace('--scenarios=', '');
  const want = only ? only.split(',').map(Number) : [1, 2, 3, 4, 5, 6];
  const srv = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const pageErrors = [];

  try {
    // ── シナリオ1+2+6: 開閉・welcome・ルールベース応答 ──
    if (want.includes(1) || want.includes(2)) {
      const { ctx, page } = await newPage(browser, pageErrors);
      await openAgent(page);
      await page.waitForTimeout(1500);
      const welcome = await page.evaluate(() => document.getElementById('agent-messages').textContent || '');
      report('1. ウィジェット開閉・welcome表示', welcome.length > 10, welcome.slice(0, 40).replace(/\n/g, ' '));

      if (want.includes(2)) {
        await askAgent(page, 'ゲーム一覧が見たい');
        const cards = await page.evaluate(() => document.querySelectorAll('#agent-messages .game-card-mini').length);
        report('2. ゲーム一覧→カード表示', cards > 0, `cards=${cards}`);
      }
      await ctx.close();
    }

    // ── シナリオ3: タイポ耐性 ──
    if (want.includes(3)) {
      const { ctx, page } = await newPage(browser, pageErrors);
      await openAgent(page);
      await askAgent(page, 'しょーぎで遊びたい');
      const hit = await page.evaluate(() => (document.getElementById('agent-messages').textContent || '').includes('将棋'));
      report('3. タイポ耐性（しょーぎ→将棋）', hit);
      await ctx.close();
    }

    // ── シナリオ4: スロット追跡 ──
    if (want.includes(4)) {
      const { ctx, page } = await newPage(browser, pageErrors);
      await openAgent(page);
      await askAgent(page, '将棋');
      await askAgent(page, 'それの遊び方は？');
      const txt = await page.evaluate(() => document.getElementById('agent-messages').textContent || '');
      const hit = /将棋|遊び方|shogi/i.test(txt.slice(-400)) && !txt.slice(-200).includes('うまく聞き取れません');
      report('4. スロット追跡（それ→将棋）', hit, txt.slice(-80).replace(/\n/g, ' '));
      await ctx.close();
    }

    // ── シナリオ5: プロアクティブ提案 ──
    if (want.includes(5)) {
      const { ctx, page } = await newPage(browser, pageErrors, () => {
        // 再訪ユーザー＋前回プレイあり を仕込む
        localStorage.setItem('hide-agent-profile-v1', JSON.stringify({ v: 1, visits: 3, playedGames: { shogi: { count: 2, last: Date.now() - 86400000 } }, seenGameSlugs: ['shogi'], readNewsIds: [] }));
      });
      await openAgent(page);
      await page.waitForTimeout(2500);
      const proactive = await page.evaluate(() => document.querySelectorAll('#agent-messages .agent-proactive').length);
      report('5. プロアクティブ提案表示', proactive > 0, `proactive=${proactive}`);
      await ctx.close();
    }

    // ── シナリオ6: pageerrorゼロ ──
    if (want.includes(6)) {
      report('6. 未捕捉例外ゼロ', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    }
  } finally {
    await browser.close();
    srv.close();
  }

  const fails = results.filter(r => !r.pass);
  console.log('');
  console.log(fails.length === 0 ? '==> agent-dynamic-test: 全PASS ✅' : `==> agent-dynamic-test: FAIL ${fails.length}件 ❌`);
  process.exit(fails.length === 0 ? 0 : 1);
})().catch((e) => { console.error('実行エラー:', e); process.exit(1); });
