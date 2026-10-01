/*
 * oshi-research.js — 推し活ログの「イベントリサーチ」純粋ロジック
 *
 * ブラウザ（<script src>）・Cloudflare Worker（import）・Node（検査）の3か所で同じファイルを使う。
 * 副作用を持たない（fetch も DOM も触らない）。通信は呼び出し側（Worker）が行う。
 *
 * 設計メモ:
 *  - 取り込んだ文字列は全て「推定」。日付・会場は記事の本文から正規表現で拾うだけなので、
 *    UI は必ず出典リンクと「要確認」を添える（ここは確度を保証しない）
 *  - 外部由来の文字列（RSS・貼り付け）は cleanItem() を通してから使う。URL は http(s) のみ
 *  - 年が書かれていない日付は「今日に最も近い未来」へ寄せ、曜日があれば曜日で年を確かめる
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OshiResearch = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KINDS = {
    live:    { ja: 'ライブ',       en: 'Live',     icon: '🎤' },
    fanmeet: { ja: 'ファンミ・接触', en: 'Fan meet', icon: '🤝' },
    stage:   { ja: '舞台・公演',   en: 'Stage',    icon: '🎭' },
    event:   { ja: 'イベント',     en: 'Event',    icon: '🎪' },
    release: { ja: '発売',         en: 'Release',  icon: '💿' },
    media:   { ja: '出演・配信',   en: 'Media',    icon: '📺' },
    ticket:  { ja: 'チケット',     en: 'Ticket',   icon: '🎫' },
    other:   { ja: 'その他',       en: 'Other',    icon: '✨' }
  };
  var KIND_KEYS = Object.keys(KINDS);

  var WEEK = '日月火水木金土';

  function nfkc(s) { return String(s == null ? '' : s).normalize('NFKC'); }
  function normKey(s) { return nfkc(s).toLowerCase().replace(/[\s\-–—_:：・「」『』【】\[\]()（）<>＜＞!！?？、。,.~〜～*＊"'’“”/／|｜@＠#＃]/g, ''); }

  // ---------- 日付 ----------
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function validYMD(y, m, d) {
    if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  function ymd(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
  function isoDate(v) { return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v) && validYMD(+v.slice(0, 4), +v.slice(5, 7), +v.slice(8, 10)) ? v : ''; }
  function dayNum(iso) { return Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5); }
  function weekdayOf(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

  // 年なしの月日を、基準日(base)に最も合う年へ寄せる。曜日があれば曜日で確かめる。
  function inferYear(m, d, base, wk) {
    var by = +base.slice(0, 4), cands = [by, by + 1, by - 1], best = null;
    for (var i = 0; i < cands.length; i++) {
      var y = cands[i]; if (!validYMD(y, m, d)) continue;
      var delta = dayNum(ymd(y, m, d)) - dayNum(base);
      if (wk != null && weekdayOf(y, m, d) !== wk) continue;
      // 基準日の約45日前〜約1年先を「その記事が言っている日」とみなす
      if (delta >= -45 && delta <= 320) { if (best === null || Math.abs(delta) < Math.abs(best.delta)) best = { y: y, delta: delta }; }
    }
    if (best) return best.y;
    return null;
  }

  var RE_FULL = /(\d{4})\s*[年\/.\-]\s*(\d{1,2})\s*[月\/.\-]\s*(\d{1,2})\s*日?(?:\s*[（(]\s*([日月火水木金土祝])[^）)]*[）)])?/g;
  var RE_JP = /(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s*[（(]\s*([日月火水木金土祝])[^）)]*[）)])?/g;
  var RE_SLASH = /(?<![\d\/.\-:])(\d{1,2})\/(\d{1,2})\s*[（(]\s*([日月火水木金土祝])[^）)]*[）)]/g;

  // text 内の日付を出現順に返す。base は年を推定する基準日（YYYY-MM-DD）
  function extractDates(text, base) {
    text = nfkc(text); base = isoDate(base) || todayISO();
    var found = [], used = [];
    function overlaps(a, b) { for (var i = 0; i < used.length; i++) if (a < used[i][1] && b > used[i][0]) return true; return false; }
    function add(index, len, y, m, d, w) {
      if (overlaps(index, index + len)) return;
      var wk = (w && WEEK.indexOf(w) >= 0) ? WEEK.indexOf(w) : null;
      if (y == null) { y = inferYear(m, d, base, wk); if (y == null) return; }
      if (!validYMD(y, m, d)) return;
      used.push([index, index + len]); found.push({ date: ymd(y, m, d), index: index, explicitYear: arguments[6] === true });
    }
    var m;
    RE_FULL.lastIndex = 0; while ((m = RE_FULL.exec(text))) add(m.index, m[0].length, +m[1], +m[2], +m[3], m[4], true);
    RE_JP.lastIndex = 0; while ((m = RE_JP.exec(text))) add(m.index, m[0].length, null, +m[1], +m[2], m[3]);
    RE_SLASH.lastIndex = 0; while ((m = RE_SLASH.exec(text))) add(m.index, m[0].length, null, +m[1], +m[2], m[3]);
    found.sort(function (a, b) { return a.index - b.index; });
    return found;
  }

  function todayISO(now) {
    var d = now ? new Date(now) : new Date(), t = d.getTime() + 9 * 3600 * 1000; // 日本時間の「今日」
    var j = new Date(t);
    return j.getUTCFullYear() + '-' + pad2(j.getUTCMonth() + 1) + '-' + pad2(j.getUTCDate());
  }

  // 複数の日付から「イベントの日」を1つ選ぶ。今日以降で最も早いもの。全部過去なら past:true
  function pickEventDate(dates, today) {
    today = isoDate(today) || todayISO();
    if (!dates.length) return { date: '', past: false };
    var future = dates.filter(function (x) { return x.date >= today; });
    if (future.length) return { date: future.reduce(function (a, b) { return b.date < a.date ? b : a; }).date, past: false };
    return { date: dates[dates.length - 1].date, past: true };
  }

  // ---------- 種別・会場・タイトル ----------
  function classify(text) {
    var t = nfkc(text);
    var noTicketSale = t.replace(/チケット\s*(?:の)?\s*(?:一般)?\s*(?:発売|販売)|(?:一般)?発売\s*(?:の)?\s*チケット/g, 'チケット');
    var tags = [];
    if (/(CD|Blu-?ray|DVD|アルバム|シングル|写真集|リリース|発売決定|発売|ジャケット|MV公開|新曲)/i.test(noTicketSale)) tags.push('release');
    if (/(ライブ|LIVE|ツアー|TOUR|コンサート|ワンマン|フェス|FES|公演|単独|リサイタル|ファンクラブ限定ライブ)/i.test(t)) tags.push('live');
    if (/(ファンミ|ファンミーティング|握手会|サイン会|お渡し会|トークショー|特典会|ミート&?グリート|オフ会|ハイタッチ)/i.test(t)) tags.push('fanmeet');
    if (/(舞台|ミュージカル|朗読劇|演劇|座長|千穐楽)/.test(t)) tags.push('stage');
    if (/(イベント|展|POP\s*-?UP|ポップアップ|コラボカフェ|カフェ|フェア|上映|試写|舞台挨拶|生誕祭|誕生日|記念|ショップ|開催)/i.test(t)) tags.push('event');
    if (/(出演|放送|配信|生配信|特番|番組|ラジオ|テレビ|TV|YouTube|ゲスト|MC)/i.test(t)) tags.push('media');
    if (/(先行|抽選|一般発売|チケット|受付|申込|当落|販売開始|FC先行)/i.test(t)) tags.push('ticket');
    // 主種別: ライブ/接触/舞台/イベントを発売・出演より優先（「ライブBlu-ray発売」は発売）
    var primary = 'other';
    var hasRelease = tags.indexOf('release') >= 0;
    var order = hasRelease ? ['release', 'live', 'fanmeet', 'stage', 'event', 'media', 'ticket'] : ['live', 'fanmeet', 'stage', 'event', 'media', 'ticket'];
    for (var i = 0; i < order.length; i++) if (tags.indexOf(order[i]) >= 0) { primary = order[i]; break; }
    // 「チケット先行」＋ライブ → ライブ（ticket はタグとして残す）
    return { kind: primary, tags: tags };
  }

  var VENUE_SUFFIX = '(?:ホール|アリーナ|ドーム|スタジアム|劇場|シアター|会館|ライブハウス|武道館|Zepp[A-Za-z0-9\\s]*|フォーラム|センター|プラザ|パーク|ステージ|広場|スクエア|ガーデン|ミュージアム|美術館|ギャラリー)';
  function extractVenue(text) {
    var t = nfkc(text), m;
    m = /(?:会場|場所|開催場所|開催地)\s*[:：]\s*([^\n\r、。,／/|｜]{2,40})/.exec(t); if (m) return m[1].replace(/[（(].*$/, '').trim().slice(0, 60);
    m = /[＠@]\s*([^\s、。,／/|｜\]】)）]{2,30})/.exec(t); if (m) return m[1].trim();
    m = /\b(Zepp\s*[A-Za-z0-9]+(?:\s[A-Z][A-Za-z]+)?)/.exec(t); if (m) return m[1].trim().slice(0, 40); // 「Zepp Nagoya」は前に文字が無くても会場
    m = new RegExp('([^\\s、。,／/|｜「」『』【】()（）@＠:：]{1,18}' + VENUE_SUFFIX + ')').exec(t); if (m) return m[1].trim().slice(0, 40);
    return '';
  }

  function cleanTitle(s, source) {
    var t = nfkc(s).replace(/\s+/g, ' ').trim();
    if (source) { var src = nfkc(source).trim(); if (src && t.slice(-src.length - 3) === ' - ' + src) t = t.slice(0, -src.length - 3).trim(); }
    t = t.replace(/\s+[-–—]\s+[^-–—]{1,30}$/, function (m) { return /(新聞|ニュース|News|スポーツ|Walker|ナタリー|ORICON|オリコン|音楽|ウォーカー|Yahoo|livedoor|cinemacafe|MANTAN|PRTIMES|PR TIMES|日刊|毎日|朝日|読売|産経|共同|時事|\.com|\.jp)/i.test(m) ? '' : m; });
    return t.slice(0, 120);
  }

  // ---------- URL / 文字列の検疫 ----------
  function safeUrl(u) {
    if (typeof u !== 'string' || u.length > 600) return '';
    try {
      var x = new URL(u.trim());
      if (x.protocol !== 'https:' && x.protocol !== 'http:') return '';
      if (x.username || x.password) return '';
      return x.href.length <= 600 ? x.href : '';
    } catch (e) { return ''; }
  }
  function domainOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function cleanName(s) { return nfkc(s).replace(/[\u0000-\u001f"“”<>\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function oneLine(s, max) { return nfkc(s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }

  // 外部由来の候補（RSS・Worker応答・貼り付け）の検疫。使えなければ null
  function cleanItem(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.title !== 'string') return null; // 数値などを「123」という題名にしない
    var title = oneLine(raw.title, 120); if (!title) return null;
    var kind = KIND_KEYS.indexOf(raw.kind) >= 0 ? raw.kind : 'other';
    var url = safeUrl(raw.url);
    return {
      title: title, date: isoDate(raw.date), venue: oneLine(raw.venue, 60), kind: kind, url: url,
      source: oneLine(raw.source, 40) || (url ? domainOf(url) : ''), pubDate: isoDate(raw.pubDate)
    };
  }

  function itemKey(name, date, title) { return normKey(name) + '|' + (date || '?') + '|' + normKey(title).slice(0, 28); }

  // 推しの名前が見出し/本文に出ているか（空白入りの名前は各語の一致でも可）
  function mentionsName(text, name) {
    var t = normKey(text), n = normKey(name); if (!n) return false;
    if (t.indexOf(n) >= 0) return true;
    var parts = nfkc(name).split(/[\s　]+/).map(normKey).filter(function (p) { return p.length >= 2; });
    return parts.length >= 2 && parts.every(function (p) { return t.indexOf(p) >= 0; });
  }

  // ---------- RSS ----------
  function decodeEntities(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, function (m, e) {
      var l = e.toLowerCase();
      if (l === 'amp') return '&'; if (l === 'lt') return '<'; if (l === 'gt') return '>'; if (l === 'quot') return '"'; if (l === 'apos') return "'"; if (l === 'nbsp') return ' ';
      var code = l.charAt(1) === 'x' ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10);
      return (code > 0 && code < 0x110000) ? String.fromCodePoint(code) : '';
    });
  }
  function stripTags(s) { return String(s).replace(/<[^>]*>/g, ' '); }
  function xmlTag(block, name) {
    var m = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i').exec(block); if (!m) return '';
    var c = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(m[1]);
    return c ? c[1] : decodeEntities(m[1]);
  }
  function rfcDate(s) {
    var d = new Date(s); if (isNaN(d.getTime())) return '';
    return todayISO(d);
  }
  // RSS 2.0 の <item> を取り出す（DOMParser を使わない＝Worker でも動く）
  function parseRss(xml, max) {
    xml = String(xml || '').slice(0, 1000000); max = max || 60;
    var out = [], re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi, m;
    while ((m = re.exec(xml)) && out.length < max) {
      var b = m[1], src = /<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/i.exec(b);
      var desc = decodeEntities(stripTags(decodeEntities(xmlTag(b, 'description')))).replace(/\s+/g, ' ').trim();
      out.push({
        title: xmlTag(b, 'title'), link: xmlTag(b, 'link').trim(), pubDate: rfcDate(xmlTag(b, 'pubDate')),
        description: desc.slice(0, 400), source: src ? decodeEntities(stripTags(src[2])).trim() : '', sourceUrl: src && src[1] ? decodeEntities(src[1]) : ''
      });
    }
    return out;
  }

  // RSS の1件 → 候補（推しの名前が出ていないもの・終わったものは捨てる）
  function fromNews(it, name, today) {
    today = isoDate(today) || todayISO();
    var title = cleanTitle(it.title, it.source), base = isoDate(it.pubDate) || today;
    if (!mentionsName(title + ' ' + (it.description || ''), name)) return null;
    var fromTitle = extractDates(title, base), dates = fromTitle.length ? fromTitle : extractDates(it.description || '', base);
    var pick = pickEventDate(dates, today);
    if (pick.past) return null;
    var url = safeUrl(it.link); if (!url) return null;
    var text = title + ' ' + (it.description || '');
    var cls = classify(title.length > 8 ? title : text);
    return cleanItem({ title: title, date: pick.date, venue: extractVenue(text), kind: cls.kind, url: url, source: it.source || domainOf(it.sourceUrl) || domainOf(url), pubDate: isoDate(it.pubDate) });
  }

  // 重複を除き、日付あり(近い順)→日付なし(新しい記事順)で並べる
  function rank(items, name, limit) {
    var seen = {}, seenPlace = {}, out = [];
    items.forEach(function (it) {
      if (!it) return;
      var k = itemKey(name, it.date, it.title); if (seen[k]) return;
      // 見出しが違っても「同じ日・同じ会場」は同じイベント（媒体ごとに見出しが違うのが普通）
      var pk = it.date && it.venue ? normKey(it.date + '|' + it.venue) : ''; if (pk && seenPlace[pk]) return;
      seen[k] = 1; if (pk) seenPlace[pk] = 1; out.push(it);
    });
    out.sort(function (a, b) {
      if (!!a.date !== !!b.date) return a.date ? -1 : 1;
      if (a.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (b.pubDate || '') < (a.pubDate || '') ? -1 : ((b.pubDate || '') > (a.pubDate || '') ? 1 : 0);
    });
    return out.slice(0, limit || 40);
  }

  // ---------- 検索クエリ（取得先はホスト固定。呼び出し側は allowedHosts で再確認する） ----------
  var ALLOWED_HOSTS = ['news.google.com', 'www.bing.com'];
  function buildQueries(name) {
    var n = cleanName(name); if (!n) return [];
    var g = function (terms) { return 'https://news.google.com/rss/search?q=' + encodeURIComponent('"' + n + '" (' + terms + ') when:60d') + '&hl=ja&gl=JP&ceid=JP:ja'; };
    return [
      { engine: 'google', url: g('ライブ OR ツアー OR コンサート OR 公演') },
      { engine: 'google', url: g('イベント OR ファンミーティング OR 出演 OR 開催') },
      { engine: 'google', url: g('発売 OR 先行 OR チケット') },
      { engine: 'bing', url: 'https://www.bing.com/news/search?q=' + encodeURIComponent(n + ' ライブ イベント') + '&format=rss&setlang=ja&cc=JP' }
    ];
  }
  function allowedHost(u) { try { var x = new URL(u); return x.protocol === 'https:' && ALLOWED_HOSTS.indexOf(x.hostname) >= 0; } catch (e) { return false; } }

  // ブラウザだけで開ける「自分で探す」リンク（通信なし・ただのリンク）
  function searchLinks(name, year) {
    var n = cleanName(name); if (!n) return [];
    var q = encodeURIComponent(n), y = year || new Date().getFullYear();
    return [
      { label: 'Google（ライブ・イベント）', url: 'https://www.google.com/search?q=' + encodeURIComponent(n + ' ライブ イベント ' + y) },
      { label: 'Googleニュース', url: 'https://news.google.com/search?q=' + q + '&hl=ja&gl=JP&ceid=JP:ja' },
      { label: 'X（最新）', url: 'https://x.com/search?q=' + encodeURIComponent(n + ' (ライブ OR イベント OR 開催)') + '&f=live' },
      { label: 'イープラス', url: 'https://www.google.com/search?q=' + encodeURIComponent('site:eplus.jp ' + n) },
      { label: 'ぴあ', url: 'https://www.google.com/search?q=' + encodeURIComponent('site:t.pia.jp ' + n) },
      { label: 'ローチケ', url: 'https://www.google.com/search?q=' + encodeURIComponent('site:l-tike.com ' + n) }
    ];
  }

  // ---------- 貼り付けテキストの取り込み（公式サイトのスケジュール欄などをコピペ） ----------
  function parsePasted(text, opts) {
    opts = opts || {}; var today = isoDate(opts.today) || todayISO(), keepPast = !!opts.keepPast, out = [];
    var blocks = nfkc(String(text || '').slice(0, 20000)).split(/\n\s*\n/);
    blocks.forEach(function (block) {
      var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean); if (!lines.length) return;
      var dateLines = lines.filter(function (l) { return extractDates(l, today).length > 0; });
      var header = '';
      // 見出し = 日付も「日時/会場」ラベルも含まない最初の行
      for (var i = 0; i < lines.length; i++) {
        if (extractDates(lines[i], today).length) continue;
        if (/^(日時|日程|会場|場所|開催|open|start)/i.test(lines[i])) continue;
        header = lines[i]; break;
      }
      var labeled = /(?:イベント名|タイトル|公演名|ツアー名)\s*[:：]\s*(.+)/.exec(block);
      if (labeled) header = labeled[1];
      function push(line, title) {
        var dates = extractDates(line, today); if (!dates.length) return;
        var pick = pickEventDate(dates, today); if (pick.past && !keepPast) return;
        var t = title || line.replace(/\d{4}\s*[年\/.\-]\s*\d{1,2}\s*[月\/.\-]\s*\d{1,2}\s*日?|\d{1,2}\s*月\s*\d{1,2}\s*日|\d{1,2}\/\d{1,2}/g, ' ').replace(/[（(][日月火水木金土祝][^）)]*[）)]/g, ' ').replace(/^(日時|日程)\s*[:：]/, '').replace(/\s+/g, ' ').trim();
        if (!t || t.length < 2) t = (opts.name ? opts.name + ' ' : '') + 'イベント';
        var cls = classify(block);
        var it = cleanItem({ title: t, date: pick.date, venue: extractVenue(line) || extractVenue(block), kind: cls.kind, url: '', source: '貼り付け' });
        if (it) out.push(it);
      }
      if (dateLines.length >= 2) {
        // ツアー日程のように日付が並ぶ表: 1行 = 1公演、題名は見出し行
        dateLines.forEach(function (l) { push(l, header ? header + (extractVenue(l) ? '（' + extractVenue(l) + '）' : '') : ''); });
      } else if (dateLines.length === 1) {
        push(dateLines[0], header && header !== dateLines[0] ? header : '');
      }
    });
    return rank(out, opts.name || '', 60);
  }

  return {
    KINDS: KINDS, KIND_KEYS: KIND_KEYS, ALLOWED_HOSTS: ALLOWED_HOSTS,
    nfkc: nfkc, normKey: normKey, isoDate: isoDate, todayISO: todayISO, dayNum: dayNum,
    extractDates: extractDates, pickEventDate: pickEventDate, classify: classify, extractVenue: extractVenue, cleanTitle: cleanTitle,
    safeUrl: safeUrl, domainOf: domainOf, cleanName: cleanName, oneLine: oneLine, cleanItem: cleanItem,
    itemKey: itemKey, mentionsName: mentionsName, decodeEntities: decodeEntities, parseRss: parseRss,
    fromNews: fromNews, rank: rank, buildQueries: buildQueries, allowedHost: allowedHost, searchLinks: searchLinks, parsePasted: parsePasted
  };
});
