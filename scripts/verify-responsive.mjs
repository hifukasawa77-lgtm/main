#!/usr/bin/env node
/*
 * verify-responsive.mjs — スマホ幅で「横にはみ出していないか」を実ブラウザで見る
 *
 * 「例外0件＝動いている」ではない。レイアウトの崩れは例外もエラーも出さずに、
 * 横スクロールが生えたり、ボタンが画面外へ出たりする形で現れる（ui-reviewer の機械側）。
 *
 * 使い方:
 *   node scripts/verify-responsive.mjs index.html shogi.html   # 指定ページ
 *   node scripts/verify-responsive.mjs --changed               # git diff で変わったHTMLだけ
 *   node scripts/verify-responsive.mjs --all                   # 直下の全HTML（時間がかかる）
 *   node scripts/verify-responsive.mjs --inject                # 故障注入: 壊したページで ✗ が出ることを確かめる
 *   node scripts/verify-responsive.mjs --all --write-baseline  # 今のはみ出しを既知として記録（scripts/responsive-baseline.json）
 *
 * 既知のはみ出し（baseline）は「悪化させない」ための棚卸し: 記録済みの量以下なら △ 既知 で通し、
 * 増えたら ❌。直したら表示される「改善済み」を見て baseline から外す（外さないと、直ったあとに再び壊れても通ってしまう）。
 *
 * 見るもの（390×844 と 768×1024 で）:
 *   1. 文書が横にはみ出さない（scrollWidth ≤ 画面幅 + 許容1px）
 *   2. <meta name="viewport"> がある（無いとスマホは980px幅として描く）
 *   3. はみ出している場合は、原因の要素（右端が画面外）を最大3つ名指しする
 * Canvas ゲームは内容が固定幅でも、ページ自体が横に伸びなければ合格（キャンバスをスクロール領域に閉じるのは実装側の仕事）。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const INJECT = args.includes('--inject');
const VIEWPORTS = [{ width: 390, height: 844, label: 'スマホ390' }, { width: 768, height: 1024, label: 'タブレット768' }];
const TOLERANCE = 1;
/** 記録済みのはみ出しに足す余裕（描画の揺れ）。これを超えて増えたら悪化 */
const BASELINE_SLACK = 2;
const BASELINE_FILE = path.join(ROOT, 'scripts', 'responsive-baseline.json');
let baseline = {};
try { baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch { baseline = {}; }
const measured = {};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

/** 故障注入で使う、メモリ上だけのページ（ファイルは作らない） */
const SYNTHETIC = {
  '/__ok.html': '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div style="width:100%;height:50px;background:#222"></div></body>',
  '/__wide.html': '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="culprit" style="width:1200px;height:50px;background:#222"></div></body>',
  '/__known.html': '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div style="width:420px;height:50px;background:#222"></div></body>',
  '/__worse.html': '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div style="width:600px;height:50px;background:#222"></div></body>',
  '/__noviewport.html': '<!doctype html><body style="margin:0"><p>x</p></body>',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (SYNTHETIC[url]) { res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(SYNTHETIC[url]); return; }
  const file = path.join(ROOT, url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

function pickPages() {
  const named = args.filter((a) => a.endsWith('.html'));
  if (named.length) return named;
  if (args.includes('--all')) return fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
  if (args.includes('--changed')) {
    const out = execSync('git diff HEAD --name-only --diff-filter=AM', { cwd: ROOT, encoding: 'utf8' });
    return out.split('\n').filter((f) => /^[^/]+\.html$/.test(f) && fs.existsSync(path.join(ROOT, f)));
  }
  return [];
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--no-sandbox'],
});

/** 1ページ・1画面幅を測る。返すのは { overflow, culprits, hasViewport } */
async function measure(url, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
    await page.waitForTimeout(300);
    return await page.evaluate((tolerance) => {
      const width = window.innerWidth;
      const doc = document.documentElement;
      const overflow = Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0) - width;
      const culprits = [];
      if (overflow > tolerance) {
        for (const el of document.querySelectorAll('body *')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.right > width + tolerance) {
            const style = getComputedStyle(el);
            if (style.position === 'fixed' || style.visibility === 'hidden' || style.display === 'none') continue;
            culprits.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}(右端${Math.round(rect.right)}px)`);
            if (culprits.length >= 3) break;
          }
        }
      }
      return { overflow, culprits, hasViewport: Boolean(document.querySelector('meta[name="viewport"]')) };
    }, TOLERANCE);
  } finally {
    await context.close();
  }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`);
};

async function inspect(label, urlPath) {
  for (const viewport of VIEWPORTS) {
    let result;
    try { result = await measure(`${BASE}${urlPath}`, viewport); } catch (e) { check(`${label} @${viewport.label}: 開ける`, false, e.message.split('\n')[0]); continue; }
    const over = Math.round(result.overflow);
    if (over > TOLERANCE) (measured[label] ??= {})[viewport.label] = over;
    const known = baseline[label]?.[viewport.label];
    if (over > TOLERANCE && known !== undefined && over <= known + BASELINE_SLACK) {
      pass++; // 既知（悪化していない）。直したら baseline から外す
      console.log(`  △ ${label} @${viewport.label}: 既知のはみ出し +${over}px（記録 +${known}px・悪化なし）`);
    } else {
      check(`${label} @${viewport.label}: 横にはみ出さない`, over <= TOLERANCE,
        over > TOLERANCE ? `+${over}px はみ出し${known !== undefined ? `（記録は +${known}px＝悪化）` : ''} 原因: ${result.culprits.join(', ') || '(特定できず)'}` : '');
      if (over <= TOLERANCE && known !== undefined) console.log(`    ↳ 改善済み: ${label} @${viewport.label} は baseline（+${known}px）から外せます`);
    }
    if (viewport === VIEWPORTS[0]) check(`${label}: viewport メタがある`, result.hasViewport);
  }
}

if (INJECT) {
  console.log('\n── 故障注入（期待: ok は ✅、wide と noviewport は ❌ になる）──');
  const before = { pass, fail };
  const results = {};
  // 記録済みの扱いも確かめる: known は記録と同じ量なので通り、worse は記録を超えるので落ちる
  baseline = { known: { 'スマホ390': 30 }, worse: { 'スマホ390': 30 } };
  for (const [name, p] of [['ok', '/__ok.html'], ['wide', '/__wide.html'], ['noviewport', '/__noviewport.html'], ['known', '/__known.html'], ['worse', '/__worse.html']]) {
    const start = fail;
    await inspect(name, p);
    results[name] = fail - start;
  }
  await browser.close(); server.close();
  const detected = results.ok === 0 && results.wide >= 1 && results.noviewport >= 1 && results.known === 0 && results.worse >= 1;
  console.log(`\n  正常ページの❌=${results.ok} / はみ出しページの❌=${results.wide} / viewport無しの❌=${results.noviewport} / 既知(悪化なし)の❌=${results.known} / 既知より悪化の❌=${results.worse}`);
  console.log(detected ? '==> 故障注入: 壊れたページを検出できる ✅' : '==> 故障注入: 検出できていない ❌（この検査は素通りする）');
  void before;
  process.exit(detected ? 0 : 1);
}

const pages = pickPages();
if (!pages.length) {
  console.log('検査するページがありません（ページ名・--changed・--all のいずれかを指定）');
  await browser.close(); server.close();
  process.exit(0);
}
for (const pageName of pages) {
  console.log(`\n── ${pageName} ──`);
  if (!fs.existsSync(path.join(ROOT, pageName))) { check(`${pageName}: 実在する`, false); continue; }
  await inspect(pageName, `/${pageName}`);
}
await browser.close(); server.close();
if (args.includes('--write-baseline')) {
  if (!args.includes('--all')) { console.log('\n--write-baseline は --all と一緒に使う（一部のページだけで記録すると、他のページの記録が消える）'); process.exit(1); }
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(measured, null, 2)}\n`);
  console.log(`\nbaseline を書きました: ${Object.keys(measured).length} ページ → scripts/responsive-baseline.json`);
  process.exit(0);
}
console.log(`\n==> verify-responsive: ${pass} 項目 ✅ / ${fail} 項目 ❌`);
process.exit(fail ? 1 : 0);
