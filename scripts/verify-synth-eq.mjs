#!/usr/bin/env node
/*
 * verify-synth-eq.mjs — synth-eq.html（グラフィックEQ＆シンセ）の必須チェック
 *
 * 「タイトルが出た＝動いている」ではない。Web Audio は例外を出さずに無音になる壊れ方
 * （ノードの未接続・エンベロープの時刻ミス）をするので、アナライザのピーク値まで見る。
 *
 * 使い方: node scripts/verify-synth-eq.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // ブラウザが勝手に取りに行く favicon は 204 で黙らせる（本物の404だけ拾いたい）
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.join(ROOT, url === '/' ? 'synth-eq.html' : url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok  = (name, extra='') => { pass++; console.log(`  ✅ ${name}${extra ? '  ' + extra : ''}`); };
const ng  = (name, extra='') => { fail++; console.log(`  ❌ ${name}${extra ? '  ' + extra : ''}`); };
const check = (name, cond, extra='') => (cond ? ok(name, extra) : ng(name, extra));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  // ★ ヘッドレスでも Web Audio は動くが、自動再生ポリシーで AudioContext が suspended
  //   のままになると「例外は無いのに全部無音」になる。明示的に解除する
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
const missing = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });

await page.addInitScript(() => { window.__SYNTHEQ_TEST = true; try { localStorage.clear(); } catch(e){} });
await page.goto(`${BASE}/synth-eq.html`, { waitUntil: 'load' });
await page.waitForTimeout(400);

console.log('\n── 1. 起動 ─────────────────────────────');
check('例外0件', errors.length === 0, errors.slice(0, 3).join(' | '));
check('404アセット0件', missing.length === 0, missing.slice(0, 3).join(' | '));
check('デバッグブリッジが開いている', await page.evaluate(() => !!window.SYNTHEQ_DEBUG));

console.log('\n── 2. UIの組み立て ─────────────────────');
const faderCount = await page.locator('.ftrack').count();
check('EQフェーダー10本', faderCount === 10, `count=${faderCount}`);
const whiteKeys = await page.locator('.wkey').count();
const blackKeys = await page.locator('.bkey').count();
check('鍵盤 2オクターブ（白15・黒10）', whiteKeys === 15 && blackKeys === 10, `white=${whiteKeys} black=${blackKeys}`);
const eqChips = await page.locator('#eqPresets .chip').count();
const synthChips = await page.locator('#synthPresets .chip').count();
check('EQプリセットが並ぶ', eqChips >= 8, `count=${eqChips}`);
check('シンセプリセットが並ぶ', synthChips >= 6, `count=${synthChips}`);
const aria = await page.locator('.ftrack').first().getAttribute('role');
check('フェーダーが role=slider（キーボード操作可）', aria === 'slider');

console.log('\n── 3. AudioContext とグラフ ────────────');
await page.locator('#btnDemo').click();          // ユーザー操作 → AudioContext 起動 + デモ開始
await page.waitForTimeout(300);
const state = await page.evaluate(() => window.SYNTHEQ_DEBUG.state());
check('AudioContext が running', state === 'running', `state=${state}`);
const nFilters = await page.evaluate(() => window.SYNTHEQ_DEBUG.filterGains().length);
check('EQバンドが10本つながっている', nFilters === 10, `count=${nFilters}`);

console.log('\n── 4. 実際に音が出ているか ─────────────');
await page.waitForTimeout(1200);
const demoPeak = await page.evaluate(() => window.SYNTHEQ_DEBUG.peak());
const demoVoices = await page.evaluate(() => window.SYNTHEQ_DEBUG.voiceCount());
check('デモ演奏で声部が生成される', demoVoices > 0, `voices=${demoVoices}`);
check('デモ演奏でアナライザに信号が出る', demoPeak > 0, `peak=${demoPeak}`);
await page.evaluate(() => window.SYNTHEQ_DEBUG.setDemo(false));
await page.waitForTimeout(400);

const notePeak = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG;
  D.noteOn(60, 1.0);
  await new Promise(r => setTimeout(r, 600));
  const p = D.peak();
  D.noteOff(60);
  return p;
});
check('鍵盤の単音でアナライザに信号が出る', notePeak > 0, `peak=${notePeak}`);
await page.evaluate(() => window.SYNTHEQ_DEBUG.allNotesOff());
// リバーブのインパルス応答が 2.4 秒あるので、余韻が切れるまで待つ（600ms では鳴り続けている）
await page.waitForTimeout(3800);
const silence = await page.evaluate(() => window.SYNTHEQ_DEBUG.peak());
check('全音停止で無音に戻る', silence < 30, `peak=${silence}`);

console.log('\n── 5. EQが実際に効いているか ───────────');
// バンドを動かすと BiquadFilter の gain とカーブの両方が追随する
await page.evaluate(() => window.SYNTHEQ_DEBUG.setAllBands([12,0,0,0,0,0,0,0,0,-12]));
// gain は setTargetAtTime で滑らかに寄せるため、直後に .value を読むとまだ 0。
// 時定数 0.02s に対し 250ms＝10τ 待てば 99.99% 到達する
await page.waitForTimeout(250);
const fg = await page.evaluate(() => window.SYNTHEQ_DEBUG.filterGains());
check('フェーダー値がフィルターへ届く', Math.abs(fg[0] - 12) < 0.05 && Math.abs(fg[9] + 12) < 0.05, `[0]=${fg[0].toFixed(2)} [9]=${fg[9].toFixed(2)}`);

// カーブは対数軸。両端（20Hz / 20kHz）はシェルビングの平坦部なので設定値どおりに出る
const curve = await page.evaluate(() => window.SYNTHEQ_DEBUG.curve(600));
const lowDb = curve[0];
const highDb = curve[curve.length - 1];
check('低域ブーストがカーブに現れる', lowDb > 8, `${lowDb.toFixed(1)} dB @20Hz`);
check('高域カットがカーブに現れる', highDb < -8, `${highDb.toFixed(1)} dB @20kHz`);

const makeup = await page.evaluate(() => window.SYNTHEQ_DEBUG.makeupGain());
check('自動レベル補正がブースト分を戻す', makeup < 0.95, `makeup=${makeup.toFixed(3)}`);

await page.evaluate(() => window.SYNTHEQ_DEBUG.setBypass(true));
await page.waitForTimeout(120);
const flatCurve = await page.evaluate(() => window.SYNTHEQ_DEBUG.curve(600));
const flatMax = Math.max(...flatCurve.map(Math.abs));
check('バイパスでカーブが平坦になる', flatMax < 0.01, `max|dB|=${flatMax.toFixed(3)}`);
await page.evaluate(() => window.SYNTHEQ_DEBUG.setBypass(false));

// プリセットは全バンドが範囲内で、フラット以外は実際に凹凸がある
const presetIssues = await page.evaluate(() => {
  const D = window.SYNTHEQ_DEBUG, bad = [];
  Object.entries(D.EQ_PRESETS).forEach(([name, arr]) => {
    if (arr.length !== D.EQ_FREQS.length) bad.push(`${name}: バンド数 ${arr.length}`);
    if (arr.some(v => Math.abs(v) > 18)) bad.push(`${name}: ±18dB超`);
    if (name !== 'フラット' && arr.every(v => v === 0)) bad.push(`${name}: 全て0`);
  });
  return bad;
});
check('EQプリセットが全て妥当', presetIssues.length === 0, presetIssues.join(' | '));

console.log('\n── 6. シンセプリセット総当たり ─────────');
const presetErrs = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG, bad = [];
  for (const name of Object.keys(D.SYNTH_PRESETS)){
    try {
      D.applySynthPreset(name);
      D.noteOn(60, 1.0);
      await new Promise(r => setTimeout(r, 420));
      const p = D.peak();
      D.noteOff(60); D.allNotesOff();
      await new Promise(r => setTimeout(r, 260));
      if (p <= 0) bad.push(`${name}: 無音 (peak=${p})`);
    } catch(e){ bad.push(`${name}: ${e.message}`); }
  }
  return bad;
});
check('全シンセプリセットが発音する', presetErrs.length === 0, presetErrs.join(' | '));

console.log('\n── 7. アルペジオ / モノ・グライド ──────');
const arpVoices = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG;
  D.applySynthPreset(Object.keys(D.SYNTH_PRESETS)[3]);
  document.getElementById('arpMode').value = 'updown';
  document.getElementById('arpMode').dispatchEvent(new Event('change'));
  D.noteOn(60); D.noteOn(64); D.noteOn(67);
  await new Promise(r => setTimeout(r, 1400));
  const v = D.voiceCount(), p = D.peak();
  D.noteOff(60); D.noteOff(64); D.noteOff(67); D.allNotesOff();
  document.getElementById('arpMode').value = 'off';
  document.getElementById('arpMode').dispatchEvent(new Event('change'));
  return { v, p };
});
check('アルペジオが発音する', arpVoices.p > 0, `voices=${arpVoices.v} peak=${arpVoices.p}`);

const monoPeak = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG;
  document.getElementById('voiceMode').value = 'mono';
  document.getElementById('voiceMode').dispatchEvent(new Event('change'));
  D.noteOn(48); await new Promise(r => setTimeout(r, 200));
  D.noteOn(55); await new Promise(r => setTimeout(r, 300));   // グライドで移動
  const p = D.peak();
  D.noteOff(55); D.noteOff(48); D.allNotesOff();
  document.getElementById('voiceMode').value = 'poly';
  document.getElementById('voiceMode').dispatchEvent(new Event('change'));
  return p;
});
check('モノ＋グライドが発音する', monoPeak > 0, `peak=${monoPeak}`);

console.log('\n── 8. 声部の後片付け（リーク検査）──────');
const leak = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG;
  for (let i=0;i<24;i++){ D.noteOn(48 + (i % 24), 0.8); }
  await new Promise(r => setTimeout(r, 300));
  const during = D.voiceCount();
  D.allNotesOff();
  await new Promise(r => setTimeout(r, 1800));
  return { during, after: D.voiceCount() };
});
check('同時発音数に上限がある', leak.during <= 16, `during=${leak.during}`);
check('停止後に声部が残らない', leak.after === 0, `after=${leak.after}`);

console.log('\n── 9. 描画（Canvasに絵が出ているか）────');
const painted = await page.evaluate(() => {
  const cv = document.getElementById('viz');
  const ctx = cv.getContext('2d');
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let lit = 0;
  for (let i=3;i<d.length;i+=4*37) if (d[i] > 8) lit++;
  return { lit, total: Math.ceil(d.length/(4*37)), w: cv.width, h: cv.height };
});
check('スペクトラムCanvasに描画がある', painted.lit > painted.total * 0.02,
  `${painted.lit}/${painted.total} px (${painted.w}×${painted.h})`);

console.log('\n── 10. 例外の再確認 ────────────────────');
check('操作後も例外0件', errors.length === 0, errors.slice(0, 3).join(' | '));
check('操作後も404が0件', missing.length === 0, missing.slice(0, 3).join(' | '));

const shot = path.join(ROOT, 'tmp', 'synth-eq-verify.png');
fs.mkdirSync(path.dirname(shot), { recursive: true });
await page.screenshot({ path: shot, fullPage: false });

await browser.close();
server.close();

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'}  ${pass} passed / ${fail} failed`);
console.log(`   スクリーンショット: ${path.relative(ROOT, shot)}`);
process.exit(fail === 0 ? 1 && 0 : 1);
