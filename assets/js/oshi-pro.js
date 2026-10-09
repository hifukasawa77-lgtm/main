/*
 * oshi-pro.js — 推し活ログ Pro（有料版）の純粋ロジック
 *
 * ブラウザ（oshikatsu.html の <script>）と Node（scripts/oshi-license.mjs・検査）で共用する UMD。
 * 画面には触らない。キーの検証・レポートの集計・カードの描画（渡された ctx へ）だけを持つ。
 *
 * ■ ライセンスキーの仕組み
 *   OSHI-PRO-<payload(base64url JSON)>.<署名(base64url, ECDSA P-256 / SHA-256, 64バイト)>
 *   - 検証は**端末内だけ**（WebCrypto）。どこにも送信しない＝オフラインでも使える・個人情報を集めない
 *   - 公開鍵しかページに無いので、キーを偽造するには秘密鍵が要る（秘密鍵はリポジトリに置かない）
 *   - 署名の対象は「OSHI-PRO-<payload>」。接頭辞ごと署名するので、別製品のキーを流用できない
 *   - 正直な限界: ページのJSを書き換えれば解除は回避できる（静的サイトの宿命）。守っているのは
 *     「キーの偽造・使い回しの改変」まで。買い切り数百円の商品で、それ以上の重さは利用者の負担になる
 *
 * ■ 公開鍵は scripts/oshi-license.mjs init が下の @@PUBKEY 行を書き換える（手で編集しない）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OshiPro = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRODUCT = 'oshikatsu-pro';
  var KEY_PREFIX = 'OSHI-PRO-';
  var KEY_MAX = 600;
  // @@PUBKEY_BEGIN@@
  var PUBLIC_KEY_JWK = null;
  // @@PUBKEY_END@@
  // 流出したキーのID（payload.id）。ここに足して公開すると、そのキーは次回起動から無効になる
  var REVOKED_IDS = [];
  // 販売ページ（BOOTH等）のURL。空のあいだは「販売準備中」と表示する
  var STORE_URL = '';
  var PRICE_LABEL = '¥980（買い切り）';

  var REASONS = {
    'empty': 'ライセンスキーを入力してください',
    'format': 'キーの形式が正しくありません（コピー漏れ・余分な文字がないか確認してください）',
    'product': 'このアプリのキーではありません',
    'signature': 'キーを確認できませんでした（1文字でも違うと無効になります）',
    'revoked': 'このキーは無効化されています。購入先のメッセージからご連絡ください',
    'not-ready': 'Pro版はまだ販売準備中です',
    'no-crypto': 'このブラウザでは確認できません（https のページで開いてください）'
  };

  // ---------------------------------------------------------------- base64url
  var B64U = /^[A-Za-z0-9_-]+$/;
  function b64uToBytes(s) {
    if (typeof s !== 'string' || !s || !B64U.test(s)) return null;
    var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin;
    try { bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary'); } catch (e) { return null; }
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64u(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function utf8(s) { return new TextEncoder().encode(s); }
  function fromUtf8(b) { return new TextDecoder('utf-8', { fatal: true }).decode(b); }

  // ---------------------------------------------------------------- キーの検証
  // 貼り付けで混ざる空白・改行・全角ハイフンは許す（購入者が手で直せない）
  function normalizeKey(raw) {
    return String(raw == null ? '' : raw).replace(/[\s　]+/g, '').replace(/[‐－―ー−]/g, '-');
  }
  function parseKey(raw) {
    var k = normalizeKey(raw);
    if (!k) return { ok: false, reason: 'empty' };
    if (k.length > KEY_MAX || k.indexOf(KEY_PREFIX) !== 0) return { ok: false, reason: 'format' };
    var body = k.slice(KEY_PREFIX.length), dot = body.indexOf('.');
    if (dot < 1 || body.indexOf('.', dot + 1) !== -1) return { ok: false, reason: 'format' };
    var pBytes = b64uToBytes(body.slice(0, dot)), sig = b64uToBytes(body.slice(dot + 1));
    if (!pBytes || !sig || sig.length !== 64) return { ok: false, reason: 'format' };
    var payload;
    try { payload = JSON.parse(fromUtf8(pBytes)); } catch (e) { return { ok: false, reason: 'format' }; }
    if (!payload || typeof payload !== 'object') return { ok: false, reason: 'format' };
    if (payload.p !== PRODUCT || payload.v !== 1) return { ok: false, reason: 'product' };
    if (typeof payload.id !== 'string' || !/^[A-Za-z0-9_-]{6,40}$/.test(payload.id)) return { ok: false, reason: 'format' };
    if (typeof payload.lot !== 'string' || !/^[A-Za-z0-9_.-]{1,24}$/.test(payload.lot)) return { ok: false, reason: 'format' };
    return { ok: true, key: k, signed: KEY_PREFIX + body.slice(0, dot), sig: sig, payload: payload };
  }

  // opts: { jwk, subtle, revoked }。検査は jwk / subtle を差し替えて通す
  function verifyKey(raw, opts) {
    opts = opts || {};
    var jwk = opts.jwk || PUBLIC_KEY_JWK;
    var revoked = opts.revoked || REVOKED_IDS;
    var parsed = parseKey(raw);
    if (!parsed.ok) return Promise.resolve(parsed);
    if (!jwk) return Promise.resolve({ ok: false, reason: 'not-ready' });
    var subtle = opts.subtle || (typeof crypto !== 'undefined' && crypto.subtle);
    if (!subtle) return Promise.resolve({ ok: false, reason: 'no-crypto' });
    return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
      .then(function (key) {
        return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, parsed.sig, utf8(parsed.signed));
      })
      .then(function (good) {
        if (!good) return { ok: false, reason: 'signature' };
        // 署名が正しいものだけ失効を見る（偽のキーに「無効化されています」と答えて ID の存在を教えない）
        if (revoked.indexOf(parsed.payload.id) !== -1) return { ok: false, reason: 'revoked' };
        return { ok: true, key: parsed.key, id: parsed.payload.id, lot: parsed.payload.lot };
      }, function () { return { ok: false, reason: 'signature' }; });
  }
  function reasonText(r) { return REASONS[r] || REASONS.signature; }

  // ---------------------------------------------------------------- 色（メンカラ）
  function hexToRgb(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(c, t, f) { return [c[0] + (t[0] - c[0]) * f, c[1] + (t[1] - c[1]) * f, c[2] + (t[2] - c[2]) * f]; }
  function lum(c) {
    var a = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(a, b) { var la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
  // 背景に対して文字として読める濃さ（コントラスト比 >= min）まで寄せる。
  // 黄色やミントの推し色をそのまま文字色にすると、白地で読めなくなる（例外は出ない）
  function readable(c, bg, min) {
    var target = lum(bg) > 0.5 ? [0, 0, 0] : [255, 255, 255];
    for (var f = 0; f <= 1.0001; f += 0.05) { var t = mix(c, target, f); if (contrast(t, bg) >= min) return t; }
    return target;
  }
  // ページの CSS 変数へ当てる値。dark=true はダークテーマ用
  function accentVars(hex, dark) {
    var c = hexToRgb(hex);
    if (!c) return null;
    var bg = dark ? [15, 23, 42] : [255, 255, 255];
    var text = readable(c, bg, 4.5), hover = readable(mix(text, dark ? [255, 255, 255] : [0, 0, 0], 0.12), bg, 4.5);
    var soft = mix(c, [255, 255, 255], dark ? 0.15 : 0.45);
    var btnFrom = readable(soft, [255, 255, 255], 3), btnTo = readable(c, [255, 255, 255], 3); // ボタンは白文字
    return {
      '--accent': rgbToHex(text),
      '--accent-hover': rgbToHex(hover),
      '--accent-2': rgbToHex(dark ? c : soft),
      '--btn-grad': 'linear-gradient(135deg, ' + rgbToHex(btnFrom) + ', ' + rgbToHex(btnTo) + ')',
      '--bar-grad': 'linear-gradient(90deg, ' + rgbToHex(soft) + ', ' + rgbToHex(c) + ')',
      '--badge-fg': rgbToHex(text),
      '--blob-1': 'rgba(' + c.map(Math.round).join(', ') + ', 0.32)'
    };
  }

  // ---------------------------------------------------------------- 集計
  // 入力はページ側で期間を絞り込み済みのもの（期間・参戦判定の正本はページに一本化する）
  // d = { mode:'month'|'year'|'all', label, oshiList, rows(出費), attended(参戦済イベント), cats:[{k,color,icon}], spotsVisited }
  function buildReport(d) {
    var oshiList = d.oshiList || [], rows = d.rows || [], attended = d.attended || [];
    var byId = {}; oshiList.forEach(function (o) { byId[o.id] = o; });
    var total = 0, oshiAmt = {}, catAmt = {}, months = {};
    rows.forEach(function (r) {
      var a = Number(r.amount) || 0; total += a;
      var k = byId[r.oshiId] ? r.oshiId : ''; oshiAmt[k] = (oshiAmt[k] || 0) + a;
      catAmt[r.category] = (catAmt[r.category] || 0) + a;
      var m = String(r.date || '').slice(0, 7); months[m] = (months[m] || 0) + a;
    });
    var byOshi = Object.keys(oshiAmt).map(function (k) {
      var o = byId[k];
      return { id: k, name: o ? o.name : '箱推し・共通', color: o ? o.color : '#94a3b8', avatar: o ? o.avatar : '', amount: oshiAmt[k] };
    }).sort(function (a, b) { return b.amount - a.amount; });
    var catColor = {}; (d.cats || []).forEach(function (c) { catColor[c.k] = c; });
    var byCat = Object.keys(catAmt).map(function (k) {
      return { name: k, color: (catColor[k] && catColor[k].color) || '#cbd5e1', icon: (catColor[k] && catColor[k].icon) || '✨', amount: catAmt[k] };
    }).sort(function (a, b) { return b.amount - a.amount; });
    var top = attended.slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0) || (a.date < b.date ? 1 : -1); })[0] || null;
    var busiest = Object.keys(months).sort(function (a, b) { return months[b] - months[a]; })[0] || '';
    var oshiShown = byOshi.filter(function (o) { return o.id; });
    return {
      mode: d.mode || 'month', label: String(d.label || ''), total: total, count: rows.length,
      events: attended.length, spots: d.spotsVisited || 0,
      byOshi: byOshi, byCat: byCat, topOshi: oshiShown[0] || (oshiList[0] ? { name: oshiList[0].name, color: oshiList[0].color, avatar: oshiList[0].avatar } : null),
      topEvent: top ? { name: top.name, date: top.date, venue: top.venue || '', rating: top.rating || 0 } : null,
      busiestMonth: busiest, busiestAmount: busiest ? months[busiest] : 0, months: months
    };
  }

  // ---------------------------------------------------------------- カード描画
  var TEMPLATES = [
    { id: 'pastel', name: 'パステル', en: 'Pastel', pro: false },
    { id: 'menkara', name: 'メンカラ', en: 'Member color', pro: true },
    { id: 'night', name: 'ペンライトの夜', en: 'Penlight night', pro: true },
    { id: 'cheki', name: 'チェキ風', en: 'Instant photo', pro: true },
    { id: 'mono', name: 'モノクロ上品', en: 'Monochrome', pro: true }
  ];
  var SIZES = { post: { w: 1080, h: 1350, name: '投稿 4:5' }, story: { w: 1080, h: 1920, name: 'ストーリー 9:16' } };
  var FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic UI","Yu Gothic",system-ui,sans-serif';
  var WATERMARK = '推し活ログで記録中 ♡  hideの部屋';
  var WATERMARK_URL = 'hifukasawa77-lgtm.github.io/main/oshikatsu.html';

  function isPro(id) { for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i].pro; return true; }
  function palette(tpl, accent) {
    var c = hexToRgb(accent) || [236, 72, 153];
    switch (tpl) {
      case 'menkara': return { bg1: rgbToHex(mix(c, [255, 255, 255], 0.55)), bg2: rgbToHex(mix(c, [255, 255, 255], 0.15)), card: 'rgba(255,255,255,0.86)', text: '#2b2140', sub: '#6b5d84', accent: rgbToHex(readable(c, [255, 255, 255], 4.5)), deco: 'rgba(255,255,255,0.55)' };
      case 'night': return { bg1: '#0b1026', bg2: '#25184a', card: 'rgba(255,255,255,0.08)', text: '#f8fafc', sub: '#b4bdd6', accent: rgbToHex(readable(c, [11, 16, 38], 4.5)), deco: rgbToHex(c), dark: true };
      case 'cheki': return { bg1: '#f3efe7', bg2: '#e9e2d4', card: '#ffffff', text: '#2a2a2a', sub: '#6d6a63', accent: rgbToHex(readable(c, [255, 255, 255], 4.5)), deco: 'rgba(0,0,0,0.06)' };
      case 'mono': return { bg1: '#fafafa', bg2: '#e9e9ee', card: '#ffffff', text: '#18181b', sub: '#63636b', accent: '#18181b', deco: 'rgba(0,0,0,0.05)' };
      default: return { bg1: '#fff1f7', bg2: '#ede7ff', card: 'rgba(255,255,255,0.88)', text: '#3b2a5a', sub: '#7d6e99', accent: '#db2777', deco: 'rgba(244,114,182,0.25)' };
    }
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // 長い推し名・イベント名は縮めてから「…」で切る（はみ出すと隣の数字に重なる）
  function fitText(ctx, text, maxW, size, weight, minSize) {
    text = String(text == null ? '' : text);
    var s = size;
    for (; s > (minSize || size * 0.6); s -= 2) { ctx.font = (weight || 700) + ' ' + s + 'px ' + FONT; if (ctx.measureText(text).width <= maxW) return text; }
    ctx.font = (weight || 700) + ' ' + s + 'px ' + FONT;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }
  function yenStr(n) { return '¥' + (Math.round(Number(n) || 0)).toLocaleString('ja-JP'); }
  function ymJa(ym) { var m = /^(\d{4})-(\d{2})$/.exec(ym || ''); return m ? (Number(m[2]) + '月') : ''; }

  // opts: { tpl, size, showAmounts, watermark, pro, preview, avatarImg(HTMLImageElement|null) }
  // 無料版で Pro のデザイン・年間/累計を選んだとき:
  //   preview=true なら「SAMPLE」の透かしを全面に重ねて見本として描く（買う前に完成形を見せる）
  //   preview=false なら無料のデザインに落とす
  // 戻り値 { tpl, watermark, sample }。sample=true の画像は保存させない（ページ側の責務）
  function needsPro(tpl, mode) { return isPro(tpl) || (mode && mode !== 'month'); }
  var CHEER = {
    month: ['今月も推しに生かされました♡', '推しがいる毎日、最高。', '今月もよく推しました！えらい！'],
    year: ['今年も推しのおかげで生きのびた♡', '推しと過ごした1年に、ありがとう。'],
    all: ['ずっと推してる。これからも。', '推しは人生。']
  };
  function cheer(rep) { var a = CHEER[rep.mode] || CHEER.month; return a[(rep.count + rep.events) % a.length]; }

  function drawCard(ctx, rep, opts) {
    opts = opts || {};
    var story = opts.size === 'story', size = story ? SIZES.story : SIZES.post, W = size.w, H = size.h;
    var tpl = opts.tpl || 'pastel';
    if (TEMPLATES.every(function (t) { return t.id !== tpl; })) tpl = 'pastel';
    var sample = !opts.pro && needsPro(tpl, rep.mode) && !!opts.preview;
    if (!opts.pro && isPro(tpl) && !sample) tpl = 'pastel';
    var watermark = opts.pro ? opts.watermark !== false : true; // 無料版は必ず入れる
    var amt = opts.showAmounts !== false;
    var P = palette(tpl, rep.topOshi && rep.topOshi.color);
    var money = function (n) { return amt ? yenStr(n) : Math.round(n * 100 / (rep.total || 1)) + '%'; };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    // ---- 背景
    var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (tpl === 'night') { // ペンライトの海
      for (var i = 0; i < 120; i++) {
        var x = (i * 137.5) % W, y = H * 0.62 + ((i * 89) % (H * 0.38)), c = i % 3;
        ctx.globalAlpha = 0.18 + (i % 5) * 0.1; ctx.fillStyle = c === 0 ? '#ffffff' : P.deco;
        ctx.beginPath(); ctx.arc(x, y, 2 + (i % 4) * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (tpl !== 'mono' && tpl !== 'cheki') {
      ctx.fillStyle = P.deco;
      ctx.beginPath(); ctx.arc(W * 0.95, H * 0.04, 230, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W * 0.02, H * 0.93, 190, 0, Math.PI * 2); ctx.fill();
    }

    function avatarAt(cx, cy, r, ring) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = (rep.topOshi && rep.topOshi.color) || '#f472b6'; ctx.fill();
      var im = opts.avatarImg;
      if (im && im.complete && im.naturalWidth) { ctx.clip(); ctx.drawImage(im, cx - r, cy - r, r * 2, r * 2); }
      else { ctx.fillStyle = '#ffffff'; ctx.font = '800 ' + Math.round(r * 0.95) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(String((rep.topOshi && rep.topOshi.name) || '♡').charAt(0), cx, cy + r * 0.34); }
      ctx.restore();
      if (ring) { ctx.lineWidth = Math.max(4, r * 0.08); ctx.strokeStyle = ring; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
    }
    function panel(x, y, w, h) { if (tpl === 'cheki') return; ctx.fillStyle = P.card; rr(ctx, x, y, w, h, 30); ctx.fill(); }
    function label(t, x, y, s) { ctx.fillStyle = P.sub; ctx.font = '700 ' + (s || 32) + 'px ' + FONT; ctx.fillText(t, x, y); }

    var M = 64, top = 70, bottom = H - (watermark ? 150 : 110);
    var blocks = [];
    var kicker = rep.mode === 'year' ? 'MY OSHIKATSU YEAR' : (rep.mode === 'all' ? 'MY OSHIKATSU HISTORY' : 'MY OSHIKATSU REPORT');
    var title = rep.mode === 'year' ? rep.label + 'の推し活まとめ' : (rep.mode === 'all' ? '推し活のあゆみ' : rep.label + 'の推し活');

    if (tpl === 'cheki') {
      // チェキ風: 白い台紙・上に大きな「写真」・下に手書き風のひとこと
      var fx = 54, fy = 54, fw = W - 108, fh = H - 108;
      ctx.shadowColor = 'rgba(0,0,0,0.20)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 12;
      ctx.fillStyle = '#ffffff'; rr(ctx, fx, fy, fw, fh, 10); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      var px = fx + 46, py = fy + 46, pw = fw - 92, ph = Math.round(pw * (story ? 1.15 : 0.78));
      var pg = ctx.createLinearGradient(px, py, px + pw, py + ph);
      var oc = hexToRgb(rep.topOshi && rep.topOshi.color) || [244, 114, 182];
      pg.addColorStop(0, rgbToHex(mix(oc, [255, 255, 255], 0.55))); pg.addColorStop(1, rgbToHex(mix(oc, [40, 20, 60], 0.15)));
      ctx.fillStyle = pg; ctx.fillRect(px, py, pw, ph);
      for (var s2 = 0; s2 < 26; s2++) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff'; ctx.font = '700 ' + (20 + (s2 % 4) * 8) + 'px ' + FONT; ctx.fillText(s2 % 2 ? '✦' : '♡', px + (s2 * 157) % pw, py + 40 + (s2 * 97) % (ph - 40)); }
      ctx.globalAlpha = 1;
      var ar = Math.min(pw, ph) * 0.3;
      avatarAt(px + pw / 2, py + ph * 0.44, ar, '#ffffff');
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 12;
      ctx.fillText(fitText(ctx, rep.topOshi ? rep.topOshi.name : '推し', pw - 80, 64, 800, 36), px + pw / 2, py + ph * 0.44 + ar + 86);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      ctx.font = '700 30px ' + FONT; ctx.fillText(kicker, px + pw / 2, py + 56);
      ctx.textAlign = 'left';
      // 下の余白（手書き欄）
      var cy0 = py + ph + 30, cx0 = px, cw0 = pw;
      ctx.fillStyle = P.text; ctx.fillText(fitText(ctx, title, cw0, 54, 800, 34), cx0, cy0 + 56);
      var line2 = (amt ? yenStr(rep.total) : '') + (amt ? '  ·  ' : '') + '参戦 ' + rep.events + '回' + (rep.spots ? '  ·  巡礼 ' + rep.spots + 'か所' : '');
      ctx.fillStyle = P.accent; ctx.fillText(fitText(ctx, line2, cw0, 48, 800, 30), cx0, cy0 + 130);
      var cats = rep.byCat.slice(0, story ? 5 : 2), yy = cy0 + 190;
      cats.forEach(function (c) {
        ctx.fillStyle = P.sub; ctx.fillText(fitText(ctx, c.icon + ' ' + c.name + '  ' + money(c.amount), cw0, 32, 700, 24), cx0, yy); yy += 50;
      });
      var msg = rep.topEvent ? '★ ' + rep.topEvent.name : cheer(rep);
      if (yy < fy + fh - (watermark ? 130 : 60)) { ctx.fillStyle = P.text; ctx.fillText(fitText(ctx, msg, cw0, 36, 700, 24), cx0, Math.max(yy + 10, fy + fh - (watermark ? 140 : 70))); }
      bottom = fy + fh;
    } else {
      // ---- ブロックを並べ、余白を均等に配る（データが少ない月でも下半分が空かない）
      blocks.push({ h: 130, draw: function (y) {
        label(kicker, M, y + 34, 32);
        ctx.fillStyle = P.text; ctx.fillText(fitText(ctx, title, W - M * 2, 76, 800, 44), M, y + 118);
      } });
      if (rep.topOshi) blocks.push({ h: 150, draw: function (y) {
        var r = 68; avatarAt(M + r, y + r + 6, r, P.dark ? 'rgba(255,255,255,0.7)' : '#ffffff');
        label(rep.mode === 'month' ? '今月いちばん推した' : 'いちばん推した', M + r * 2 + 30, y + 60, 32);
        ctx.fillStyle = P.text; ctx.fillText(fitText(ctx, rep.topOshi.name, W - M * 2 - r * 2 - 40, 58, 800, 34), M + r * 2 + 30, y + 128);
      } });
      blocks.push({ h: 200, draw: function (y) {
        var cw = (W - M * 2 - 24) / 2;
        [['推しに使った', amt ? yenStr(rep.total) : '—', ''], ['参戦', String(rep.events), '回']].forEach(function (s, k) {
          var x = M + k * (cw + 24);
          panel(x, y, cw, 200);
          label(s[0], x + 32, y + 58, 32);
          ctx.fillStyle = P.accent; var v = fitText(ctx, s[1], cw - 64 - (s[2] ? 50 : 0), 84, 800, 40); ctx.fillText(v, x + 32, y + 160);
          if (s[2]) { var vw = ctx.measureText(v).width; label(s[2], x + 40 + vw, y + 160, 38); }
        });
      } });
      var oshiRows = rep.byOshi.filter(function (o) { return o.amount > 0; }).slice(0, story ? 4 : 3);
      if (oshiRows.length >= 2) blocks.push({ h: 86 + oshiRows.length * 70, draw: function (y) {
        panel(M, y, W - M * 2, 86 + oshiRows.length * 70 - 10);
        label('推し別', M + 32, y + 56, 32);
        var maxA = oshiRows[0].amount || 1, yy = y + 112, bx = M + 330, bw = W - M * 2 - 330 - 200;
        oshiRows.forEach(function (o, k) {
          ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(M + 48, yy - 10, 14, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = P.text; ctx.fillText(fitText(ctx, (k + 1) + '. ' + o.name, 250, 32, 700, 22), M + 72, yy);
          ctx.fillStyle = P.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'; rr(ctx, bx, yy - 28, bw, 30, 15); ctx.fill();
          ctx.fillStyle = o.color; rr(ctx, bx, yy - 28, Math.max(30, bw * o.amount / maxA), 30, 15); ctx.fill();
          ctx.fillStyle = P.text; ctx.font = '700 32px ' + FONT; ctx.textAlign = 'right'; ctx.fillText(money(o.amount), W - M - 32, yy); ctx.textAlign = 'left';
          yy += 70;
        });
      } });
      var cats = rep.byCat.slice(0, story ? 6 : (oshiRows.length >= 2 ? 3 : 4));
      if (cats.length) blocks.push({ h: 86 + cats.length * 70, draw: function (y) {
        panel(M, y, W - M * 2, 86 + cats.length * 70 - 10);
        label(amt ? '内訳' : '内訳（割合）', M + 32, y + 56, 32);
        var maxA = cats[0].amount || 1, yy = y + 112, bx = M + 330, bw = W - M * 2 - 330 - 200;
        cats.forEach(function (c) {
          ctx.fillStyle = P.text; ctx.fillText(fitText(ctx, c.icon + ' ' + c.name, 270, 32, 700, 22), M + 32, yy);
          ctx.fillStyle = P.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'; rr(ctx, bx, yy - 28, bw, 30, 15); ctx.fill();
          ctx.fillStyle = c.color; rr(ctx, bx, yy - 28, Math.max(30, bw * c.amount / maxA), 30, 15); ctx.fill();
          ctx.fillStyle = P.text; ctx.font = '700 32px ' + FONT; ctx.textAlign = 'right'; ctx.fillText(money(c.amount), W - M - 32, yy); ctx.textAlign = 'left';
          yy += 70;
        });
      } });
      var extra = [];
      if (rep.topEvent) extra.push('★ ' + rep.topEvent.name + (rep.topEvent.rating ? '  ' + '♥'.repeat(rep.topEvent.rating) : ''));
      if (rep.mode !== 'month' && rep.busiestMonth && rep.busiestAmount) extra.push('いちばん推した月: ' + ymJa(rep.busiestMonth) + (amt ? '（' + yenStr(rep.busiestAmount) + '）' : ''));
      if (rep.spots) extra.push('🗺️ 聖地巡礼 ' + rep.spots + 'か所');
      extra.push(cheer(rep));
      blocks.push({ h: 60 + extra.length * 58, draw: function (y) {
        extra.forEach(function (t, k) {
          ctx.fillStyle = k === extra.length - 1 ? P.accent : P.text;
          ctx.fillText(fitText(ctx, t, W - M * 2, k === extra.length - 1 ? 42 : 36, 800, 24), M, y + 50 + k * 58);
        });
      } });
      // 入りきらないときは下のブロックから落とす（ひとことは最後まで残す）
      var avail = bottom - top;
      var total = function () { return blocks.reduce(function (a, b) { return a + b.h; }, 0); };
      while (blocks.length > 3 && total() + 24 * (blocks.length - 1) > avail) blocks.splice(blocks.length - 2, 1);
      var gap = Math.max(24, Math.min(story ? 110 : 70, (avail - total()) / Math.max(1, blocks.length - 1)));
      var used = total() + gap * (blocks.length - 1), y = top + Math.max(0, (avail - used) / 2);
      blocks.forEach(function (b) { b.draw(y); y += b.h + gap; });
    }

    // ---- 透かし（無料版は必ず。SNSで見た人がアプリへ辿り着ける唯一の導線）
    if (watermark) {
      ctx.fillStyle = P.sub; ctx.textAlign = 'center';
      var wy = tpl === 'cheki' ? bottom - 76 : H - 92;
      ctx.font = '700 32px ' + FONT; ctx.fillText(WATERMARK, W / 2, wy);
      ctx.font = '500 25px ' + FONT; ctx.fillText(WATERMARK_URL, W / 2, wy + 40);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = P.sub; ctx.font = '700 30px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText('#推し活', W / 2, tpl === 'cheki' ? bottom - 40 : H - 56); ctx.textAlign = 'left';
    }
    if (sample) {
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 7);
      ctx.textAlign = 'center'; ctx.font = '900 120px ' + FONT;
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.strokeStyle = 'rgba(59,42,90,0.35)'; ctx.lineWidth = 4;
      for (var k = -4; k <= 4; k++) { ctx.strokeText('SAMPLE · Pro', 0, k * 300); ctx.fillText('SAMPLE · Pro', 0, k * 300); }
      ctx.restore();
    }
    ctx.restore();
    return { tpl: tpl, watermark: watermark, sample: sample, w: W, h: H };
  }

  return {
    PRODUCT: PRODUCT, KEY_PREFIX: KEY_PREFIX, STORE_URL: STORE_URL, PRICE_LABEL: PRICE_LABEL,
    TEMPLATES: TEMPLATES, SIZES: SIZES, WATERMARK: WATERMARK,
    hasPublicKey: function () { return !!PUBLIC_KEY_JWK; },
    normalizeKey: normalizeKey, parseKey: parseKey, verifyKey: verifyKey, reasonText: reasonText,
    b64uToBytes: b64uToBytes, bytesToB64u: bytesToB64u,
    hexToRgb: hexToRgb, contrast: contrast, accentVars: accentVars,
    buildReport: buildReport, drawCard: drawCard, isPro: isPro, needsPro: needsPro
  };
});
