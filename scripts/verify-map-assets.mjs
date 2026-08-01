#!/usr/bin/env node
/*
 * verify-map-assets.mjs — マップ上のアイコンが「実際に絵として描かれるか」を機械検査する
 *
 * 背景: 2026-08-02、マップ用アセットを webp へ軽量化した際に画像を 1254px → 256px へ
 * 縮小した。ところが海賊・馬牧・国人マーカーとリソースアトラスは、生成時の白い余白を
 * 除くために drawImage の *元画像ピクセル座標* で切り出していた（例 [80,80,1094,1094]）。
 * 縮小後はこの矩形が画像の外へ出るため、Canvas 側で切り詰められてアイコンがほぼ／完全に
 * 消えた。南蛮寺セルに至っては塗り面積 0%。読み込みは成功しているので 404 もエラーも出ず、
 * 「アセットは正常」に見えてしまう。
 *
 * 教訓: アセットのパスが引けること・画像が load されることは「絵が出ること」を意味しない。
 * 切り出し矩形を持つ描画は、必ず塗られた面積まで見ないと壊れても気づけない。
 *
 * 検査:
 *   1. GPT_ASSETS の全URLが 200 で引けるか（404・パス誤り）
 *   2. 切り出し矩形を持つマーカーが、実画像の範囲内に収まっているか
 *   3. 各マップアイコンを実際の描画関数で描き、塗り面積が閾値以上あるか
 *
 * 使い方: node scripts/verify-map-assets.mjs
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
// 描画ボックスに対しこの割合（%）未満しか塗られていなければ「アイコンが出ていない」とみなす。
// 正常なアイコンは余白込みでも 25%以上 塗る。一方 2026-08-02 の縮小事故では
// 海賊/馬牧マーカー 2.4%・国人 3.5%・アトラスの港セル 11.3%・南蛮寺セル 0% まで落ちた。
// 15% はその両者を確実に分ける位置。
const MIN_PAINTED_PCT = 15;
// フォールバック（施設画像が未着の間に出る単体マーカー／アトラス／ベクター図形）の下限。
// ベクター線画は塗り面積が小さいので緩めるが、事故時は 0〜3% まで落ちるのでそこは確実に捕まえる。
const MIN_FALLBACK_PCT = 5;

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

async function main() {
  const { server, port } = await serve(ROOT);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const fails = [];
  const notes = [];

  await page.goto(`http://127.0.0.1:${port}/sengoku.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof game !== 'undefined' && game.scene && game.scene.constructor.name === 'TitleScene',
    null, { timeout: 180000 });

  // --- 1. 全アセットURLの疎通 ---
  const missing = await page.evaluate(async () => {
    const bad = [];
    for (const [key, url] of Object.entries(GPT_ASSETS)) {
      try {
        const r = await fetch(url, { method: 'GET' });
        if (!r.ok) bad.push(`${key}: HTTP ${r.status} ${url}`);
      } catch (e) { bad.push(`${key}: ${e.message} ${url}`); }
    }
    return bad;
  });
  missing.forEach(m => fails.push(`[アセット404] ${m}`));
  notes.push(`1. アセット疎通: ${Object.keys(await page.evaluate(() => GPT_ASSETS)).length}件中 NG ${missing.length}件`);

  // --- マップ用アセットが ASSETS.img へ入るのを待つ（BootScene が優先読みする分） ---
  const mapKeys = await page.evaluate(() => Object.keys(GPT_ASSETS).filter(
    k => ['resourceMarkerAtlas', 'pirateMarker', 'kunijinMarker', 'horsefarmMarker'].includes(k)
      || /^(mapSite|mapCastle|facility|mapCheckpoint)/.test(k)));
  await page.waitForFunction(
    keys => keys.every(k => ASSETS.img[k] && (ASSETS.img[k].naturalWidth || ASSETS.img[k].width)),
    mapKeys, { timeout: 180000 }).catch(() => {});
  const notLoaded = await page.evaluate(
    keys => keys.filter(k => !(ASSETS.img[k] && (ASSETS.img[k].naturalWidth || ASSETS.img[k].width))), mapKeys);
  notLoaded.forEach(k => fails.push(`[未ロード] マップ用アセット ${k} が ASSETS.img に入っていない`));

  // --- 2. 切り出し矩形が実画像の範囲に収まっているか ---
  const cropIssues = await page.evaluate(() => {
    const out = [];
    const check = (label, img, rect, ref) => {
      if (!img) return out.push(`${label}: 画像が未ロード`);
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const s = (typeof scaleSrcRect === 'function') ? scaleSrcRect(img, rect, ref) : rect;
      if (s[0] < -0.5 || s[1] < -0.5 || s[0] + s[2] > iw + 0.5 || s[1] + s[3] > ih + 0.5) {
        out.push(`${label}: 切り出し [${s.map(v => Math.round(v))}] が画像 ${iw}x${ih} をはみ出す`);
      }
    };
    for (const [kind, spec] of Object.entries(RESOURCE_MARKER_SINGLE_ASSETS)) {
      check(`マーカー ${kind}`, ASSETS.img[spec[0]], spec[1], spec[2]);
    }
    for (const [cell, rect] of Object.entries(RESOURCE_MARKER_ATLAS_CELLS)) {
      check(`アトラス ${cell}`, ASSETS.img.resourceMarkerAtlas, rect, RESOURCE_MARKER_ATLAS_REF);
    }
    return out;
  });
  cropIssues.forEach(m => fails.push(`[切り出し範囲外] ${m}`));
  notes.push(`2. 切り出し矩形: NG ${cropIssues.length}件`);

  // --- 3. 実際の描画関数でアイコンを描き、塗り面積を測る ---
  // 塗り面積は「その関数が使う描画ボックス」に対する比率で見る。キャンバス全体に対して測ると
  // ボックスがキャンバスより小さいぶん一律に低く出て、閾値が意味を持たなくなる。
  const painted = await page.evaluate(() => {
    const D = 128;
    const cv = document.createElement('canvas'); cv.width = D; cv.height = D;
    const g = cv.getContext('2d');
    // 描画ボックスがちょうど D になる size を渡す（マーカー: size*1.8 / 城: size*2.05）
    const measure = (fn) => {
      g.clearRect(0, 0, D, D);
      let drawn = true;
      try { drawn = fn(g) !== false; } catch (e) { return { pct: 0, err: e.message }; }
      const d = g.getImageData(0, 0, D, D).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
      return { pct: +(n / (D * D) * 100).toFixed(1), drawn };
    };
    const rows = [];
    // マップ施設アイコン（resource marker / site image / facility graphic の全経路）
    const kinds = new Set([
      ...Object.keys(RESOURCE_MARKER_ATLAS_KIND),
      ...Object.keys(RESOURCE_MARKER_SINGLE_ASSETS),
      ...Object.keys(MAP_SITE_MARKER_ASSET_KEYS)
    ]);
    for (const kind of kinds) {
      rows.push({ group: 'マーカー', name: kind, ...measure(ctx => drawResourceIcon(ctx, kind, D / 2, D / 2, D / 1.8)) });
    }
    // 城グラフィック
    for (const [type, key] of Object.entries(MAP_CASTLE_ASSET_BY_TYPE).concat([['(既定)', 'mapSiteCastle'], ['小田原', 'mapCastleOdawara']])) {
      rows.push({ group: '城', name: `${type}/${key}`, ...measure(ctx => drawMapCastleImage(ctx, key, D / 2, D / 2, D / 2.05)) });
    }
    // 施設グラフィックが未着の間に使われる「フォールバック経路」（単体マーカー＋アトラス）。
    // 実際の不具合はここに出た: 施設画像が届くまでの数十秒〜数分、白い箱や空白が表示される。
    // primary が生きているとこの経路は一度も通らないため、明示的に画像を外して測る必要がある。
    const stash = {};
    for (const k of Object.keys(ASSETS.img)) {
      if (/^(mapSite|mapCastle|facility)/.test(k)) { stash[k] = ASSETS.img[k]; delete ASSETS.img[k]; }
    }
    for (const kind of kinds) {
      rows.push({ group: 'フォールバック', name: kind, ...measure(ctx => drawResourceIcon(ctx, kind, D / 2, D / 2, D / 1.8)) });
    }
    Object.assign(ASSETS.img, stash);
    return rows;
  });
  // ベクターの手描きアイコンは線画のため塗り面積が小さい。フォールバックは「何かが描かれたか」を見る。
  const weak = painted.filter(r => r.pct < (r.group === 'フォールバック' ? MIN_FALLBACK_PCT : MIN_PAINTED_PCT));
  weak.forEach(r => fails.push(`[描画されない] ${r.group} ${r.name}: 塗り面積 ${r.pct}%${r.err ? ' / 例外 ' + r.err : ''}`));
  notes.push(`3. アイコン描画: ${painted.length}件中 塗り面積${MIN_PAINTED_PCT}%未満 ${weak.length}件`);

  await browser.close();
  server.close();

  console.log('=== 戦国風雲記 マップアセット検査 ===');
  notes.forEach(n => console.log('  ' + n));
  if (fails.length) {
    console.log(`\n--- 不合格 ${fails.length}件 ---`);
    fails.slice(0, 40).forEach(f => console.log('  ✗ ' + f));
    console.log(`\n[FAIL] ${fails.length}件`);
    process.exit(1);
  }
  console.log('\n[PASS] マップアセットは全て実際に描画される');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
