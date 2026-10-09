#!/usr/bin/env node
// サイト全ページのセキュリティ基礎線（baseline）を挿入・検査する。
//
//   node scripts/security-baseline.mjs           # 検査（不足があれば exit 1）
//   node scripts/security-baseline.mjs --write   # 不足を自動で補う（既存のCSPは削らず、足りない指令だけ足す）
//   node scripts/security-baseline.mjs --inject  # 防御を壊したコピーで ✗ が出ることを確かめる（故障注入）
//
// 基礎線（全HTMLページ・リポジトリ直下）:
//   1. CSP の meta があり、object-src 'none' / base-uri / form-action を持つ
//      （無いページには「既存の動作を変えない」最小のCSPを入れる。script-src は触らない＝
//       インラインの onclick 等を多用するゲームを壊さない。厳格なCSPは security-csp.mjs の5ページ）
//   2. CSP がスクリプトの読み込み元として 'self' を許している（frame-guard.js が読めないと無言で効かない）
//   3. クリックジャッキング対策（assets/js/frame-guard.js）が <head> にある
//   4. Referrer-Policy の meta がある（URLに載せた状態を外部サイトへ漏らさない）
//   5. target="_blank" のリンクは rel に noopener を持つ
//   6. http:// のスクリプト・スタイルシート・iframe を読み込まない（混在コンテンツ＝改ざん経路）
//
// GitHub Pages は HTTP ヘッダを付けられないため、ここで見るのは meta で効くものだけ。
// frame-ancestors / X-Frame-Options / Permissions-Policy は meta では無視されるので入れない
// （入れて「対応済み」と見せるのが一番いけない）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_CSP = "object-src 'none'; base-uri 'self'; form-action 'self'";
// frame-guard.js が攻撃を通報する先（cloudflare-worker/security-monitor.js の /security/report）。
// connect-src を絞っているページで塞がれると、通報が例外も出さずに届かなくなる
export const REPORT_ORIGIN = 'https://ai-proxy.hi-fukasawa77.workers.dev';
function allowsReport(d) {
  const c = d.get('connect-src') || d.get('default-src');
  return !c || c.includes('https:') || c.includes('*') || c.includes(REPORT_ORIGIN);
}
const REFERRER = '<meta name="referrer" content="strict-origin-when-cross-origin">';
const GUARD_TAG = '<script src="assets/js/frame-guard.js"></script>';
const CSP_RE = /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i;

export function listPages() {
  return fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
}

function cspContent(html) {
  const m = html.match(CSP_RE);
  if (!m) return null;
  const c = m[0].match(/content=(["'])([\s\S]*?)\1/i);
  return c ? c[2] : '';
}

function directives(csp) {
  const map = new Map();
  for (const part of csp.split(';')) {
    const t = part.trim().split(/\s+/).filter(Boolean);
    if (t.length) map.set(t[0].toLowerCase(), t.slice(1));
  }
  return map;
}

function hasFrameGuard(html) {
  const head = html.split(/<\/head>/i)[0];
  // 旧インライン版（if (self !== top) top.location = …）は認めない。Chrome は操作無しの
  // 別オリジン枠からの最上位遷移を例外も出さずに止めるので、それだけでは何も守れない
  return /<script\b[^>]*src=["'](?:\.\/)?assets\/js\/frame-guard\.js["']/i.test(head);
}

/** 1ページ分の不足を返す（空配列＝基礎線を満たす） */
export function auditPage(html) {
  const problems = [];
  const csp = cspContent(html);
  if (csp === null) problems.push('CSP の meta が無い');
  else {
    const d = directives(csp);
    const obj = d.get('object-src') || d.get('default-src');
    if (!obj || obj.join(' ') !== "'none'") problems.push("object-src 'none' が無い（<object>/<embed> 経由の実行を塞げない）");
    if (!d.has('base-uri')) problems.push('base-uri が無い（<base> 差し込みで相対URLの行き先を乗っ取られる）');
    if (!d.has('form-action')) problems.push('form-action が無い（差し込まれたフォームで外部へ送信される）');
    const script = d.get('script-src') || d.get('default-src');
    if (script && !script.includes("'self'")) problems.push("script-src が 'self' を許していない（frame-guard.js が読めない）");
    if (!allowsReport(d)) problems.push('connect-src が攻撃の通報先（' + REPORT_ORIGIN + '）を塞いでいる（通報が無言で届かない）');
  }
  if (!hasFrameGuard(html)) problems.push('クリックジャッキング対策（frame-guard.js）が <head> に無い');
  if (!/<meta\b[^>]*name=["']referrer["']/i.test(html)) problems.push('Referrer-Policy の meta が無い');
  for (const a of html.match(/<a\b[^>]*\btarget=["']_blank["'][^>]*>/gi) || []) {
    const rel = (a.match(/\brel=["']([^"']*)["']/i) || [])[1] || '';
    if (!/\bnoopener\b/i.test(rel) && !/\bnoreferrer\b/i.test(rel)) problems.push('rel="noopener" の無い target="_blank": ' + a.slice(0, 120));
  }
  for (const tag of html.match(/<(?:script|iframe)\b[^>]*\bsrc=["']http:\/\/[^"']*["'][^>]*>|<link\b[^>]*\bhref=["']http:\/\/[^"']*["'][^>]*>/gi) || []) {
    if (/<link\b/i.test(tag) && !/rel=["'][^"']*stylesheet/i.test(tag)) continue;
    problems.push('http:// で読み込んでいる: ' + tag.slice(0, 120));
  }
  return problems;
}

/** 不足を補ったHTMLを返す。既存の指令・値は変えない（足すだけ） */
export function applyBaseline(html) {
  let out = html;
  const csp = cspContent(out);
  if (csp === null) {
    const meta = `<meta http-equiv="Content-Security-Policy" content="${BASELINE_CSP}">`;
    out = insertAfterCharset(out, meta);
  } else {
    const d = directives(csp);
    const add = [];
    if (!d.has('object-src')) add.push("object-src 'none'");
    if (!d.has('base-uri')) add.push("base-uri 'self'");
    if (!d.has('form-action')) add.push("form-action 'self'");
    let next = csp;
    if (!allowsReport(d)) {
      // 通報先の1ホストだけを足す（https: 全体へは広げない）
      next = d.has('connect-src')
        ? next.replace(/(connect-src\b[^;]*?)\s*(;|$)/i, `$1 ${REPORT_ORIGIN}$2`)
        : next.trim().replace(/;\s*$/, '') + `; connect-src ${[...d.get('default-src').filter(v => v !== "'none'"), REPORT_ORIGIN].join(' ')};`;
    }
    if (add.length) {
      const trimmed = next.trim().replace(/;\s*$/, '');
      next = (trimmed ? trimmed + '; ' : '') + add.join('; ') + ';';
    }
    if (next !== csp) out = out.replace(CSP_RE, tag => tag.replace(csp, next));
  }
  if (!/<meta\b[^>]*name=["']referrer["']/i.test(out)) out = insertAfterCsp(out, REFERRER);
  if (!hasFrameGuard(out)) out = insertAfterCsp(out, GUARD_TAG);
  return out;
}

function lineIndentAt(html, idx) {
  const lineStart = html.lastIndexOf('\n', idx - 1) + 1;
  return (html.slice(lineStart, idx).match(/^[ \t]*/) || [''])[0];
}

function insertAfterTag(html, re, snippet) {
  const m = re.exec(html);
  if (!m) return null;
  const end = m.index + m[0].length;
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  // 1行に詰めて書かれたページ（タグの直後に改行が無い）は改行を足さずに続ける
  if (!html.startsWith(nl, end)) return html.slice(0, end) + snippet + html.slice(end);
  return html.slice(0, end) + nl + lineIndentAt(html, m.index) + snippet + html.slice(end);
}

function insertAfterCharset(html, snippet) {
  return insertAfterTag(html, /<meta\b[^>]*charset=[^>]*>/i, snippet) ??
    insertAfterTag(html, /<head\b[^>]*>/i, snippet) ??
    insertAfterTag(html, /<html\b[^>]*>/i, snippet) ?? snippet + html;
}

function insertAfterCsp(html, snippet) {
  return insertAfterTag(html, CSP_RE, snippet) ?? insertAfterCharset(html, snippet);
}

// ---- 故障注入: 防御を1つずつ壊し、検査が必ず拾うことを確かめる -------------------------
function inject() {
  const good = applyBaseline('<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>' +
    '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a></body></html>');
  const cases = [
    ['CSP を丸ごと消す', h => h.replace(CSP_RE, '')],
    ["object-src を消す", h => h.replace("object-src 'none'; ", '')],
    ['base-uri を消す', h => h.replace("base-uri 'self'; ", '')],
    ['form-action を消す', h => h.replace("; form-action 'self'", '')],
    ["script-src から 'self' を外す", h => h.replace("object-src 'none'", "script-src https://cdn.example; object-src 'none'")],
    ['frame-guard を消す', h => h.replace(GUARD_TAG, '')],
    ['frame-guard を旧インライン版（Chromeで効かない）に戻す', h => h.replace(GUARD_TAG, '<script>if (self !== top) { top.location = self.location; }</script>')],
    ['frame-guard を body へ移す', h => h.replace(GUARD_TAG, '').replace('</body>', GUARD_TAG + '</body>')],
    ['referrer を消す', h => h.replace(REFERRER, '')],
    ['noopener を外す', h => h.replace(' rel="noopener noreferrer"', '')],
    ['http:// のスクリプト', h => h.replace('</head>', '<script src="http://cdn.example/x.js"></script></head>')],
    ['connect-src で通報先を塞ぐ', h => h.replace("object-src 'none'", "connect-src 'self'; object-src 'none'")],
    ['http:// のスタイルシート', h => h.replace('</head>', '<link rel="stylesheet" href="http://cdn.example/x.css"></head>')],
  ];
  let ok = auditPage(good).length === 0;
  console.log((ok ? '✅' : '❌') + ' 基準: 補ったページは問題0件' + (ok ? '' : ' → ' + auditPage(good).join(' / ')));
  for (const [name, broke] of cases) {
    const bad = broke(good);
    const caught = bad !== good && auditPage(bad).length > 0;
    console.log((caught ? '✅' : '❌') + ' 注入: ' + name + (caught ? ' → 検出' : ' → すり抜けた'));
    ok = ok && caught;
  }
  // 既存CSPの値を変えずに足すだけか（厳格なCSPを緩めないこと）
  const strict = `<head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'sha256-abc';"></head>`;
  const applied = applyBaseline(strict);
  const kept = applied.includes("default-src 'none'; script-src 'self' 'sha256-abc'; connect-src " + REPORT_ORIGIN +
    "; object-src 'none'; base-uri 'self'; form-action 'self';");
  console.log((kept ? '✅' : '❌') + ' 既存CSPは値を変えず、足りない指令だけ足す');
  ok = ok && kept;
  const twice = applyBaseline(applied) === applied;
  console.log((twice ? '✅' : '❌') + ' 2回かけても変わらない（冪等）');
  ok = ok && twice;
  if (!ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--inject')) { inject(); }
  else {
    const write = process.argv.includes('--write');
    let failed = 0, changed = 0;
    const pages = listPages();
    for (const page of pages) {
      const file = path.join(ROOT, page);
      let html = fs.readFileSync(file, 'utf8');
      if (write) {
        const next = applyBaseline(html);
        if (next !== html) { fs.writeFileSync(file, next); changed++; html = next; }
      }
      const problems = auditPage(html);
      if (problems.length) {
        failed++;
        console.error(`❌ ${page}`);
        for (const p of problems) console.error('   - ' + p);
      }
    }
    if (write) console.log(`補った: ${changed} ページ`);
    if (failed) {
      console.error(`\n${failed}/${pages.length} ページが基礎線を満たしていません。` +
        (write ? '（自動で補えない項目です。手で直してください）' : ' node scripts/security-baseline.mjs --write で補えます'));
      process.exitCode = 1;
    } else console.log(`✅ セキュリティ基礎線: ${pages.length} ページすべて合格`);
  }
}
