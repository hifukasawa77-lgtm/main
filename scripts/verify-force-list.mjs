#!/usr/bin/env node
/*
 * verify-force-list.mjs — force_list.csv がゲーム本体に正しく取り込まれているか機械検査する
 *
 * 背景: 勢力・施設マーカーの配置は「端末の localStorage 上書き → 無ければ同梱シード
 * （MARKER_POSITION_SEED / MARKER_HIDDEN_SEED / MARKER_DAIMYO_SEED）」の順で決まる。
 * シードを更新し忘れると、PCの編集結果が初回起動の端末（スマホ）に反映されず、
 * geoToScreen() の経緯度近似へ落ちて最大900px以上ずれる。しかも例外は出ないので
 * boot検査では素通りする。ここでは localStorage が空のまっさらな状態で起動し、
 * 「CSVの全行が、ゲームが実際に描く座標・名称・支配大名と一致するか」を突き合わせる。
 *
 * 検査:
 *   1. CSVの全行がゲーム内マーカーに存在し、既定で非表示になっていない
 *   2. CSVの X,Y が実際の描画座標と一致する（丸め誤差1pxまで）
 *   3. CSVの名称・支配大名・近くの城がゲーム内の値と一致する
 *   4. CSVに無いマーカーは既定で非表示（MARKER_HIDDEN_SEED）になっている
 *   5. ゲームの書き出し（_buildForceListCsv）が force_list.csv と1バイト差なく往復する
 *   6. 拠点長を割り当てた史跡が実在武将として引ける（恵林寺=快川紹喜 / 林泉寺=天室光育）
 *   7. 上記すべてで例外0件（pageerror＋GameKitがフレーム内で捕捉した engine.errors）
 *
 * 使い方: node scripts/verify-force-list.mjs
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

function serve(root) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      // ブラウザが勝手に取りに行く favicon の404で console.error を出させない
      if (rel === 'favicon.ico') { res.writeHead(204); res.end(); return; }
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

// CSV1行 → セル配列（引用符付きフィールドに対応）
function parseLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.slice(1).map(l => {
    const c = parseLine(l);
    return { id: c[0].trim(), name: c[1].trim(), daimyo: c[2].trim(), x: Number(c[3]), y: Number(c[4]), near: (c[5] || '').trim() };
  });
}

async function main() {
  const csvPath = path.join(ROOT, 'force_list.csv');
  const rows = readCsv(csvPath);
  const { server, port } = await serve(ROOT);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push((e.stack || String(e)).split('\n').slice(0, 3).join(' | ')));

  await page.goto(`http://127.0.0.1:${port}/sengoku.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof game !== 'undefined' && game.scene && game.scene.constructor.name === 'TitleScene',
    null, { timeout: 180000 });
  // 端末上書きが無い「初回起動」の状態で見る。あるとシードではなく上書きを検査してしまう。
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    const scn = DATA.scenarios[0];
    const d = (scn.daimyo || []).find(x => x.id === 'oda') || scn.daimyo[0];
    game.changeScene(new MapScene(buildGameState(scn.id, d.id, 'normal')));
  });
  await page.waitForTimeout(2500);

  const snap = await page.evaluate(() => {
    const s = game.scene;
    const daimyos = daimyoOf(s.state).filter(d => s.state.daimyo[d.id]);
    const nameOf = id => (daimyos.find(d => d.id === id) || {}).nameJP || '';
    const collect = (arr, type) => arr.map(m => {
      const pt = type === 'rel' ? religiousForcePoint(m) : resourceMarkerPoint(m);
      const nearId = s._nearestCastleId(pt[0], pt[1]) || '';
      const nearP = nearId ? DATA.provById[nearId] : null;
      const info = s._markerDetails(type === 'rel' ? 'religious' : 'resource', m.id);
      const lead = info && info.leader;
      return {
        id: m.id, type, name: m.nameJP, deleted: isMarkerDeleted(m.id),
        x: Math.round(pt[0]), y: Math.round(pt[1]),
        daimyo: nameOf(markerDaimyoOf(m.id)),
        near: nearP ? castleNameForProvince(nearP) : '',
        leaderJP: lead ? (lead.nameJP || (lead.gen && lead.gen.nameJP) || '') : '',
        leaderGid: lead ? (lead.gid || '') : ''
      };
    });
    return {
      markers: collect(RESOURCE_MARKERS, 'res').concat(collect(RELIGIOUS_FORCES, 'rel')),
      exportCsv: s._buildForceListCsv()
    };
  });

  const framed = await page.evaluate(() =>
    (typeof game !== 'undefined' && game.errors) ? game.errors.map(r => ({ key: r.key, count: r.count })) : []
  ).catch(() => []);
  await browser.close();
  server.close();

  const byId = new Map(snap.markers.map(m => [m.id, m]));
  const fails = [];
  const warn = [];

  // 1〜3. CSVの各行がゲーム内の実値と一致するか
  rows.forEach(r => {
    const m = byId.get(r.id);
    if (!m) { fails.push(`${r.id}(${r.name}): ゲーム内に存在しない`); return; }
    if (m.deleted) { fails.push(`${r.id}(${r.name}): CSVにあるが既定で非表示`); return; }
    if (Math.abs(m.x - r.x) > 1 || Math.abs(m.y - r.y) > 1)
      fails.push(`${r.id}(${r.name}): 座標不一致 CSV=(${r.x},${r.y}) ゲーム=(${m.x},${m.y})`);
    if (m.name !== r.name) fails.push(`${r.id}: 名称不一致 CSV=${r.name} ゲーム=${m.name}`);
    if (m.daimyo !== r.daimyo) fails.push(`${r.id}(${r.name}): 支配大名不一致 CSV=${r.daimyo || '(空)'} ゲーム=${m.daimyo || '(空)'}`);
    if (m.near !== r.near) fails.push(`${r.id}(${r.name}): 近くの城 不一致 CSV=${r.near} ゲーム=${m.near}`);
  });

  // 4. CSVに無い＝一覧から削除済みのマーカーは既定で非表示か
  const csvIds = new Set(rows.map(r => r.id));
  const leaked = snap.markers.filter(m => !csvIds.has(m.id) && !m.deleted);
  leaked.forEach(m => fails.push(`${m.id}(${m.name}): CSVに無いのに表示される（MARKER_HIDDEN_SEED漏れ）`));

  // 5. 書き出し→CSVの往復一致（列の派生計算まで含めて突き合わせる）
  const norm = s => s.replace(/^﻿/, '').replace(/\r\n/g, '\n').trim();
  const expected = norm(fs.readFileSync(csvPath, 'utf8'));
  const actual = norm(snap.exportCsv);
  if (expected !== actual) {
    const el = expected.split('\n'), al = actual.split('\n');
    if (el.length !== al.length) fails.push(`書き出し行数不一致 CSV=${el.length} ゲーム=${al.length}`);
    let shown = 0;
    for (let i = 0; i < Math.min(el.length, al.length) && shown < 5; i++) {
      if (el[i] !== al[i]) { fails.push(`書き出し差異 L${i + 1}: CSV="${el[i]}" ゲーム="${al[i]}"`); shown++; }
    }
  }

  // 6. 拠点長に実在武将を割り当てた史跡
  // 恵林寺は資源マーカー側（independentSiteLeaderFor の item.leader）、
  // 林泉寺は統合先の寺社勢力側（armedForceLeader の force.leader）から引かれる。
  const expectLeaders = { erinji: ['快川紹喜', 'kaikawa_shoki'], linseiji: ['天室光育', 'tenshitsu_koiku'] };
  Object.entries(expectLeaders).forEach(([id, [jp, gid]]) => {
    const m = byId.get(id);
    if (!m) { fails.push(`${id}: マーカーが存在しない`); return; }
    if (m.leaderJP !== jp) fails.push(`${id}(${m.name}): 拠点長不一致 期待=${jp} 実際=${m.leaderJP || '(なし)'}`);
    if (m.leaderGid !== gid) fails.push(`${id}(${m.name}): 拠点長の武将ID不一致 期待=${gid} 実際=${m.leaderGid || '(なし)'}`);
  });

  // 7. 例外
  const errCount = pageErrors.length + framed.reduce((a, r) => a + r.count, 0);

  console.log('=== 戦国風雲記 勢力・施設一覧（force_list.csv）取込検査 ===');
  console.log(`  CSV行数: ${rows.length}  ゲーム内マーカー: ${snap.markers.length}  表示中: ${snap.markers.filter(m => !m.deleted).length}`);
  console.log(`  ${fails.length ? '[FAIL]' : '[PASS]'} CSVとゲーム内データの一致（座標・名称・支配大名・近くの城）`);
  console.log(`  ${expected === actual ? '[PASS]' : '[FAIL]'} 書き出し→force_list.csv の往復一致`);
  console.log(`  ${errCount ? '[FAIL]' : '[PASS]'} 例外 ${errCount}件`);
  if (fails.length) {
    console.log(`\n--- 不一致 ${fails.length}件 ---`);
    fails.slice(0, 40).forEach(f => console.log('   ✗ ' + f));
    if (fails.length > 40) console.log(`   … ほか ${fails.length - 40}件`);
  }
  if (errCount) {
    console.log('\n--- 例外 ---');
    pageErrors.forEach(e => console.log('   ✗ ' + e));
    framed.forEach(r => console.log(`   ✗ ${r.key}（${r.count}回）`));
  }
  warn.forEach(w => console.log('   ! ' + w));

  const ok = !fails.length && errCount === 0;
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] force_list.csv の取込`);
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
