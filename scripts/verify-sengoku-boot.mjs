#!/usr/bin/env node
/*
 * verify-sengoku-boot.mjs — 戦国風雲記が「起動して遊べる状態か」を機械検査する
 *
 * 背景: 描画ループ(draw)の中で例外が出ると、その手前まで描かれた背景画像だけが残り、
 * UIが一切出ない「起動しない」状態になる。しかもタイトル画面は無事に出るため、
 * そこまでしか見ない検査では素通りする（2026-08-02 の _drawRoads の
 * `preview is not defined` は、この盲点で3コミット分の誤診を招いた）。
 * そこで実際に MapScene まで入り、フレームを回し、主要操作を叩いて例外0件を確認する。
 * 例外は GameKit 側が捕捉してループを継続するので pageerror としては飛ばない。
 * 必ず engine.errors（捕捉済みの件数）も合算して判定すること。
 *
 * 検査:
 *   1. タイトル画面へ到達する
 *   2. マップ画面へ入って数秒フレームを回す（史実街道・城・施設レイヤーの描画）
 *   3. 街道編集の描画中プレビュー経路を通す
 *   4. ターン終了を1回通す
 *   5. 上記すべてで例外が0件（ページ全体の未捕捉例外＋GameKitがフレーム内で捕捉した例外）
 *   6. ctx.roundRect が無い環境（旧Edge/WebView）でも同じく0件（gamekit.jsの互換実装）
 *
 * 使い方: node scripts/verify-sengoku-boot.mjs
 * 終了コード: 全PASS=0 / FAILあり=1
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

function serve(root) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function run({ port, noRoundRect }) {
  const label = noRoundRect ? 'roundRectなし(旧Edge/WebView相当)' : '通常';
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push((e.stack || String(e)).split('\n').slice(0, 3).join(' | ')));
  if (noRoundRect) {
    await page.addInitScript(() => { delete CanvasRenderingContext2D.prototype.roundRect; });
  }

  // GameKit はフレーム内の例外を捕捉してループを継続するため pageerror が飛ばない。
  // engine.errors（捕捉済み）も必ず合算しないと、描画が壊れていても検査が素通りする。
  const frameErrors = async () => page.evaluate(() =>
    (typeof game !== 'undefined' && game.errors)
      ? game.errors.map(r => ({ key: r.key, count: r.count }))
      : []).catch(() => []);
  const total = async () => {
    const fe = await frameErrors();
    return errors.length + fe.reduce((a, r) => a + r.count, 0);
  };

  const steps = [];
  const step = (name, before, now) => steps.push({ name, count: now - before });

  await page.goto(`http://127.0.0.1:${port}/sengoku.html`, { waitUntil: 'domcontentloaded' });
  let n = 0;
  await page.waitForFunction(
    () => typeof game !== 'undefined' && game.scene && game.scene.constructor.name === 'TitleScene',
    null, { timeout: 180000 });
  await page.waitForTimeout(600);
  step('1. タイトル画面へ到達', n, await total());

  n = await total();
  const entered = await page.evaluate(() => {
    const scn = DATA.scenarios[0];
    const d = (scn.daimyo || []).find(x => x.id === 'oda') || scn.daimyo[0];
    game.changeScene(new MapScene(buildGameState(scn.id, d.id, 'normal')));
    return game.scene.constructor.name;
  });
  await page.waitForTimeout(4000); // 遅延アセットが届く間もフレームを回す
  step(`2. マップ画面で描画（scene=${entered}）`, n, await total());

  // 街道編集: 描画中プレビュー（roadDraw）を持つ経路をフレームに通す
  n = await total();
  await page.evaluate(() => {
    const s = game.scene;
    s._startRoadEdit(game);
    s.roadDraw = { path: [[0.30, 0.44], [0.34, 0.46], [0.38, 0.45], [0.42, 0.48]] };
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { game.scene._finishRoadEdit(game); });
  await page.waitForTimeout(400);
  step('3. 街道編集の描画中プレビュー', n, await total());

  n = await total();
  await page.evaluate(() => { game.scene._endTurn(game); });
  await page.waitForTimeout(2500);
  step('4. ターン終了を1回', n, await total());

  const scene = await page.evaluate(() => game.scene.constructor.name);
  const framed = await frameErrors();
  await browser.close();
  const detail = errors.concat(framed.map(r => `${r.key}（${r.count}回）`));
  return { label, steps, errors: detail, scene };
}

async function main() {
  const { server, port } = await serve(ROOT);
  const results = [];
  for (const noRoundRect of [false, true]) {
    results.push(await run({ port, noRoundRect }));
  }
  server.close();

  let failed = 0;
  for (const r of results) {
    console.log(`\n=== ${r.label} ===`);
    r.steps.forEach(s => console.log(`  ${s.count === 0 ? '[PASS]' : '[FAIL]'} ${s.name}${s.count ? `  例外${s.count}件` : ''}`));
    console.log(`  最終シーン: ${r.scene}`);
    if (r.errors.length) {
      failed += r.errors.length;
      console.log(`  --- 例外 ${r.errors.length}件 ---`);
      [...new Set(r.errors)].slice(0, 8).forEach(e => console.log('   ✗ ' + e));
    }
  }
  console.log(failed ? `\n[FAIL] 未捕捉例外 合計${failed}件` : '\n[PASS] 全手順で未捕捉例外 0件');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
