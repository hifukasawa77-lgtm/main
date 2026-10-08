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
 */
(function () {
  'use strict';
  var w = window;
  if (w.self === w.top) return;
  var sameOrigin = false;
  try { sameOrigin = w.top.location.origin === w.location.origin; } catch (_) { sameOrigin = false; }
  if (sameOrigin) return;
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
