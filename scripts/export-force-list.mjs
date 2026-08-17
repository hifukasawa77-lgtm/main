/**
 * export-force-list.mjs — ゲーム内の正準な書き出し（_buildForceListCsv）を force_list.csv へ反映する
 *
 * force_list.csv の「近くの城」列は**出力専用の派生列**で、値は `_nearestCastleId()` が
 * 座標から最近傍城を再計算して上書きする（CLAUDE.md 記載）。そのため
 * **城の座標や城名を変えると、この列だけが静かに古くなる**。
 * 実際 2026-08-13 の「Correct eight castle map positions」と城名変更（葛尾城→北信濃城）で
 * 15マーカーの近くの城が陳腐化し、verify-force-list が20件✗のまま4日間放置されていた。
 *
 * このスクリプトは「ゲームが書き出す内容」を正としてCSVを更新する。X,Y や名称を
 * **手で変えたい場合はCSV側を編集してから取り込む**のが正しく、本スクリプトは使わないこと
 * （派生列だけを追随させたいときのための道具）。
 *
 *   node scripts/export-force-list.mjs --dry-run   # 差分だけ表示
 *   node scripts/export-force-list.mjs             # force_list.csv を更新
 *
 * 実行後は必ず `node scripts/verify-force-list.mjs` で往復一致を確認する。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
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

const { server, port } = await serve(ROOT);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).split('\n')[0]));

await page.goto(`http://127.0.0.1:${port}/sengoku.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => typeof game !== 'undefined' && game.scene && game.scene.constructor.name === 'TitleScene',
  null, { timeout: 180000 });
// 端末の localStorage 上書きが乗ると「その端末だけ正しい」CSVを書き出してしまう
await page.evaluate(() => localStorage.clear());
await page.evaluate(() => {
  const scn = DATA.scenarios[0];
  const d = (scn.daimyo || []).find(x => x.id === 'oda') || scn.daimyo[0];
  game.changeScene(new MapScene(buildGameState(scn.id, d.id, 'normal')));
});
await page.waitForTimeout(2500);

const csv = await page.evaluate(() => game.scene._buildForceListCsv());
await browser.close();
server.close();

if (pageErrors.length) {
  console.error('[FAIL] pageerror が出ているため書き出しを中止する:');
  pageErrors.slice(0, 5).forEach(e => console.error('  ' + e));
  process.exit(1);
}

const target = path.join(ROOT, 'force_list.csv');
const before = fs.readFileSync(target, 'utf8');
if (before === csv) { console.log('差分なし（force_list.csv は既にゲームの書き出しと一致）'); process.exit(0); }

const bl = before.split(/\r?\n/), al = csv.split(/\r?\n/);
let shown = 0;
for (let i = 0; i < Math.max(bl.length, al.length) && shown < 30; i++) {
  if (bl[i] !== al[i]) { console.log(`L${i + 1}\n  - ${bl[i] ?? '(なし)'}\n  + ${al[i] ?? '(なし)'}`); shown++; }
}
if (DRY) { console.log(`\n--dry-run: ${shown}件の差分（適用するには --dry-run を外す）`); process.exit(0); }
fs.writeFileSync(target, csv);
console.log(`\nforce_list.csv を更新した（${shown}件の差分）。node scripts/verify-force-list.mjs で確認すること`);
