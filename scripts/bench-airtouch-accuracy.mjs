#!/usr/bin/env node
/**
 * エアタッチ精度ベンチ（ブラウザ不要・種固定）。判定層 GestureEngine を合成の手で動かして測る。
 *
 *   node scripts/bench-airtouch-accuracy.mjs          # 表を出す
 *   node scripts/bench-airtouch-accuracy.mjs --json   # 機械可読
 *
 * 「合格/不合格」を出す検査ではなく、改善の前後を比べるための計測器。
 * 合否は verify-gesture-pointer.mjs の精度の節が持つ（ここの数字を根拠に閾値を置く）。
 * 前提は lib/airtouch-sim.mjs の冒頭を参照（実測ではなく仮定）。
 */
import { run, hold, ramp, stats, VIEW, DEFAULTS } from './lib/airtouch-sim.mjs';

const TRIALS = 120;
const SHARES = [0.2, 0.35, 0.5, 0.8];      // 人差し指の先が閉じる量を担う割合（個人差）

/** 「開いて静止 → つまむ → 保つ → 離す」の標準シナリオ */
const pinchScenario = () => [
  ...hold(0.95, 20), ...ramp(0.95, 0.25, 5), ...hold(0.25, 12), ...ramp(0.25, 0.95, 5), ...hold(0.95, 8),
];

/** 素早いタップ（押して約200ms で離す）。tapMaxMs=450ms 以内に収まる長さにすること */
const tapScenario = () => [
  ...hold(0.95, 20), ...ramp(0.95, 0.25, 3), ...hold(0.25, 3), ...ramp(0.25, 0.95, 3), ...hold(0.95, 8),
];

const downEvent = (log) => {
  for (const f of log) for (const e of f.events) if (e.type === 'down') return { e, i: f.i };
  return null;
};

export function measure(options = {}) {
  const out = {};

  // 1) クリック位置のずれ（px）: 開いた手が止まっているときの位置 → 押下した位置。
  //    手は一切動かしていないので、ずれはすべて「つまむ動作」と「計測ノイズ」由来
  out.clickError = {};
  for (const share of SHARES) {
    const errs = [];
    for (let s = 0; s < TRIALS; s++) {
      const { log } = run(pinchScenario(), { seed: 100 + s, share, options });
      const rest = log.slice(10, 20);
      const rx = rest.reduce((a, f) => a + f.x, 0) / rest.length;
      const ry = rest.reduce((a, f) => a + f.y, 0) / rest.length;
      const d = downEvent(log);
      if (d) errs.push(Math.hypot(d.e.x - rx, d.e.y - ry));
    }
    out.clickError[share] = stats(errs);
  }

  // 2) タップとして成立する割合: 動かさずにつまんで離す → 'up' が tap になるか
  out.tapRate = {};
  for (const share of SHARES) {
    let taps = 0; let total = 0;
    for (let s = 0; s < TRIALS; s++) {
      const { log } = run(tapScenario(), { seed: 300 + s, share, options });
      for (const f of log) for (const e of f.events) if (e.type === 'up') { total += 1; if (e.tap) taps += 1; }
    }
    out.tapRate[share] = total ? taps / total : 0;
  }

  // 3) 押下の取りこぼし: 明確につまんだのに down が出ない割合
  let missed = 0;
  for (let s = 0; s < TRIALS; s++) {
    const { log } = run(pinchScenario(), { seed: 500 + s, share: 0.5, options });
    if (!downEvent(log)) missed += 1;
  }
  out.missRate = missed / TRIALS;

  // 4) 誤押下: 手を開いたまま（比0.78・0.65）止めているのに down が出る回数 / 300フレーム
  out.falseDown = {};
  for (const level of [0.78, 0.65]) {
    let n = 0;
    for (let s = 0; s < TRIALS; s++) {
      const { log } = run(hold(level, 300), { seed: 700 + s, share: 0.5, options });
      for (const f of log) for (const e of f.events) if (e.type === 'down') n += 1;
    }
    out.falseDown[level] = n / TRIALS;
  }

  // 5) 押している最中の“はなれ”（押下が途中で切れる）: 比0.25で保持中に up が出る回数
  let chatter = 0;
  for (let s = 0; s < TRIALS; s++) {
    const { log } = run([...hold(0.95, 10), ...ramp(0.95, 0.25, 5), ...hold(0.25, 60)], { seed: 900 + s, share: 0.5, options });
    for (const f of log) for (const e of f.events) if (e.type === 'up') chatter += 1;
  }
  out.holdChatter = chatter / TRIALS;

  // 4b) 荒いノイズ（暗い部屋・逆光・動いている手を想定: σ を2倍、z を2.5倍）での誤押下と途切れ。
  //      ここで効かない平滑化は、遅れだけを増やしている
  const HARSH = { sigma: 0.006, sigmaZ: 0.03 };
  out.harsh = {};
  for (const level of [0.78, 0.65]) {
    let n = 0;
    for (let s = 0; s < TRIALS; s++) {
      const { log } = run(hold(level, 300), { seed: 2100 + s, share: 0.5, options, ...HARSH });
      for (const f of log) for (const e of f.events) if (e.type === 'down') n += 1;
    }
    out.harsh[`false_${level}`] = n / TRIALS;
  }
  let hc = 0;
  for (let s = 0; s < TRIALS; s++) {
    const { log } = run([...hold(0.95, 10), ...ramp(0.95, 0.25, 5), ...hold(0.25, 60)], { seed: 2300 + s, share: 0.5, options, ...HARSH });
    for (const f of log) for (const e of f.events) if (e.type === 'up') hc += 1;
  }
  out.harsh.chatter = hc / TRIALS;

  // 6) 止めているときの揺れ（px、標準偏差）
  const jit = [];
  for (let s = 0; s < 40; s++) {
    const { log } = run(hold(0.95, 90), { seed: 1100 + s, options });
    const tail = log.slice(30);
    const mx = tail.reduce((a, f) => a + f.x, 0) / tail.length;
    const my = tail.reduce((a, f) => a + f.y, 0) / tail.length;
    jit.push(Math.sqrt(tail.reduce((a, f) => a + (f.x - mx) ** 2 + (f.y - my) ** 2, 0) / tail.length));
  }
  out.jitterPx = stats(jit).mean;

  // 7) 追従の遅れ: 一定速度（約600px/秒）で動かしたときの位置の遅れ（px）
  const lag = [];
  for (let s = 0; s < 40; s++) {
    const frames = Array.from({ length: 60 }, (_, k) => ({ pinch: 0.95, nx: 0.3 + k * 0.004, ny: 0.5 }));
    const { log } = run(frames, { seed: 1300 + s, options });
    const k = 59;
    // 真の位置（ノイズ無し）を画面へ写した値との差
    const nx = 0.3 + k * 0.004;
    const mx = 1 - nx;
    const truth = ((mx - DEFAULTS.activeBox.x0) / (DEFAULTS.activeBox.x1 - DEFAULTS.activeBox.x0)) * VIEW.width;
    lag.push(Math.abs(log[k].x - truth));
  }
  out.lagPx = stats(lag).mean;

  // 8) 押下の遅れ（フレーム）: 比が閾値 0.42 を下回ってから down が出るまで
  const lat = [];
  for (let s = 0; s < TRIALS; s++) {
    const frames = [...hold(0.95, 20), ...ramp(0.95, 0.25, 5), ...hold(0.25, 12)];
    const { log } = run(frames, { seed: 1500 + s, share: 0.5, options });
    const d = downEvent(log);
    // 真の比が 0.42 以下になる最初のフレーム
    const cross = frames.findIndex((f) => f.pinch <= DEFAULTS.pinchDown);
    if (d) lat.push(d.i - cross);
  }
  out.downLatencyFrames = stats(lat).mean;
  return out;
}

const fmt = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : String(v));

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = measure();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(m, null, 2)); process.exit(0); }
  console.log('エアタッチ精度ベンチ（合成・種固定・仮定は scripts/lib/airtouch-sim.mjs）\n');
  console.log('クリック位置のずれ px（手は動かしていない。小さいほど良い）');
  for (const [share, s] of Object.entries(m.clickError)) {
    console.log(`  人差し指の担う割合 ${share}: 平均 ${fmt(s.mean)} / 95%点 ${fmt(s.p95)} / 最大 ${fmt(s.max)}`);
  }
  console.log('\nタップとして成立する割合（大きいほど良い）');
  for (const [share, r] of Object.entries(m.tapRate)) console.log(`  人差し指の担う割合 ${share}: ${fmt(r * 100, 0)}%`);
  console.log(`\n押下の取りこぼし: ${fmt(m.missRate * 100, 1)}%（0が良い）`);
  console.log(`誤押下（300フレームあたり）: 比0.78 → ${fmt(m.falseDown[0.78], 2)} / 比0.65 → ${fmt(m.falseDown[0.65], 2)}（0が良い）`);
  console.log(`押している最中の途切れ（60フレームあたり）: ${fmt(m.holdChatter, 2)}（0が良い）`);
  console.log(`荒いノイズ下: 誤押下 比0.78 → ${fmt(m.harsh['false_0.78'], 2)} / 比0.65 → ${fmt(m.harsh['false_0.65'], 2)}・押下の途切れ ${fmt(m.harsh.chatter, 2)}（0が良い）`);
  console.log(`止めているときの揺れ: ${fmt(m.jitterPx, 2)} px（小さいほど良い）`);
  console.log(`追従の遅れ（約600px/秒）: ${fmt(m.lagPx, 1)} px（小さいほど良い）`);
  console.log(`押下の遅れ: ${fmt(m.downLatencyFrames, 2)} フレーム（小さいほど良い。1フレーム≈33ms）`);
}
