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

// CLAUDE.md / AGENTS.md の「UIは日英バイリンガル表記」を機械検査する。
// 目視レビューだと新しいボタンを足したときに日本語のみで通ってしまう
const jpOnly = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('button, .chip, .hint, .warn, .status').forEach((el) => {
    const t = (el.textContent || '').trim();
    if (!t) return;
    const hasJa = /[぀-ヿ一-鿿]/.test(t);
    const hasEn = /[A-Za-z]{2,}/.test(t);
    if (hasJa && !hasEn) bad.push(t.slice(0, 30));
  });
  return bad;
});
check('操作系のUIが日英併記', jpOnly.length === 0, jpOnly.slice(0, 4).join(' / '));

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
    if (!/フラット|Flat/.test(name) && arr.every(v => v === 0)) bad.push(`${name}: 全て0`);
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

console.log('\n── 10. ステップシーケンサー ────────────');
const seqCells = await page.locator('#seqGrid .cell').count();
const seqLabels = await page.locator('#seqGrid .seqlab').count();
const dims = await page.evaluate(() => ({ r: window.SYNTHEQ_DEBUG.SEQ_ROWS, s: window.SYNTHEQ_DEBUG.SEQ_STEPS }));
check('シーケンサーのマス目が揃っている', seqCells === dims.r * dims.s && seqLabels === dims.r,
  `cells=${seqCells} labels=${seqLabels} (${dims.r}×${dims.s})`);

// パターンを読み込むと実際に音符が入る（空パターンを「読めた」と誤判定しないよう個数も見る）
const patFilled = await page.evaluate(() => {
  const D = window.SYNTHEQ_DEBUG, bad = [];
  Object.entries(D.SEQ_PATTERNS).forEach(([name, pairs]) => {
    D.loadSeqPattern(pairs);
    const n = D.seqSnapshot().flat().filter(Boolean).length;
    // 行外（音域を超える半音）は捨てられるので、置けた数が pairs 以下なのは正常。0 は異常
    if (n === 0) bad.push(`${name}: 0個`);
    const onCells = document.querySelectorAll('#seqGrid .cell.on').length;
    if (onCells !== n) bad.push(`${name}: DOM ${onCells} ≠ 状態 ${n}`);
  });
  return bad;
});
check('全シーケンスパターンが読み込める', patFilled.length === 0, patFilled.join(' | '));

const seqPlay = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG;
  D.loadSeqPattern(Object.values(D.SEQ_PATTERNS)[0]);
  D.setSeq(true);
  await new Promise(r => setTimeout(r, 1500));
  const p = D.peak(), on = D.isSeqOn();
  const head = document.querySelectorAll('#seqGrid .cell.now').length;
  D.setSeq(false);
  await new Promise(r => setTimeout(r, 300));
  return { p, on, head, stillOn: D.isSeqOn(), headAfter: document.querySelectorAll('#seqGrid .cell.now').length };
});
check('シーケンサー再生で音が出る', seqPlay.p > 0 && seqPlay.on, `peak=${seqPlay.p}`);
check('再生位置マーカーが1列だけ点く', seqPlay.head === dims.r, `now=${seqPlay.head}`);
check('停止でマーカーも消える', !seqPlay.stillOn && seqPlay.headAfter === 0, `now=${seqPlay.headAfter}`);

// デモとシーケンサーは排他（両方鳴ると何を聞いているか分からなくなる）
const excl = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG;
  D.setSeq(true);
  D.setDemo(true);
  await new Promise(r => setTimeout(r, 120));
  const a = D.isSeqOn();
  D.setSeq(true);
  await new Promise(r => setTimeout(r, 120));
  const b = document.getElementById('btnDemo').textContent.includes('停止');
  D.setSeq(false); D.setDemo(false); D.allNotesOff();
  return { seqOffWhenDemo: a === false, demoOffWhenSeq: b === false };
});
check('デモとシーケンサーが排他になる', excl.seqOffWhenDemo && excl.demoOffWhenSeq, JSON.stringify(excl));

console.log('\n── 11. 共有リンク・保存 ────────────────');
const roundTrip = await page.evaluate(() => {
  const D = window.SYNTHEQ_DEBUG;
  D.setAllBands([3,-6,9,0,-2,4,0,-9,12,-3]);
  D.loadSeqPattern(Object.values(D.SEQ_PATTERNS)[3]);
  document.getElementById('osc1Type').value = 'square';
  document.getElementById('osc1Type').dispatchEvent(new Event('change'));
  const before = D.snapshot();
  const code = D.encodeState();
  const after = D.decodeState(code);
  return {
    urlSafe: /^[A-Za-z0-9\-_]+$/.test(code),
    len: code.length,
    eqSame: JSON.stringify(before.eq) === JSON.stringify(after.eq),
    seqSame: before.seq === after.seq,
    oscSame: before.p.osc1Type === after.p.osc1Type && after.p.osc1Type === 'square'
  };
});
check('共有コードがURLに載る文字だけで出来ている', roundTrip.urlSafe, `len=${roundTrip.len}`);
check('EQ・シーケンス・音色が往復して一致する',
  roundTrip.eqSame && roundTrip.seqSame && roundTrip.oscSame, JSON.stringify(roundTrip));

// 実際に #s=... 付きで開き直して復元されるか（往復関数だけ通っても復元経路は別物）
const shareCode = await page.evaluate(() => window.SYNTHEQ_DEBUG.encodeState());
const restored = await page.evaluate(() => window.SYNTHEQ_DEBUG.snapshot());
const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors2 = [];
page2.on('pageerror', (e) => errors2.push(e.message));
await page2.addInitScript(() => { window.__SYNTHEQ_TEST = true; try { localStorage.clear(); } catch(e){} });
await page2.goto(`${BASE}/synth-eq.html#s=${shareCode}`, { waitUntil: 'load' });
await page2.waitForTimeout(400);
const loaded = await page2.evaluate(() => window.SYNTHEQ_DEBUG.snapshot());
check('共有リンクを開くとEQが復元される', JSON.stringify(loaded.eq) === JSON.stringify(restored.eq),
  `${JSON.stringify(loaded.eq)}`);
check('共有リンクを開くとシーケンスが復元される', loaded.seq === restored.seq, `${loaded.seq}`);
check('共有リンクを開くと音色が復元される', loaded.p.osc1Type === restored.p.osc1Type, `${loaded.p.osc1Type}`);
check('共有リンクの復元で例外が出ない', errors2.length === 0, errors2.slice(0,2).join(' | '));
// 壊れた共有リンクでページごと落ちないこと
const page3 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors3 = [];
page3.on('pageerror', (e) => errors3.push(e.message));
await page3.addInitScript(() => { window.__SYNTHEQ_TEST = true; });
await page3.goto(`${BASE}/synth-eq.html#s=zzz_not_a_real_state_zzz`, { waitUntil: 'load' });
await page3.waitForTimeout(300);
const alive = await page3.evaluate(() => document.querySelectorAll('.ftrack').length);
check('壊れた共有リンクでもページが生きている', alive === 10 && errors3.length === 0,
  `faders=${alive} errors=${errors3.length}`);
await page2.close(); await page3.close();

console.log('\n── 12. MIDI入力 ────────────────────────');
const midi = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG;
  D.allNotesOff();
  // 実機は繋がらないので、onmidimessage が受け取る形のメッセージを直接流す
  D.onMidi({ data: [0x90, 64, 100] });
  await new Promise(r => setTimeout(r, 400));
  const on = { v: D.voiceCount(), p: D.peak() };
  D.onMidi({ data: [0x80, 64, 0] });                 // note off
  D.onMidi({ data: [0x90, 67, 90] });
  await new Promise(r => setTimeout(r, 300));
  const second = D.voiceCount();
  D.onMidi({ data: [0xb0, 123, 0] });                // all notes off
  await new Promise(r => setTimeout(r, 1400));
  return { on, second, after: D.voiceCount() };
});
check('MIDI note-on で発音する', midi.on.v > 0 && midi.on.p > 0, `voices=${midi.on.v} peak=${midi.on.p}`);
check('MIDI note-off / All Notes Off が効く', midi.after === 0, `after=${midi.after}`);
await page.evaluate(() => window.SYNTHEQ_DEBUG.allNotesOff());

console.log('\n── 13. カーソル読み取り ────────────────');
const readout = await page.evaluate(() => document.getElementById('vizRead').hidden);
await page.locator('#viz').hover({ position: { x: 400, y: 120 } });
await page.waitForTimeout(200);
const readShown = await page.evaluate(() => {
  const el = document.getElementById('vizRead');
  return { hidden: el.hidden, text: el.textContent };
});
check('ホバー前は読み取り表示が出ていない', readout === true);
check('ホバーで周波数とEQ値が読める', !readShown.hidden && /Hz|kHz/.test(readShown.text) && /dB/.test(readShown.text),
  readShown.text);

console.log('\n── 14. 停止・モード切替の取り残し ──────');
// 先読み(150ms)で予約済みの声部は生成時点で stop(未来) 済み＝released。
// kill() を持たないと「停止したのに鳴り出す」音が残る
const panic = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG;
  // 余韻で判定が濁らないよう、リバーブ・ディレイ・リリースを切る
  // ★ リリースを長くするのが肝。短いと幽霊音が一瞬で鳴り終わり、
  //   アナライザの平滑化に埋もれて「止まっている」ように見えてしまう
  [['reverb',0],['delay',0],['rel',1.2],['sus',100]].forEach(([id, v]) => {
    const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input'));
  });
  // 全ステップを埋めた上でテンポを上げ、停止時に必ず先読み予約が残っている状態にする
  const bpm = document.getElementById('bpm'); bpm.value = 200; bpm.dispatchEvent(new Event('input'));
  D.loadSeqPattern(Array.from({length: D.SEQ_STEPS}, (_, s) => [0, s]));
  D.setSeq(true);
  await new Promise(r => setTimeout(r, 1200));
  const during = D.peak();
  D.setSeq(false);                                   // 内部で allNotesOff
  // 止めたのに鳴り続けていれば、予約済みの声部が生き残っている
  await new Promise(r => setTimeout(r, 900));
  return { during, ghost: D.peak(), voices: D.voiceCount() };
});
check('停止すると予約済みの音も鳴り出さない',
  panic.during > 0 && panic.ghost < 25 && panic.voices === 0,
  `during=${panic.during} ghost=${panic.ghost} voices=${panic.voices}`);

const modeStuck = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG;
  const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change')); };
  const out = {};
  for (const [from, to] of [['poly','mono'], ['mono','poly']]){
    D.allNotesOff(); await new Promise(r => setTimeout(r, 300));
    set('voiceMode', from);
    D.noteOn(60); await new Promise(r => setTimeout(r, 150));
    set('voiceMode', to);                             // 押しっぱなしのままモードを跨ぐ
    await new Promise(r => setTimeout(r, 100));
    D.noteOff(60);
    await new Promise(r => setTimeout(r, 900));
    out[from + '→' + to] = D.voiceCount();
  }
  set('voiceMode', 'poly');
  return out;
});
check('発音モードを跨いでも声部が残らない', Object.values(modeStuck).every((n) => n === 0), JSON.stringify(modeStuck));

// PCキーを押したままオクターブを変えると、keyup が別のMIDI番号を計算して
// 旧番号が pressed に残り、そのキーが二度と反応しなくなる
await page.evaluate(() => { window.SYNTHEQ_DEBUG.allNotesOff(); document.body.focus(); });
await page.keyboard.down('a');
await page.waitForTimeout(120);
await page.keyboard.press('z');            // オクターブ下げ
await page.keyboard.up('a');
await page.keyboard.press('x');            // 元のオクターブへ戻す
await page.waitForTimeout(150);
await page.keyboard.down('a');             // 同じキーをもう一度
await page.waitForTimeout(350);
const keyAlive = await page.evaluate(() => ({ v: window.SYNTHEQ_DEBUG.voiceCount(), p: window.SYNTHEQ_DEBUG.peak() }));
await page.keyboard.up('a');
await page.evaluate(() => window.SYNTHEQ_DEBUG.allNotesOff());
check('オクターブ変更後も同じPCキーで発音できる', keyAlive.v > 0 && keyAlive.p > 0,
  `voices=${keyAlive.v} peak=${keyAlive.p}`);

console.log('\n── 15. EQカーブの追随・MIDI後始末 ──────');
// setTargetAtTime の途中値でキャッシュが固まると、カーブが実際の応答とズレたまま残る
const converge = await page.evaluate(async () => {
  const D = window.SYNTHEQ_DEBUG;
  // ★ 幅は描画ループと同じ値を使う。別の幅で問い合わせるとキャッシュを常に外し、
  //   「固まったキャッシュ」というバグ自体を素通りしてしまう
  const w = Math.round(document.getElementById('viz').getBoundingClientRect().width);
  D.setBypass(false);
  D.setAllBands([0,0,0,0,0,0,0,0,0,0]);
  await new Promise(r => setTimeout(r, 350));
  D.setAllBands([12,0,0,0,0,0,0,0,0,0]);
  await new Promise(r => setTimeout(r, 40));
  const early = D.curve(w)[0];
  await new Promise(r => setTimeout(r, 700));
  return { w, early, late: D.curve(w)[0] };
});
check('EQカーブが平滑化の完了後も更新される', converge.late > 9,
  `${converge.early.toFixed(1)} → ${converge.late.toFixed(1)} dB @20Hz`);

// MIDI停止後に onstatechange が残ると、機器の抜き差しで null 参照の例外になる
const pageM = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errorsM = [];
pageM.on('pageerror', (e) => errorsM.push(e.message));
await pageM.addInitScript(() => {
  window.__SYNTHEQ_TEST = true;
  const fake = { inputs: new Map(), onstatechange: null };
  navigator.requestMIDIAccess = async () => fake;    // 実機の代わり
  window.__fakeMidi = fake;
});
await pageM.goto(`${BASE}/synth-eq.html`, { waitUntil: 'load' });
await pageM.locator('#btnMidi').click();             // 開始
await pageM.waitForTimeout(250);
const midiStarted = await pageM.evaluate(() => typeof window.__fakeMidi.onstatechange === 'function');
await pageM.locator('#btnMidi').click();             // 停止
await pageM.waitForTimeout(150);
const midiStopped = await pageM.evaluate(() => {
  const f = window.__fakeMidi;
  let threw = false;
  try { if (f.onstatechange) f.onstatechange(); } catch(e){ threw = true; }
  return { cleared: f.onstatechange === null, threw };
});
check('MIDI開始で状態監視が付く', midiStarted);
check('MIDI停止で状態監視が外れ、抜き差しで落ちない',
  midiStopped.cleared && !midiStopped.threw && errorsM.length === 0,
  `${JSON.stringify(midiStopped)} errors=${errorsM.length}`);
await pageM.close();

console.log('\n── 16. 例外の再確認 ────────────────────');
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
