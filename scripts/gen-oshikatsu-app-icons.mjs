#!/usr/bin/env node
/*
 * gen-oshikatsu-app-icons.mjs — 推し活ログの Android アプリ用アイコン・ストア画像を作る
 *
 *   node scripts/gen-oshikatsu-app-icons.mjs
 *
 * 出力（PNG。Google Play と Bubblewrap は PNG を要求するため WebP 方針の例外。verify-asset-format.mjs の EXEMPT に登録済み）:
 *   assets/icons/oshikatsu-192.png / -512.png      … ホーム画面・manifest 用（全面）
 *   assets/icons/oshikatsu-maskable-512.png         … Android のアダプティブアイコン用（中央80%に収める）
 *   android/store/icon-512.png                      … Play ストアのアプリアイコン（512×512・32bit）
 *   android/store/feature-graphic-1024x500.png      … Play ストアのフィーチャーグラフィック
 * 絵はすべてコードで描く（外部素材・生成AIを使わない＝権利が単純）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage();
await page.setContent('<canvas id=c></canvas>');

const draw = (w, h, mode) => page.evaluate(({ w, h, mode }) => {
  const c = document.getElementById('c'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#fbcfe8'); g.addColorStop(0.55, '#f9a8d4'); g.addColorStop(1, '#c4b5fd');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // 柔らかい光の玉
  [[0.82, 0.18, 0.28, 'rgba(255,255,255,0.45)'], [0.12, 0.88, 0.32, 'rgba(255,255,255,0.30)']].forEach(([cx, cy, r, col]) => {
    x.fillStyle = col; x.beginPath(); x.arc(cx * w, cy * h, r * Math.min(w, h), 0, Math.PI * 2); x.fill();
  });
  function heartIcon(cx, cy, s) {
    // ハート（ベジェ）
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.shadowColor = 'rgba(190, 24, 93, 0.30)'; x.shadowBlur = 0.08; x.shadowOffsetY = 0.03;
    x.beginPath();
    x.moveTo(0, 0.36);
    x.bezierCurveTo(-0.62, -0.06, -0.48, -0.62, 0, -0.30);
    x.bezierCurveTo(0.48, -0.62, 0.62, -0.06, 0, 0.36);
    x.closePath(); x.fillStyle = '#ffffff'; x.fill();
    x.shadowColor = 'transparent';
    // ハートの中の棒グラフ（記録・集計のしるし）
    const bars = [[-0.17, 0.10], [-0.02, 0.20], [0.13, 0.14]];
    bars.forEach(([bx, bh], i) => { x.fillStyle = ['#f472b6', '#a78bfa', '#ec4899'][i]; const y0 = 0.10; x.beginPath(); x.roundRect(bx - 0.045, y0 - bh, 0.09, bh, 0.03); x.fill(); });
    x.restore();
    // きらめき
    x.fillStyle = '#ffffff';
    const star = (sx, sy, r) => { x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.28 : r; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.closePath(); x.fill(); };
    star(cx + s * 0.42, cy - s * 0.42, s * 0.09); star(cx - s * 0.46, cy - s * 0.30, s * 0.05);
  }
  if (mode === 'feature') {
    heartIcon(h * 0.50, h * 0.53, h * 0.78);
    const tx = h * 0.98, tw = w - tx - 40;
    x.fillStyle = '#4a1d55'; x.font = '800 84px "WenQuanYi Zen Hei", "Noto Sans CJK JP", sans-serif'; x.fillText('推し活ログ', tx, h * 0.46, tw);
    x.fillStyle = '#6b2a6e'; x.font = '700 32px "WenQuanYi Zen Hei", "Noto Sans CJK JP", sans-serif';
    x.fillText('推しの出費・参戦をかわいく記録', tx, h * 0.60, tw);
    x.fillText('→ 1枚の画像でシェア', tx, h * 0.70, tw);
  } else {
    heartIcon(w / 2, h * 0.53, w * (mode === 'maskable' ? 0.62 : 0.86));
  }
  return c.toDataURL('image/png').split(',')[1];
}, { w, h, mode });

const out = [
  ['assets/icons/oshikatsu-192.png', 192, 192, 'any'],
  ['assets/icons/oshikatsu-512.png', 512, 512, 'any'],
  ['assets/icons/oshikatsu-maskable-512.png', 512, 512, 'maskable'],
  ['android/store/icon-512.png', 512, 512, 'any'],
  ['android/store/feature-graphic-1024x500.png', 1024, 500, 'feature'],
];
for (const [rel, w, h, mode] of out) {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, Buffer.from(await draw(w, h, mode), 'base64'));
  console.log(`✓ ${rel} (${w}×${h}, ${(fs.statSync(f).size / 1024).toFixed(0)}KB)`);
}
await browser.close();
