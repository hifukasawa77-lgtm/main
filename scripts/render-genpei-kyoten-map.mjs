#!/usr/bin/env node
/*
 * render-genpei-kyoten-map.mjs — 拠点147を地図に重ねた確認用画像を書き出す
 *
 * 機械検査（verify-genpei-kyoten.mjs）は「陸に載っているか」までしか見ない。
 * 「相模国衙が相模にあるか」は人が見ないと分からないので、目視用の画像を作る。
 *
 * 使い方: node scripts/render-genpei-kyoten-map.mjs [出力先.png]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP = 'assets/sengoku/gpt/sengoku-japan-map-user-v1.webp';
const MAP_W = 1672, MAP_H = 941;
const OUT = process.argv[2] || path.join(ROOT, 'genpei-kyoten-map.png');

const COLOR = {
  kokufu: '#f9d423', tachi: '#ff6b6b', kisaku: '#ff9f43', toride: '#e17055', shoen: '#7ed957',
  tera: '#c792ea', jinja: '#f78fb3', sekisho: '#b0bec5', machi: '#ffd479', mura: '#a5d6a7',
  minato: '#4dd0e1',
};

const lines = fs.readFileSync(path.join(ROOT, 'kyoten_ichi.csv'), 'utf8')
  .replace(/^﻿/, '').trim().split(/\r?\n/);
const head = lines[0].split(',');
const col = n => head.indexOf(n);
const pts = lines.slice(1).map(l => l.split(',')).map(c => ({
  name: c[col('拠点名')], type: c[col('種別')],
  x: Number(c[col('MX')]) * MAP_W, y: Number(c[col('MY')]) * MAP_H,
}));

const dataUri = 'data:image/webp;base64,' + fs.readFileSync(path.join(ROOT, MAP)).toString('base64');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});
const page = await browser.newPage({ viewport: { width: MAP_W, height: MAP_H } });
await page.goto('about:blank');
const png = await page.evaluate(async ({ src, w, h, pts, color }) => {
  const img = new Image(); img.src = src; await img.decode();
  const cnv = document.createElement('canvas');
  cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = color[p.type] || '#fff';
    ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(p.name, p.x, p.y - 7);
    ctx.fillStyle = '#fff';
    ctx.fillText(p.name, p.x, p.y - 7);
  }
  // 凡例
  const legend = [['国府', color.kokufu], ['館', color.tachi], ['城柵', color.kisaku], ['砦', color.toride],
                  ['荘園', color.shoen], ['寺', color.tera], ['神社', color.jinja], ['関所', color.sekisho],
                  ['町', color.machi], ['村', color.mura], ['湊', color.minato]];
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(12, 12, 130, 22 * legend.length + 12);
  legend.forEach(([label, c], i) => {
    const y = 30 + i * 22;
    ctx.beginPath(); ctx.arc(28, y, 5, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(label, 42, y + 5);
  });
  return cnv.toDataURL('image/png').split(',')[1];
}, { src: dataUri, w: MAP_W, h: MAP_H, pts, color: COLOR });
await browser.close();

fs.writeFileSync(OUT, Buffer.from(png, 'base64'));
console.log(`✓ ${path.relative(ROOT, OUT)} — ${pts.length}拠点を描画`);
