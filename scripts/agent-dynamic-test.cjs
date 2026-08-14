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
 *   7. 話題ガード（「おすすめのカツ丼」→ゲーム推薦を返さない／「おすすめは？」は今まで通り返す）
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
  const want = only ? only.split(',').map(Number) : [1, 2, 3, 4, 5, 6, 7];
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

    // ── シナリオ7: 話題ガード（off-topic をゲーム推薦にしない） ──
    // 「検出できることを確認していない検査は有害」— 弾くべき例と弾いてはいけない例の両方を見る
    if (want.includes(7)) {
      const { ctx, page } = await newPage(browser, pageErrors, () => { window.__AGENT_TEST = true; });
      await openAgent(page);

      const CASES = [
        // サイト範囲外 → ルールベース応答を見送りAIへ回す
        { q: 'おすすめのカツ丼ありますか？',   off: true },
        { q: 'おすすめのラーメン屋は',         off: true },
        { q: 'おすすめの映画教えて',           off: true },
        { q: 'おすすめの投資信託は',           off: true },
        { q: '近くのおすすめ居酒屋',           off: true },
        { q: 'サッカーのルール教えて',         off: true },
        { q: 'おすすめの旅行先を教えて',       off: true },
        { q: 'recommend a good ramen shop',    off: true, lang: 'en' },
        { q: 'how to play the guitar',         off: true, lang: 'en' },
        // サイト内の話題 → 従来どおりルールベースで答える（過剰ブロックの検出）
        { q: 'おすすめは？',                   off: false },
        { q: 'おすすめを教えて',               off: false },
        { q: 'おすすめのゲームは？',           off: false },
        { q: 'おすすめのアクションゲームは？', off: false },
        { q: '初心者におすすめのゲーム',       off: false },
        { q: 'おすすめの暇つぶしは',           off: false },
        { q: '一番人気のゲームは？',           off: false },
        { q: '面白いゲーム教えて',             off: false },
        { q: '新作ゲームある？',               off: false },
        { q: '将棋の遊び方は？',               off: false },
        { q: '操作方法を教えて',               off: false },
        { q: '無料で遊べますか',               off: false },
        { q: 'もっと見たい',                   off: false },
        { q: 'recommend a game',               off: false, lang: 'en' },
        { q: 'any good games?',                off: false, lang: 'en' },
        { q: 'how to play shogi',              off: false, lang: 'en' },
        { q: 'are they free?',                 off: false, lang: 'en' },
      ];
      const judged = await page.evaluate((cases) => {
        const d = window.AGENT_DEBUG;
        if (!d || typeof d.isOffTopic !== 'function') return null;
        return cases.map(c => ({ q: c.q, off: c.off, got: d.isOffTopic(d.detectIntent(c.q, c.lang || 'ja').name, c.q) }));
      }, CASES);
      if (!judged) {
        report(`7a. 話題ガード判定（${CASES.length}ケース）`, false, 'AGENT_DEBUG ブリッジが開いていない');
      } else {
        const bad = judged.filter(r => r.got !== r.off);
        report(`7a. 話題ガード判定（${CASES.length}ケース）`, bad.length === 0,
          bad.length ? bad.map(b => `${b.q}: 期待${b.off}→実際${b.got}`).join(' / ') : `${judged.length}件一致`);
      }

      // 実挙動: off-topic ではゲームカード（推薦3本）を出さない
      const before = await page.evaluate(() => document.querySelectorAll('#agent-messages .game-card-mini').length);
      await askAgent(page, 'おすすめのカツ丼ありますか？');
      const afterOff = await page.evaluate(() => document.querySelectorAll('#agent-messages .game-card-mini').length);
      // 全文で見る（最後の吹き出しだけ見ると空文字でも素通りする＝検出できない検査になる）
      const offText = await page.evaluate(() => document.getElementById('agent-messages').innerText || '');
      report('7b. off-topic でゲーム推薦を返さない', afterOff === before && !/おすすめはこの\d+本/.test(offText),
        `cards ${before}→${afterOff}`);

      // 反対側: サイト内の「おすすめは？」は従来どおりカードが出る（過剰ブロックの検出）
      await askAgent(page, 'おすすめは？');
      const afterOn = await page.evaluate(() => document.querySelectorAll('#agent-messages .game-card-mini').length);
      report('7c. サイト内の「おすすめは？」は従来どおり推薦', afterOn > afterOff, `cards ${afterOff}→${afterOn}`);
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
