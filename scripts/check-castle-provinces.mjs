#!/usr/bin/env node
/**
 * 城データの「国名（令制国）」が日本地図上の配置位置と整合しているかを機械検査する。
 *
 * 城の国名は本来「その城が建つ土地の令制国」でなければならないが、城追加時に国名欄が
 * 未入力だと城名がそのまま国名として保存されてしまう（sengoku.html の
 * addCustomCastleToData にある `nameJP: c.provinceName || c.castleName` フォールバック）。
 * その結果、地図上に「長篠」「大垣」のような存在しない国名のピルが表示される。
 *
 * 検査内容:
 *   #1 siro_ichi.csv と sengoku.html 埋め込みシードCSV(CASTLE_POS_SEED_CSV)の国名が一致するか
 *   #2 国名が令制国（本ファイルの PROVINCE_GEO）に存在するか
 *   #3 城の地図座標(x,y)から求めた緯度経度が、その国の代表地点の近くにあるか
 *
 * #3 の座標→緯度経度変換は、実在地が明らかな城18件を基準点としたアフィン変換（最小二乗）で
 * 求める。地図画像上の城位置は手置きのため誤差があり、閾値は「隣接国との取り違え」ではなく
 * 「まったく別の地方を指している」レベルを拾う値に設定している。
 *
 * 使い方: node scripts/check-castle-provinces.mjs
 * 終了コード: 0=OK / 1=要修正
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 令制国 → 代表地点[経度, 緯度]。
 * 戦国風雲記は一部の広い国を南北・東西に分割して扱う（陸奥→陸中/陸前/岩代/磐城、
 * 出羽→羽前/羽後、越後→北越後/南越後 など）。分割国も本表に含める。
 */
const PROVINCE_GEO = {
  // 奥羽
  '陸奥': [141.15, 40.45], '陸中': [141.15, 39.50], '陸前': [140.95, 38.50],
  '岩代': [140.00, 37.50], '磐城': [140.90, 37.30],
  '出羽': [140.33, 38.26], '北羽前': [139.83, 38.73], '南羽前': [140.10, 38.00],
  '北羽後': [140.20, 40.00], '南羽後': [140.50, 39.25],
  // 北陸
  '越後': [138.60, 37.60], '北越後': [139.35, 37.93], '南越後': [138.35, 37.15],
  '佐渡': [138.40, 38.02], '越中': [137.20, 36.70], '能登': [136.97, 37.05],
  '加賀': [136.65, 36.55], '越前': [136.20, 35.95], '若狭': [135.75, 35.50],
  // 中部
  '信濃': [138.10, 36.35], '北信濃': [138.20, 36.60], '南信濃': [137.97, 36.24],
  '甲斐': [138.57, 35.66], '飛騨': [137.25, 36.14],
  '美濃': [136.75, 35.42], '東美濃': [137.44, 35.37],
  '尾張': [136.90, 35.18], '三河': [137.35, 34.88], '遠江': [137.85, 34.80],
  '駿河': [138.40, 35.00], '伊豆': [138.95, 34.95],
  // 関東
  '相模': [139.30, 35.35], '武蔵': [139.60, 35.80], '上野': [139.00, 36.40],
  '下野': [139.85, 36.60], '常陸': [140.40, 36.40], '下総': [140.20, 35.80],
  '上総': [140.20, 35.40], '安房': [140.00, 35.05],
  // 近畿
  '近江': [136.20, 35.20], '北近江': [136.27, 35.45], '南近江': [136.13, 35.08],
  '山城': [135.76, 35.02], '大和': [135.83, 34.60], '河内': [135.60, 34.55],
  '和泉': [135.40, 34.45], '摂津': [135.45, 34.75], '伊賀': [136.13, 34.77],
  '伊勢': [136.40, 34.55], '志摩': [136.85, 34.48], '紀伊': [135.40, 34.00],
  '丹波': [135.20, 35.10], '丹後': [135.10, 35.55], '但馬': [134.80, 35.40],
  '淡路': [134.80, 34.30],
  // 中国
  '播磨': [134.70, 34.85], '美作': [134.05, 35.05], '備前': [134.00, 34.70],
  '備中': [133.60, 34.75], '備後': [133.35, 34.60], '因幡': [134.24, 35.40],
  '伯耆': [133.50, 35.35], '出雲': [132.90, 35.35], '石見': [132.30, 34.90],
  '隠岐': [133.30, 36.20], '安芸': [132.60, 34.60], '周防': [131.80, 34.15],
  '長門': [131.10, 34.20],
  // 四国
  '阿波': [134.40, 34.00], '讃岐': [134.00, 34.25], '伊予': [132.90, 33.75],
  '土佐': [133.50, 33.50], '東土佐': [133.60, 33.58], '西土佐': [132.95, 33.00],
  // 九州
  '豊前': [130.95, 33.70], '豊後': [131.60, 33.20], '筑前': [130.40, 33.60],
  '筑後': [130.60, 33.20], '肥前': [130.10, 33.20], '肥後': [130.75, 32.80],
  '日向': [131.40, 32.20], '大隅': [130.90, 31.50], '薩摩': [130.50, 31.60],
  '壱岐': [129.70, 33.75], '対馬': [129.30, 34.30],
};

/** 実在地が明らかな城を基準点にした 地図ピクセル → 緯度経度 のアフィン変換 */
const CALIBRATION = [
  // [城名, 地図x, 地図y, 経度, 緯度]
  ['弘前城', 1043, 86, 140.4636, 40.6076],
  ['三戸城', 1084, 104, 141.2565, 40.3757],
  ['山形城', 1007, 223, 140.3305, 38.2554],
  ['江戸城', 978, 363, 139.7528, 35.6852],
  ['小田原城', 930, 383, 139.1536, 35.2506],
  ['駿府館', 863, 392, 138.3839, 34.9769],
  ['清洲城', 758, 360, 136.8420, 35.1980],
  ['二条城', 682, 371, 135.7481, 35.0142],
  ['姫路城', 597, 356, 134.6939, 34.8394],
  ['岡山城', 566, 359, 133.9360, 34.6656],
  ['山口館', 421, 359, 131.4738, 34.1785],
  ['内城', 296, 515, 130.5571, 31.5966],
  ['湯築城', 474, 403, 132.7810, 33.8455],
  ['春日山城', 877, 255, 138.2367, 37.1478],
  ['七尾城', 797, 242, 136.9683, 37.0424],
  ['佐賀城', 313, 413, 130.3010, 33.2450],
  ['府内館', 389, 434, 131.6090, 33.2380],
  ['佐土原城', 369, 496, 131.4650, 32.0640],
];
const THRESHOLD_KM = 110;

/**
 * 検査#3 の例外。「地図上の位置とは合わないが、ゲーム設計として意図的」な城のみを列挙する。
 * 安易に追加せず、必ず理由を書くこと。
 */
const POSITION_EXCEPTIONS = {
  // 伊達の居城。米沢は史実では出羽国置賜郡だが、ゲームでは基本64国の「陸奥」
  // （石高1670＝陸奥一国分）の代表城として米沢城を置いている。国名を出羽に直すと
  // 国そのものの identity が壊れるため、城の配置側の設計として許容する。
  '米沢城': '陸奥',
};

/** ガウス・ジョルダン法で正規方程式を解く（外部依存なしの最小二乗） */
function leastSquares(rows, targets) {
  const n = rows[0].length;
  const m = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) row.push(rows.reduce((s, r) => s + r[i] * r[j], 0));
    row.push(rows.reduce((s, r, k) => s + r[i] * targets[k], 0));
    m.push(row);
  }
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i; r < n; r++) if (Math.abs(m[r][i]) > Math.abs(m[piv][i])) piv = r;
    [m[i], m[piv]] = [m[piv], m[i]];
    const d = m[i][i];
    for (let j = 0; j <= n; j++) m[i][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = m[r][i];
      for (let j = 0; j <= n; j++) m[r][j] -= f * m[i][j];
    }
  }
  return m.map(r => r[n]);
}
function distKm(lon1, lat1, lon2, lat2) {
  const dx = (lon1 - lon2) * Math.cos((lat1 + lat2) / 2 * Math.PI / 180) * 111.32;
  const dy = (lat1 - lat2) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

const design = CALIBRATION.map(c => [c[1], c[2], 1]);
const lonCoef = leastSquares(design, CALIBRATION.map(c => c[3]));
const latCoef = leastSquares(design, CALIBRATION.map(c => c[4]));
const pixelToGeo = (x, y) => [
  lonCoef[0] * x + lonCoef[1] * y + lonCoef[2],
  latCoef[0] * x + latCoef[1] * y + latCoef[2],
];
const calibResidualKm = Math.max(...CALIBRATION.map(c => {
  const [lon, lat] = pixelToGeo(c[1], c[2]);
  return distKm(lon, lat, c[3], c[4]);
}));

/** CSV（城名,国名,所属大名,城LV,X座標,Y座標,…）を読む */
function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const head = lines[0].split(',');
  const iName = head.indexOf('城名');
  const iProv = head.indexOf('国名');
  const iX = head.findIndex(h => h.includes('X城の配置位置'));
  const iY = head.findIndex(h => h.includes('城の配置位置のY'));
  if (iName < 0 || iProv < 0 || iX < 0 || iY < 0) throw new Error('CSVヘッダーに想定の列がありません: ' + lines[0]);
  return lines.slice(1).map((l, n) => {
    const c = l.split(',');
    return { line: n + 2, castle: c[iName], province: c[iProv], x: Number(c[iX]), y: Number(c[iY]) };
  });
}

const html = readFileSync(join(ROOT, 'sengoku.html'), 'utf8');
const seedMatch = html.match(/const CASTLE_POS_SEED_CSV = `([\s\S]*?)`;/);
if (!seedMatch) {
  console.error('✗ sengoku.html に CASTLE_POS_SEED_CSV が見つかりません');
  process.exit(1);
}
const seedRows = parseCsv(seedMatch[1]);
const csvRows = parseCsv(readFileSync(join(ROOT, 'siro_ichi.csv'), 'utf8'));

const problems = [];

/* ---- 検査#1: 2つのCSVの国名が一致するか ---- */
const seedByCastle = new Map();
seedRows.forEach(r => { if (!seedByCastle.has(r.castle)) seedByCastle.set(r.castle, r); });
let mismatch = 0;
for (const r of csvRows) {
  const s = seedByCastle.get(r.castle);
  if (s && s.province !== r.province) {
    problems.push(`国名の食い違い: ${r.castle} … siro_ichi.csv=「${r.province}」 / sengoku.html シード=「${s.province}」`);
    mismatch++;
  }
}
console.log(mismatch === 0
  ? '✓ 検査#1 siro_ichi.csv と sengoku.html シードCSVの国名が一致'
  : `✗ 検査#1 国名の食い違い ${mismatch}件`);

/* ---- 検査#2: 国名が令制国として存在するか ---- */
let unknown = 0;
for (const r of [...csvRows, ...seedRows]) {
  if (!PROVINCE_GEO[r.province]) {
    problems.push(`令制国にない国名: ${r.castle}（${r.line}行目）の国名「${r.province}」`);
    unknown++;
  }
}
console.log(unknown === 0
  ? '✓ 検査#2 すべての国名が令制国'
  : `✗ 検査#2 令制国にない国名 ${unknown}件`);

/* ---- 検査#3: 地図上の位置と国名が整合しているか ---- */
let far = 0;
let maxKm = 0;
for (const r of csvRows) {
  const ref = PROVINCE_GEO[r.province];
  if (!ref) continue;
  if (POSITION_EXCEPTIONS[r.castle] === r.province) continue;
  const [lon, lat] = pixelToGeo(r.x, r.y);
  const d = distKm(lon, lat, ref[0], ref[1]);
  maxKm = Math.max(maxKm, d);
  if (d > THRESHOLD_KM) {
    problems.push(`位置と国名の不一致: ${r.castle}（${r.line}行目, x=${r.x} y=${r.y}）は国「${r.province}」の代表地点から約${Math.round(d)}km 離れています`);
    far++;
  }
}
console.log(far === 0
  ? `✓ 検査#3 全城の国名が地図上の位置と整合（最大ずれ ${Math.round(maxKm)}km / 閾値 ${THRESHOLD_KM}km）`
  : `✗ 検査#3 位置と国名が離れすぎている城 ${far}件`);

if (problems.length) {
  console.error('');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}
console.log('');
console.log(`基準点${CALIBRATION.length}件の較正残差: 最大 ${calibResidualKm.toFixed(1)}km（閾値 ${THRESHOLD_KM}km）`);
console.log('すべての検査に合格しました。');
