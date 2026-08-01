#!/usr/bin/env node
/*
 * verify-castle-csv.mjs — siro_ichi.csv がゲーム本体へ正しく取り込まれたかを機械検査する
 *
 * sengoku.html をローカルHTTPサーバー経由で起動し（file:// では fetch(siro_ichi.csv) が
 * CORSで失敗して埋め込みシードへ落ちてしまうため）、タイトル画面まで進んだ時点の
 * DATA / CASTLE_NAMES / CASTLE_CLASS_MAP / CSV_SIRO_ICHI_CASTLE_META / CASTLE_POS_OVERRIDES を
 * CSVの各行と突き合わせる。
 *
 * 検査:
 *   1. pageerror（未捕捉例外）が0件
 *   2. CSVの全行がゲーム内の城1つに解決し、行→城が1対1（複数行が同じ城へ潰れていない）
 *   3. 城名・国名・城LV・城区分・城の種類・座標(x,y)がCSVと一致
 *   4. シナリオ1〜6の初期領有大名がCSVと一致
 *   5. CSVに無いのにゲーム内に残っている城（孤児）を一覧する ※警告
 *
 * 使い方: node scripts/verify-castle-csv.mjs
 * 終了コード: 全PASS=0 / FAILあり=1
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV_FILE = path.join(ROOT, 'siro_ichi.csv');

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

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const header = lines[0].split(',').map(s => s.trim());
  const idx = name => header.indexOf(name);
  const scenarioCols = header
    .map((n, i) => (/^シナリオ[１-６1-6]\(大名\)$/.test(n) ? i : -1))
    .filter(i => i >= 0);
  return lines.slice(1).map((line, i) => {
    const c = line.split(',');
    return {
      row: i + 2,
      castleName: c[idx('城名')].trim(),
      provinceName: c[idx('国名')].trim(),
      scenarioDaimyos: scenarioCols.map(j => (c[j] || '').trim()),
      level: Number(c[idx('城LV')]),
      x: Number(c[idx('X城の配置位置の座標')]),
      y: Number(c[idx('城の配置位置のY座標')]),
      castleClass: c[idx('城区分')].trim(),
      castleType: c[idx('城の種類')].trim()
    };
  });
}

const CASTLE_TYPE_FROM_JP = { '平城': 'hirajiro', '山城': 'yamajiro', '平山城': 'hirayamajiro', '館': 'yakata', '海城': 'umajiro', '特別': 'special' };
const CASTLE_CLASS_FROM_JP = { '本城': 'honjo', '支城': 'shijo' };

async function main() {
  const csvRows = parseCsv(fs.readFileSync(CSV_FILE, 'utf8'));
  const { server, port } = await serve(ROOT);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e.message || e)));
  page.on('requestfailed', r => {
    const u = r.url();
    if (u.startsWith(`http://127.0.0.1:${port}/`)) pageErrors.push(`requestfailed: ${u}`);
  });

  await page.goto(`http://127.0.0.1:${port}/sengoku.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene && game.scene.constructor.name === 'TitleScene', null, { timeout: 180000 });

  const dump = await page.evaluate(() => {
    const provinces = DATA.provinces
      .filter(p => !isCastleDeleted(p.id))
      .map(p => {
        const pos = CASTLE_POS_OVERRIDES[p.id] || CASTLE_MAP_POINTS[p.id] || {};
        const meta = CSV_SIRO_ICHI_CASTLE_META[p.id] || {};
        return {
          id: p.id,
          castleName: castleNameForProvince(p),
          provinceName: p.nameJP,
          level: meta.level ?? null,
          metaType: meta.castleType ?? null,
          castleType: castleTypeForProvince(p.id, null),
          castleClass: getCastleClass(p.id),
          x: Number.isFinite(pos.x) ? Math.round(pos.x) : null,
          y: Number.isFinite(pos.y) ? Math.round(pos.y) : null
        };
      });
    const scenarios = (DATA.scenarios || []).map(s => ({
      id: s.id,
      own: Object.assign({}, s.own),
      daimyoNames: Object.fromEntries((s.daimyo || []).map(d => [d.id, d.nameJP]))
    }));
    // 大名IDの表示名は、その大名が登場しないシナリオでは引けない。
    // 「IDは合っているのに名前が解決できない」を不一致と誤判定しないよう、全シナリオ横断の辞書も返す。
    const allDaimyoNames = {};
    (DATA.scenarios || []).forEach(s => (s.daimyo || []).forEach(d => { allDaimyoNames[d.id] = d.nameJP; }));
    return { provinces, scenarios, allDaimyoNames };
  });

  await browser.close();
  server.close();

  const byName = new Map();
  dump.provinces.forEach(p => {
    if (!byName.has(p.castleName)) byName.set(p.castleName, []);
    byName.get(p.castleName).push(p);
  });

  const fails = [];
  const warns = [];
  const matchedIds = new Set();

  csvRows.forEach(r => {
    const hits = byName.get(r.castleName) || [];
    if (hits.length === 0) { fails.push(`L${r.row} ${r.castleName}: ゲーム内に存在しない`); return; }
    if (hits.length > 1) { fails.push(`L${r.row} ${r.castleName}: 同名の城が${hits.length}件`); return; }
    const g = hits[0];
    if (matchedIds.has(g.id)) { fails.push(`L${r.row} ${r.castleName}: 別の行と同じ城(${g.id})へ潰れている`); return; }
    matchedIds.add(g.id);

    if (g.provinceName !== r.provinceName) fails.push(`L${r.row} ${r.castleName}: 国名 期待=${r.provinceName} 実際=${g.provinceName}`);
    if (g.level !== r.level) fails.push(`L${r.row} ${r.castleName}: 城LV 期待=${r.level} 実際=${g.level}`);
    if (g.castleClass !== CASTLE_CLASS_FROM_JP[r.castleClass]) fails.push(`L${r.row} ${r.castleName}: 城区分 期待=${r.castleClass} 実際=${g.castleClass}`);
    const wantType = CASTLE_TYPE_FROM_JP[r.castleType];
    if (!wantType) warns.push(`L${r.row} ${r.castleName}: 城の種類「${r.castleType}」は未定義の値（平城へフォールバック）`);
    else if (g.castleType !== wantType) fails.push(`L${r.row} ${r.castleName}: 城の種類 期待=${r.castleType} 実際=${g.castleType}`);
    if (g.x !== r.x || g.y !== r.y) fails.push(`L${r.row} ${r.castleName}: 座標 期待=(${r.x},${r.y}) 実際=(${g.x},${g.y})`);

    dump.scenarios.slice(0, 6).forEach((s, i) => {
      const want = r.scenarioDaimyos[i];
      if (!want) return;
      const gotId = s.own[g.id];
      const got = gotId ? (s.daimyoNames[gotId] || dump.allDaimyoNames[gotId] || gotId) : '(なし)';
      if (got !== want && got !== want + '家' && got + '家' !== want) {
        fails.push(`L${r.row} ${r.castleName}: シナリオ${i + 1}領有 期待=${want} 実際=${got}`);
      } else if (gotId && !s.daimyoNames[gotId]) {
        warns.push(`L${r.row} ${r.castleName}: シナリオ${i + 1}の領有大名「${want}」がこのシナリオの大名一覧に不在`);
      }
    });
  });

  dump.provinces.forEach(p => {
    if (!matchedIds.has(p.id)) warns.push(`CSV外の城が残存: ${p.castleName}（${p.provinceName} / ${p.id}）`);
  });

  console.log(`CSV行数: ${csvRows.length}  ゲーム内の城: ${dump.provinces.length}  一致: ${matchedIds.size}`);
  if (pageErrors.length) {
    console.log(`\n[FAIL] pageerror ${pageErrors.length}件`);
    pageErrors.slice(0, 20).forEach(e => console.log('  - ' + e));
  } else {
    console.log('[PASS] pageerror 0件');
  }
  if (warns.length) {
    console.log(`\n[WARN] ${warns.length}件`);
    warns.forEach(w => console.log('  - ' + w));
  }
  if (fails.length) {
    console.log(`\n[FAIL] 不一致 ${fails.length}件`);
    fails.forEach(f => console.log('  - ' + f));
  } else {
    console.log('[PASS] CSVの全行がゲーム内データと一致');
  }
  process.exit(fails.length || pageErrors.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
