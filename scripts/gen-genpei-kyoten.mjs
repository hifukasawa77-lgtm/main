#!/usr/bin/env node
/*
 * gen-genpei-kyoten.mjs — 源平争乱記の拠点147を kyoten_ichi.csv として書き出す
 *
 * 詳細設計 1.3 の手順。地図は絵地図で geoToScreen の緯度経度換算と一致しない
 * （九州は x 方向に約380pxずれる）ため、経緯度からは起こさない。
 * siro_ichi.csv の既知の城を「アンカー」とし、そこからの画素オフセットで拠点を置く。
 *
 * ★ 座標は正規化 MX,MY(0..1) で出力する。絶対画素値で持つと、参照先の地図が
 *   別解像度で再エンコードされた瞬間に全拠点が一斉にずれる（castleMapRecordToWorld が
 *   record.x / naturalWidth で正規化するため）。
 * ★ siro_ichi.csv は読むだけで書き戻さない（sengoku.html 側の資産を汚さない）。
 *
 * 使い方:
 *   node scripts/gen-genpei-kyoten.mjs            # 生成（既存CSVがあれば中止）
 *   node scripts/gen-genpei-kyoten.mjs --force    # 既存CSVを上書き
 *   node scripts/gen-genpei-kyoten.mjs --dry-run  # 書かずに結果だけ出す
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, PROVINCE_OWNER, KOKUGA_ANCHOR, SHOEN, TACHI, MINATO } from './genpei-kyoten-anchors.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASTLE_CSV = path.join(ROOT, 'siro_ichi.csv');
const PROVINCES = path.join(ROOT, 'assets/genpei/provinces.json');
const OUT = path.join(ROOT, 'kyoten_ichi.csv');

// 地図画像 assets/sengoku/gpt/sengoku-japan-map-user-v1.webp の実寸。
const MAP_W = 1672, MAP_H = 941;

/* ---- siro_ichi.csv → 現行地図画像 の較正アフィン ----
 * siro_ichi.csv の X,Y は現行の地図画像の画素座標では「ない」。旧い地図に対して
 * 起こされた座標がそのまま残っており、素直に画素として扱うと 164城中 100城以上が
 * 海の上に落ちる（実測）。読み込みは成功し例外も出ないので、気づかずに全拠点を
 * 海へ置いてしまう類の罠である。
 *
 * 下の係数は、siro_ichi.csv の全164城が現行地図の陸地に載るように総当たりで求めたもの。
 * 164/164 が陸に載る（scripts/verify-genpei-kyoten.mjs が毎回この率を再測する）。
 *
 * ★ sengoku.html 側は直さない（決定事項B）。これは genpei 側だけの読み替えである。
 * ★ 地図画像を差し替えたらこの係数は無効になる。verify が校正失敗として検出する。 */
const CALIB = { sx: 1.275, sy: 1.235, ox: 0, oy: -88 };
const calib = (x, y) => ({ x: x * CALIB.sx + CALIB.ox, y: y * CALIB.sy + CALIB.oy });
// 拠点どうしの最短間隔（px）。戦国風雲記で確認済みの下限。
const MIN_GAP = 11;
// 湊はこの距離以内に海があること。絵地図なので湾の描き込みが粗く、12pxでは
// 桑名・敦賀のような湾奥の湊が届かない。
const MINATO_SEA_RADIUS = 20;
// 参照する地図画像（読むだけ・改変しない）
const MAP_ASSET = 'assets/sengoku/gpt/sengoku-japan-map-user-v1.webp';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');

/* ---- 入力 ---- */
function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  return lines.slice(1).map(l => Object.fromEntries(l.split(',').map((v, i) => [head[i], v])));
}
const castles = new Map();
for (const r of parseCsv(fs.readFileSync(CASTLE_CSV, 'utf8'))) {
  const x = Number(r['X城の配置位置の座標']), y = Number(r['城の配置位置のY座標']);
  if (Number.isFinite(x) && Number.isFinite(y)) castles.set(r['城名'], { x, y });
}
const provJson = JSON.parse(fs.readFileSync(PROVINCES, 'utf8'));
const provinces = new Map(provJson.provinces.map(p => [p.id, p]));

/* ---- 領有の解決 ---- */
const ownerByScenario = {};
for (const s of SCENARIOS) {
  const map = new Map();
  for (const [fid, list] of Object.entries(PROVINCE_OWNER[s.key] ?? {})) {
    for (const pid of list) {
      if (map.has(pid)) throw new Error(`${s.key}: ${pid} が ${map.get(pid)} と ${fid} に二重で割り当てられている`);
      map.set(pid, fid);
    }
  }
  ownerByScenario[s.key] = map;
}
const ownerOf = (scenarioKey, provinceId, override) =>
  override?.[scenarioKey] ?? ownerByScenario[scenarioKey].get(provinceId) ?? '';

/* ---- 拠点の組み立て ---- */
const errors = [];
const warnList = [];
const rows = [];

function anchorPoint(castleName, dx, dy, who) {
  const c = castles.get(castleName);
  if (!c) { errors.push(`${who}: アンカー城「${castleName}」が siro_ichi.csv に存在しない`); return null; }
  const a = calib(c.x, c.y);
  // dx,dy は「旧座標系での画素」として書かれているので、較正の倍率も掛けて
  // 意図した実距離（1px ≒ 1.1km）を保つ。
  return { x: Math.round(a.x + dx * CALIB.sx), y: Math.round(a.y + dy * CALIB.sy) };
}

// 国衙66
for (const [pid, spec] of Object.entries(KOKUGA_ANCHOR)) {
  const p = provinces.get(pid);
  if (!p) { errors.push(`国衙: 存在しない国 ${pid}`); continue; }
  const [castle, dx, dy] = spec;
  const pt = anchorPoint(castle, dx, dy, `${p.nameJP}国衙`);
  if (!pt) continue;
  rows.push({
    id: `kokuga_${pid}`, nameJP: `${p.nameJP}国衙`, nameEN: `${p.nameEN} Provincial Seat`,
    type: 'kokuga', province: pid, ...pt,
    scale: p.tasu, defense: 20 + Math.round(p.tasu / 25), holder: '', suigun: '',
    own: {}, note: '',
  });
}
// 荘園40
for (const [id, jp, en, pid, holder, castle, dx, dy, scale] of SHOEN) {
  const pt = anchorPoint(castle, dx, dy, jp);
  if (!pt) continue;
  if (!provinces.has(pid)) { errors.push(`${jp}: 存在しない国 ${pid}`); continue; }
  rows.push({ id, nameJP: jp, nameEN: en, type: 'shoen', province: pid, ...pt,
              scale, defense: 10, holder, suigun: '', own: {}, note: '' });
}
// 館・城郭25
for (const [id, jp, en, pid, castle, dx, dy, scale, defense, own] of TACHI) {
  const pt = anchorPoint(castle, dx, dy, jp);
  if (!pt) continue;
  if (!provinces.has(pid)) { errors.push(`${jp}: 存在しない国 ${pid}`); continue; }
  rows.push({ id, nameJP: jp, nameEN: en, type: 'tachi', province: pid, ...pt,
              scale, defense, holder: '', suigun: '', own, note: '' });
}
// 湊16
for (const [id, jp, en, pid, castle, dx, dy, scale, suigun, riverPort] of MINATO) {
  const pt = anchorPoint(castle, dx, dy, jp);
  if (!pt) continue;
  if (!provinces.has(pid)) { errors.push(`${jp}: 存在しない国 ${pid}`); continue; }
  rows.push({ id, nameJP: jp, nameEN: en, type: 'minato', province: pid, ...pt,
              scale, defense: 20, holder: '', suigun: suigun ?? '', own: {},
              note: riverPort ? 'riverPort' : '' });
}

if (errors.length) {
  console.error('✗ 生成を中止しました:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

/* ---- 陸地スナップと重なりの解消 ----
 * 手で置いたオフセットは、海岸沿いの拠点（鎌倉・衣笠・湊のすべて）でわずかな
 * ずれでも海に落ちる。オフセットを24箇所も手で詰めるのは非現実的なので、
 * 地図画像を実際に読んで最寄りの陸へ寄せる。
 *   - 陸/海の判定は g > b + 4（この地図は陸が緑〜黄土、海が青緑）
 *   - 湊は「陸であり、かつ半径12px以内に海がある」場所へ寄せる
 *   - 重なりの解消も陸判定つきで行う（逃がした先が海では意味がない）
 * 検査（verify-genpei-kyoten.mjs）は同じ規則で独立に測り直す。 */
const landMask = await buildLandMask();
function isLand(x, y) {
  if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return false;
  return landMask[y * MAP_W + x] === 1;
}
function nearSea(x, y, radius = MINATO_SEA_RADIUS) {
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2;
    for (let r = 3; r <= radius; r += 3) {
      const px = Math.round(x + Math.cos(t) * r), py = Math.round(y + Math.sin(t) * r);
      if (px < 0 || py < 0 || px >= MAP_W || py >= MAP_H) return true;
      if (!isLand(px, py)) return true;
    }
  }
  return false;
}
// 候補位置を近い順に列挙する（決定論。同じ入力なら必ず同じ出力になる）
function* candidates(x, y) {
  yield { x, y };
  for (let r = 3; r <= 240; r += 3) {
    const steps = Math.max(12, Math.round(r / 2));
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      yield { x: Math.round(x + Math.cos(t) * r), y: Math.round(y + Math.sin(t) * r) };
    }
  }
}
const tooClose = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < MIN_GAP;

let snapped = 0, nudged = 0;
const placed = [];
for (const row of rows) {
  const base = { x: row.x, y: row.y };
  const wantCoast = row.type === 'minato' && row.note !== 'riverPort';
  let found = null;
  for (const c of candidates(base.x, base.y)) {
    if (!isLand(c.x, c.y)) continue;
    if (wantCoast && !nearSea(c.x, c.y)) continue;
    if (placed.some(p => tooClose(p, c))) continue;
    found = c; break;
  }
  if (!found) { errors.push(`${row.nameJP}: 陸地かつ間隔を満たす位置が見つからない`); continue; }
  const moved = Math.hypot(found.x - base.x, found.y - base.y);
  if (moved > 0.5) (isLand(base.x, base.y) ? nudged++ : snapped++);
  if (moved > 90) warnList.push(`${row.nameJP}: 補正距離が ${Math.round(moved)}px と大きい（オフセットを見直すこと）`);
  row.x = found.x; row.y = found.y;
  placed.push(row);
}
if (errors.length) {
  console.error('✗ 生成を中止しました:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

async function buildLandMask() {
  const { chromium } = await import('playwright');
  const dataUri = 'data:image/webp;base64,'
    + fs.readFileSync(path.join(ROOT, MAP_ASSET)).toString('base64');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH
      || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  });
  const page = await browser.newPage();
  await page.goto('about:blank');
  const bytes = await page.evaluate(async ({ src, w, h }) => {
    const img = new Image(); img.src = src; await img.decode();
    const cnv = document.createElement('canvas');
    cnv.width = w; cnv.height = h;
    const ctx = cnv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    // ★ verify-genpei-kyoten.mjs と同一の判定にすること。片方が単一画素、片方が
    //   近傍平均だと、細い地峡で「生成は陸・検査は海」と食い違って永久に直らない。
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const out = new Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let g = 0, b = 0, n = 0;
      for (let dy = -2; dy <= 2; dy += 2) for (let dx = -2; dx <= 2; dx += 2) {
        const o = (clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1)) * 4;
        g += d[o + 1]; b += d[o + 2]; n++;
      }
      out[y * w + x] = (g / n) > (b / n) + 4 ? 1 : 0;
    }
    return out;
  }, { src: dataUri, w: MAP_W, h: MAP_H });
  await browser.close();
  return Uint8Array.from(bytes);
}

/* ---- 出力 ---- */
const HEAD = ['ID', '拠点名', '英名', '種別', '国', 'MX', 'MY', '規模', '防御', '荘園領主', '水軍',
              ...SCENARIOS.map(s => s.key), '備考'];
const lines = [HEAD.join(',')];
for (const r of rows) {
  lines.push([
    r.id, r.nameJP, r.nameEN, r.type, r.province,
    (r.x / MAP_W).toFixed(6), (r.y / MAP_H).toFixed(6),
    r.scale, r.defense, r.holder, r.suigun,
    ...SCENARIOS.map(s => ownerOf(s.key, r.province, r.own)),
    r.note,
  ].join(','));
}
const csv = lines.join('\n') + '\n';

if (!DRY && fs.existsSync(OUT) && !args.has('--force')) {
  console.error(`✗ ${path.relative(ROOT, OUT)} は既に存在します。`);
  console.error('  生成後の正本は CSV 側です。上書きしてよいなら --force を付けてください。');
  process.exit(1);
}
if (!DRY) fs.writeFileSync(OUT, csv, 'utf8');

const byType = {};
for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1;
console.log(`${DRY ? '(dry-run) ' : '✓ '}${path.relative(ROOT, OUT)} — ${rows.length}拠点`);
console.log(`   国衙 ${byType.kokuga} / 荘園 ${byType.shoen} / 館・城郭 ${byType.tachi} / 湊 ${byType.minato}`);
console.log(`   海から陸へ寄せた拠点: ${snapped} / 重なり解消で動かした拠点: ${nudged}`);
for (const w of warnList) console.log(`   ⚠ ${w}`);
