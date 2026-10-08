/* クリックジャッキング対策（サイト共通）
 *
 * GitHub Pages は HTTP ヘッダを設定できず、X-Frame-Options も CSP の frame-ancestors も
 * <meta> では無視される。そのため「別オリジンのページに枠で埋め込まれたら、最上位へ抜け出す」
 * をスクリプトで行う。読み込みは各ページの <head> 先頭（scripts/security-baseline.mjs が挿入・検査）。
 *
 * - 同じオリジンの親（例: taihei-ui-preview.html が taihei.html を枠で開く）は許可する。
 *   別オリジンの親は top.location へ触った時点で例外になるので、それで見分ける。
 * - コンテンツを隠す方式（html{display:none}）は採らない。JS無効の環境で白紙になるため。
 * - 抜け出せたかはページ側から判定できないので、透明な重ね合わせで誘導されたクリックを
 *   受け付けないよう、操作を全面で遮る（新しいタブで開くリンクだけを置く）。
 *
 * 攻撃の通報（深澤へ通知・シスログ）: ブラウザの中でしか見えない攻撃をWorkerの
 * POST /security/report へ送る（cloudflare-worker/security-monitor.js が記録・通知する）。
 * - framed        … 別オリジンの枠に入れられた（クリックジャッキングの試み）
 * - csp-violation … CSPが外部のスクリプト/枠/object の読み込み、またはイベント属性
 *                   （<img onerror=…> 型のXSS）を遮断した
 * 送るのはページのパス・遮断された先のホスト・枠の親のオリジンだけ（入力内容・クエリは送らない）。
 * 拡張機能（chrome-extension: 等）由来は送らない。1ページにつき3件まで。
 */
(function () {
  'use strict';
  var w = window;
  var SITE = 'https://hifukasawa77-lgtm.github.io';
  var REPORT_URL = w.__SECURITY_REPORT_URL ||
    (w.location.origin === SITE ? 'https://ai-proxy.hi-fukasawa77.workers.dev/security/report' : '');
  var sent = 0, seen = {};
  function hostOf(u) {
    try { var x = new URL(u, w.location.href); return x.protocol + '//' + x.host + x.pathname; } catch (_) { return String(u || '').slice(0, 40); }
  }
  function report(data) {
    if (!REPORT_URL || sent >= 3) return;
    var key = data.kind + '|' + (data.blocked || data.framer || '');
    if (seen[key]) return;
    seen[key] = 1; sent++;
    data.page = w.location.pathname;
    try {
      var body = JSON.stringify(data);
      if (!(navigator.sendBeacon && navigator.sendBeacon(REPORT_URL, body))) {
        fetch(REPORT_URL, { method: 'POST', body: body, keepalive: true, mode: 'cors', credentials: 'omit' }).catch(function () {});
      }
    } catch (_) { /* 通報できなくても遮断は効いている */ }
  }
  var WATCHED = /^(script-src|script-src-elem|script-src-attr|object-src|frame-src|child-src|base-uri|form-action)/;
  document.addEventListener('securitypolicyviolation', function (e) {
    var dir = String(e.effectiveDirective || e.violatedDirective || '');
    var blocked = String(e.blockedURI || '');
    var src = String(e.sourceFile || '');
    if (!WATCHED.test(dir)) return;
    if (/^(chrome|moz|safari(-web)?|ms-browser)-extension:/.test(blocked + ' ' + src) ||
        /-extension:/.test(src)) return;
    if (REPORT_URL && blocked.indexOf(REPORT_URL.split('/security/')[0]) === 0) return; // 通報自体の遮断で輪にしない
    var external = /^https?:/.test(blocked);
    var inlineHandler = /^script-src-attr/.test(dir) || (blocked === 'inline' && /attr/.test(String(e.violatedDirective)));
    if (!external && !inlineHandler) return; // 拡張機能が差し込むインライン<script>等の雑音は送らない
    report({ kind: 'csp-violation', directive: dir, blocked: external ? hostOf(blocked) : blocked, source: hostOf(src) });
  });

  if (w.self === w.top) return;
  var sameOrigin = false;
  try { sameOrigin = w.top.location.origin === w.location.origin; } catch (_) { sameOrigin = false; }
  if (sameOrigin) return;
  var framer = '';
  try { framer = (w.location.ancestorOrigins && w.location.ancestorOrigins[0]) || (document.referrer ? new URL(document.referrer).origin : ''); } catch (_) { framer = ''; }
  report({ kind: 'framed', framer: framer || 'unknown' });
  // 最上位へ抜け出す。ただし sandbox や、Chrome の「操作無しの別オリジン iframe から最上位を
  // 遷移させない」制限では、例外も出さずに無視されることがある（成功したかは分からない）。
  // そのため抜け出しを試みたうえで、常に操作を全面で遮る（遷移できればページごと消える）
  try { w.top.location.replace(w.location.href); } catch (_) { /* sandbox 等 */ }
  var block = function () {
    if (!document.body || document.getElementById('frame-guard-block')) return;
    var d = document.createElement('div');
    d.id = 'frame-guard-block';
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;color:#fff;' +
      'display:flex;align-items:center;justify-content:center;text-align:center;padding:16px;font:16px sans-serif';
    var a = document.createElement('a');
    a.href = w.location.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.color = '#22d3ee';
    a.textContent = 'このページは埋め込みでは開けません。新しいタブで開く / Open in a new tab';
    d.appendChild(a);
    document.body.appendChild(d);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', block);
  else block();
})();
