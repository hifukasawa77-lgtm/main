/**
 * エアタッチの精度を「数字」で測るための合成シミュレータ（ブラウザ不要・乱数は種固定）。
 *
 * 既存の検査（verify-gesture-pointer.mjs）の合成の手は「親指が閉じる量の65%を担う」前提で、
 * これはポインター位置の混合比（人差し指0.65：親指0.35）と**ちょうど打ち消し合う**。
 * つまり「つまんでもずれない」が必ず出る形で、実際の手では成り立たない。
 * ここでは「人差し指の先が閉じる量のうち何割を担うか（share）」を人ごとに振る。
 *
 * 前提（実測ではなく仮定。数字の絶対値ではなく、改善前後の“比較”に使うこと）:
 *  - ランドマークのノイズ: x,y は σ=0.003（正規化座標）、z は σ=0.012
 *  - 30fps、画面 1440×900、既定の activeBox
 */
import { pathToFileURL } from 'node:url';
// 改善前のコードと比べたいときは AIRTOUCH_MODULE=/path/to/old/gesture-pointer.js で差し替える
const MODULE = process.env.AIRTOUCH_MODULE
  ? pathToFileURL(process.env.AIRTOUCH_MODULE).href
  : new URL('../../assets/js/gesture-pointer.js', import.meta.url).href;
const { GestureEngine, DEFAULTS } = await import(MODULE);

export const VIEW = { width: 1440, height: 900 };
export const FRAME_MS = 1000 / 30;

/** 種固定の乱数（mulberry32）。検査が「たまに落ちる」ものにならないように */
export function rng(seed) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    const u = Math.max(uniform(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
  };
  return { uniform, gauss };
}

/**
 * 手を組み立てる。
 * @param {object} p
 * @param {number} p.nx @param {number} p.ny 手の中心（正規化座標）
 * @param {number} p.pinch 人差し指の先〜親指の先 ÷ 手の大きさ
 * @param {number} [p.share] 閉じる量のうち人差し指の先が担う割合（0〜1）。0.35 は旧検査の前提
 * @param {number} [p.scale] 手の大きさ（手首〜中指の付け根）
 * @param {number} [p.openPinch] 開いたときのピンチ比（閉じる量の基準）
 */
export function makeHand({ nx, ny, pinch, share = 0.35, scale = 0.15, openPinch = 0.95, angle = 25, tipShift = null }) {
  const g0 = openPinch * scale;
  const g = pinch * scale;
  const delta = g0 - g;
  const ux = Math.cos((angle * Math.PI) / 180);
  const uy = Math.sin((angle * Math.PI) / 180);
  const lm = Array.from({ length: 21 }, () => ({ x: nx, y: ny, z: 0 }));
  lm[0] = { x: nx, y: ny + scale, z: 0 };
  lm[9] = { x: nx, y: ny, z: 0 };
  lm[5] = { x: nx - scale / 3, y: ny, z: 0 };
  lm[17] = { x: nx + scale / 3, y: ny, z: 0 };
  // 開いた状態の先端: 旧検査と同じ配置（混合点が nx に来る）。ここから share に従って寄る
  const i0 = { x: nx + 0.35 * g0 * ux, y: ny - 0.35 * g0 * uy };
  const t0 = { x: nx - 0.65 * g0 * ux, y: ny + 0.65 * g0 * uy };
  lm[8] = { x: i0.x - share * delta * ux, y: i0.y + share * delta * uy, z: 0 };
  lm[4] = { x: t0.x + (1 - share) * delta * ux, y: t0.y - (1 - share) * delta * uy, z: 0 };
  // 指の構えが変わった（手首は動かず、先端だけが付け根に対して動いた）状態を作る
  if (tipShift) {
    for (const i of [8, 4]) { lm[i].x += (tipShift.x ?? 0) * scale; lm[i].y += (tipShift.y ?? 0) * scale; }
  }
  // 中指は人差し指と一緒に寄る（実際の手でも摘まむと中指が付いてくる）
  lm[12] = { x: lm[8].x + 0.02 * scale, y: lm[8].y - 0.9 * scale, z: 0 };
  return { landmarks: lm };
}

/** 全ランドマークへ計測ノイズを足す */
export function addNoise(hand, r, { sigma = 0.003, sigmaZ = 0.012 } = {}) {
  return {
    landmarks: hand.landmarks.map((p) => ({
      x: p.x + r.gauss() * sigma,
      y: p.y + r.gauss() * sigma,
      z: (p.z ?? 0) + r.gauss() * sigmaZ,
    })),
  };
}

/** 1回分の走行。frames は {pinch, nx?, ny?} の配列。イベントと位置の履歴を返す */
export function run(frames, { seed = 1, share = 0.35, sigma = 0.003, sigmaZ = 0.012, options = {}, scale = 0.15 } = {}) {
  const r = rng(seed);
  const engine = new GestureEngine(options);
  const log = [];
  let t = 1000;
  frames.forEach((f, i) => {
    const hand = f.hand === null ? null : addNoise(makeHand({
      nx: f.nx ?? 0.5, ny: f.ny ?? 0.5, pinch: f.pinch, share: f.share ?? share, scale: f.scale ?? scale, tipShift: f.tipShift ?? null,
    }), r, { sigma, sigmaZ });
    const frame = engine.update(hand, t, VIEW);
    log.push({ i, t, x: frame.x, y: frame.y, pinch: frame.pinch, pressed: frame.pressed, events: frame.events });
    t += FRAME_MS;
  });
  return { log, engine };
}

/** 開いた手を n フレーム */
export const hold = (pinch, n, extra = {}) => Array.from({ length: n }, () => ({ pinch, ...extra }));
/** pinch を from→to へ n フレームで直線的に */
export const ramp = (from, to, n, extra = {}) =>
  Array.from({ length: n }, (_, k) => ({ pinch: from + ((to - from) * (k + 1)) / n, ...extra }));

export const stats = (values) => {
  const a = [...values].sort((x, y) => x - y);
  const mean = a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const q = (p) => a[Math.min(a.length - 1, Math.floor(p * a.length))] ?? 0;
  return { mean, p50: q(0.5), p95: q(0.95), max: a[a.length - 1] ?? 0 };
};

export { DEFAULTS };
