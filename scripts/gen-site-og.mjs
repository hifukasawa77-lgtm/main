#!/usr/bin/env node
// サイト共通のOGP画像（SNSで共有したときのカード画像）を生成する。
//   node scripts/gen-site-og.mjs   → assets/og/og-default.jpg（1200×630・JPEG）
//
// 専用のOG画像を持たないページは全てこの画像を使う。
// ・JPEGで書き出す: SNS/チャットのクローラはWebP対応がまちまちで、カードが無表示になる
// ・日本語フォントを明示する: 旧 assets/og-image.webp はフォント無しの環境で焼かれ、
//   日本語が全て「□」（豆腐）になったまま公開されていた。例外もエラーも出ないので、
//   書き出した後に必ず画像を目で見ること
// ・本数は「40本以上」と丸める: 実数を焼くとゲームを足すたびに古くなる（旧画像は「15本以上」のままだった）
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/og/og-default.jpg');

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1200px;height:630px}
  body{font-family:"IPAPGothic","IPAGothic","Noto Sans CJK JP","Hiragino Sans",sans-serif;
    background:radial-gradient(circle at 20% 15%,rgba(34,211,238,.16),transparent 45%),
               radial-gradient(circle at 85% 90%,rgba(168,85,247,.18),transparent 45%),#0b0d12;
    color:#f1f5f9;display:flex;align-items:center;justify-content:center}
  .card{width:1060px;height:490px;border-radius:28px;border:1px solid rgba(148,163,184,.25);
    background:rgba(255,255,255,.04);box-sizing:border-box;padding:56px 64px;display:flex;flex-direction:column;justify-content:center}
  .brand{font-size:104px;font-weight:700;letter-spacing:.02em;line-height:1.1}
  .brand span{background:linear-gradient(90deg,#22d3ee,#a855f7);-webkit-background-clip:text;color:transparent}
  .lead{margin-top:22px;font-size:40px;color:#cbd5e1}
  .chips{margin-top:34px;display:flex;gap:16px}
  .chip{font-size:26px;padding:10px 22px;border-radius:999px;border:1px solid rgba(148,163,184,.35);color:#e2e8f0}
  .url{margin-top:auto;font-size:24px;color:#94a3b8;letter-spacing:.02em}
</style></head><body><div class="card">
  <div class="brand">hide<span>の部屋</span></div>
  <div class="lead">無料ブラウザゲーム40本以上・AI自作ツール集</div>
  <div class="chips"><div class="chip">インストール不要</div><div class="chip">Claude AIと共同開発</div><div class="chip">埼玉県三郷市</div></div>
  <div class="url">hifukasawa77-lgtm.github.io/main/</div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log(`✅ ${path.relative(ROOT, OUT)} を生成（1200×630）。日本語が「□」になっていないか画像を目で確認すること`);
} finally {
  await browser.close();
}
