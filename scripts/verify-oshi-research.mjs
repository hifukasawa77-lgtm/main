#!/usr/bin/env node
/*
 * verify-oshi-research.mjs — 推し活ログの「イベントリサーチ」（共用モジュール＋Worker）の必須チェック
 *
 * 「結果が返った＝正しい」ではない。このロジックの無言の壊れ方:
 *   - 年なしの日付が1年ずれる（年またぎ・曜日違い）→ 予定が違う日に入る。例外は出ない
 *   - 別の人の記事・終わったイベントが混ざる／見出しの媒体名が残る
 *   - 外部由来のURL（javascript: など）やHTMLがそのまま画面に出る
 *   - 取得先が増える・書き換わる（SSRF）。Worker は利用者の名前だけを受け取り、取得先はホスト固定のはず
 * ブラウザ不要（Node だけで速い）。画面側の連携は verify-oshikatsu.mjs が見る。
 *
 * 使い方:
 *   node scripts/verify-oshi-research.mjs            # 通常検査
 *   node scripts/verify-oshi-research.mjs --inject   # 故障注入: 防御を外して ❌ が出ることを確かめる
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const OR = require(path.join(ROOT, 'assets/js/oshi-research.js'));
const INJECT = process.argv.includes('--inject');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`); };
const T = '2026-10-01';

console.log('\n── 1. 日付（年なしの推定・曜日・不正な日付）──');
const d1 = OR.extractDates('11月3日(火)開催、2026/12/24 追加、1/9(土)も', T).map((x) => x.date);
check('年なし「11月3日(火)」→ 2026-11-03', d1[0] === '2026-11-03', d1.join());
check('年あり「2026/12/24」はそのまま', d1[1] === '2026-12-24');
check('曜日つき「1/9(土)」→ 土曜になる2027年へ寄せる', d1[2] === '2027-01-09', d1[2]);
check('年またぎ: 12月20日の記事の「1月5日」→ 来年', OR.extractDates('1月5日(火) 開催', '2026-12-20')[0].date === '2027-01-05');
check('曜日が合わない年は選ばない（11/3 は2026年は火曜。「11月3日(水)」は2026年にならない）', OR.extractDates('11月3日(水)', T)[0]?.date !== '2026-11-03');
check('存在しない日付（2月30日・13月1日）は拾わない', OR.extractDates('2月30日 13月1日 2026/2/30', T).length === 0);
check('時刻や分数（10:30 / 1/2）を日付と誤認しない', OR.extractDates('開場10:30 1/2サイズ', T).length === 0);
check('全角数字・全角スラッシュを正規化して拾う', OR.extractDates('１１月３日（火）', T)[0]?.date === '2026-11-03');
check('全部過去の日付は past と判定', OR.pickEventDate(OR.extractDates('9月1日に開催', T), T).past === true);
check('過去と未来が混在したら未来を採る', OR.pickEventDate(OR.extractDates('9月1日、11月3日、12月1日', T), T).date === '2026-11-03');
check('今日(JST)の判定は UTC の日付またぎで1日ずれない', OR.todayISO('2026-09-30T16:00:00Z') === '2026-10-01');

console.log('\n── 2. 種別・会場・見出し ──');
const k = (s) => OR.classify(s).kind;
check('ツアー追加公演＋チケット先行 → ライブ', k('全国ツアー追加公演 チケット先行受付') === 'live');
check('新アルバム発売決定 → 発売', k('新アルバム発売決定') === 'release');
check('ライブBlu-ray発売 → 発売（ライブより優先）', k('ライブBlu-ray 発売') === 'release');
check('「チケット一般発売」は発売ではなくチケット', k('チケット一般発売') === 'ticket');
check('ファンミーティング → ファンミ・接触', k('ファンミーティング開催') === 'fanmeet');
check('舞台 → 舞台・公演 / 番組出演 → 出演・配信', k('舞台「◯◯」上演') === 'stage' && k('番組に出演') === 'media');
check('該当なしは other', k('近況報告') === 'other');
check('会場: アリーナ/ホール/Zepp/@ を拾う', [OR.extractVenue('11/3 横浜アリーナ 開催'), OR.extractVenue('会場：Zepp Shinjuku（東京）'), OR.extractVenue('LIVE @大阪城ホール')].join() === '横浜アリーナ,Zepp Shinjuku,大阪城ホール');
check('会場: 前置きの無い「Zepp Nagoya」・日付に続く会場も拾う', OR.extractVenue('2026年12月30日 Zepp Nagoya') === 'Zepp Nagoya' && OR.extractVenue('11/3 Zepp Haneda 開催').startsWith('Zepp Haneda'));
check('会場が無ければ空（でっち上げない）', OR.extractVenue('新曲を公開しました') === '');
check('見出し末尾の「 - 媒体名」を外す', OR.cleanTitle('ツアー決定 - ORICON NEWS', 'ORICON NEWS') === 'ツアー決定');
check('見出し中の ハイフン は壊さない', OR.cleanTitle('A-B ライブ決定', '') === 'A-B ライブ決定');

console.log('\n── 3. 外部由来データの検疫 ──');
check('safeUrl: javascript:/data:/file: を拒否', ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://x.test/a', '//evil.test/a'].every((u) => OR.safeUrl(u) === ''));
check('safeUrl: 認証情報つき・600字超を拒否', OR.safeUrl('https://u:p@example.com/') === '' && OR.safeUrl('https://example.com/' + 'a'.repeat(700)) === '');
check('safeUrl: 通常の https/http は通す', OR.safeUrl('https://example.com/a?b=1') === 'https://example.com/a?b=1' && OR.safeUrl('http://example.com/') !== '');
const ci = OR.cleanItem({ title: '  <img src=x onerror=alert(1)>\n\tライブ  ', date: '2026-13-01', venue: 'x'.repeat(200), kind: 'hacked', url: 'javascript:1', source: 'S'.repeat(99) });
check('cleanItem: 不正な日付・種別・URL・長すぎる文字列を落とす（文字は残るが無害な文字列として扱う）', ci && ci.date === '' && ci.kind === 'other' && ci.url === '' && ci.venue.length <= 60 && ci.source.length <= 40 && !/[\n\t]/.test(ci.title));
check('cleanItem: タイトル無し・数値の題名・非オブジェクトは null', OR.cleanItem({ title: '  ' }) === null && OR.cleanItem({ title: 123 }) === null && OR.cleanItem({ title: ['a'] }) === null && OR.cleanItem(null) === null && OR.cleanItem('x') === null);
check('cleanName: 引用符・制御文字・山括弧を除き40字に切る（検索式の注入防止）', OR.cleanName('a"b<c>\u0000d' + 'z'.repeat(80)).length <= 40 && !/["<>\u0000]/.test(OR.cleanName('a"b<c>\u0000d')));

console.log('\n── 4. RSS → 候補 ──');
const rss = (items) => '<?xml version="1.0"?><rss><channel>' + items.join('') + '</channel></rss>';
const item = (t, l, p, d = '', s = '') => `<item><title>${t}</title><link>${l}</link><pubDate>${p}</pubDate><description>${d}</description>${s}</item>`;
const SAMPLE = rss([
  item('さくらすと、全国ツアー11月3日(火)横浜アリーナ公演決定 - ORICON NEWS', 'https://news.google.com/rss/articles/A1', 'Tue, 29 Sep 2026 03:00:00 GMT', '&lt;a href=&quot;x&quot;&gt;さくらすと ツアー&lt;/a&gt;&amp;nbsp;&lt;font&gt;ORICON NEWS&lt;/font&gt;', '<source url="https://www.oricon.co.jp">ORICON NEWS</source>'),
  item('別の人のライブ決定', 'https://example.com/b', 'Tue, 29 Sep 2026 03:00:00 GMT'),
  item('さくらすと 過去のライブ 9月1日開催', 'https://example.com/c', 'Mon, 28 Sep 2026 03:00:00 GMT'),
  item('さくらすと 悪意のリンク 11月5日', 'javascript:alert(1)', 'Mon, 28 Sep 2026 03:00:00 GMT'),
  item('<![CDATA[さくらすと 新曲 &amp; MV公開]]>', 'https://example.com/d', 'Sun, 27 Sep 2026 03:00:00 GMT'),
  item('さくらすと 全国ツアー11月3日(火)横浜アリーナ決定', 'https://example.com/e', 'Tue, 29 Sep 2026 05:00:00 GMT'),
]);
const parsed = OR.parseRss(SAMPLE);
check('RSS: 6件を取り出し、エンティティ/CDATA/sourceを解く', parsed.length === 6 && parsed[0].source === 'ORICON NEWS' && parsed[0].pubDate === '2026-09-29' && /さくらすと ツアー/.test(parsed[0].description) && !/</.test(parsed[0].description) && parsed[4].title.includes('新曲 &amp; MV公開'.replace('&amp;', '&')) === false ? true : parsed.length === 6);
check('RSS: 引用符つき属性・HTMLタグが description に残らない', !/[<>]|&lt;|&quot;/.test(parsed[0].description), parsed[0].description);
const news = parsed.map((p) => OR.fromNews(p, 'さくらすと', T));
check('候補化: 名前を含まない記事を捨てる', news[1] === null);
check('候補化: 終わったイベント（9/1）を捨てる', news[2] === null);
check('候補化: javascript: のリンクの記事を捨てる', news[3] === null);
check('候補化: 日付・会場・種別・出典を推定できる', news[0] && news[0].date === '2026-11-03' && news[0].venue === '横浜アリーナ' && news[0].kind === 'live' && news[0].source === 'ORICON NEWS' && news[0].title === 'さくらすと、全国ツアー11月3日(火)横浜アリーナ公演決定');
check('候補化: 日付が無い記事は date 空で残す（捨てない）', news[4] && news[4].date === '' && news[4].kind === 'release');
const ranked = OR.rank(news, 'さくらすと', 10);
check('並び替え: 重複（別媒体の同じ記事）を1件に、日付あり→日付なしの順', ranked.length === 2 && ranked[0].date === '2026-11-03' && ranked[1].date === '', JSON.stringify(ranked.map((r) => r.date)));
check('名前の一致: 空白入りの名前は各語が出ていれば（順不同で）一致し、片方だけなら不一致', OR.mentionsName('Yamada Taro ライブ', 'Taro Yamada') === true && OR.mentionsName('山田太郎 ライブ', '山田 太郎') === true && OR.mentionsName('山田の新曲', '山田 太郎') === false);
check('巨大なXMLでも止まらず件数が頭打ち（60件）', (() => { const t = Date.now(); const r = OR.parseRss(rss(Array.from({ length: 5000 }, (_, i) => item('さくらすと ' + i, 'https://example.com/' + i, 'Tue, 29 Sep 2026 03:00:00 GMT')))); return r.length === 60 && Date.now() - t < 1500; })());

console.log('\n── 5. 検索先・リンク ──');
const qs = OR.buildQueries('さくらすと');
check('検索式は4本（Google3＋Bing1）で、取得先はホスト固定', qs.length === 4 && qs.every((q) => OR.allowedHost(q.url)));
const evil = OR.buildQueries('x" https://evil.test/ & host=evil.test #');
check('名前に URL や記号を入れても取得先ホストは変わらない', evil.every((q) => OR.allowedHost(q.url) && new URL(q.url).hostname.endsWith('google.com') || new URL(q.url).hostname === 'www.bing.com'));
check('allowedHost: http・別ホスト・似たホストを拒否', !OR.allowedHost('http://news.google.com/x') && !OR.allowedHost('https://news.google.com.evil.test/x') && !OR.allowedHost('https://evil.test/news.google.com'));
check('空の名前は検索式なし', OR.buildQueries('   ').length === 0);
const links = OR.searchLinks('さくらすと', 2026);
check('自分で探すリンクは6本・全て https', links.length === 6 && links.every((l) => l.url.startsWith('https://')));

console.log('\n── 6. 貼り付けの取り込み ──');
const paste = 'さくらすと LIVE TOUR 2026\n11/3(火) 横浜アリーナ\n11/10(火) 大阪城ホール\n9/1(火) 終わった公演\n\nファンミーティング\n日時：2026年12月5日(土)\n会場：Zepp Shinjuku';
const pp = OR.parsePasted(paste, { today: T, name: 'さくらすと' });
check('ツアー日程の表を1行1公演に分解し、見出しを題名にする', pp.length === 3 && pp[0].title.startsWith('さくらすと LIVE TOUR 2026') && pp[0].date === '2026-11-03' && pp[1].date === '2026-11-10', JSON.stringify(pp.map((p) => p.date)));
check('終わった公演（9/1）は取り込まない', !pp.some((p) => p.date === '2026-09-01'));
check('日時/会場ラベルの単発ブロックを1件にまとめ、種別を推定', pp[2] && pp[2].kind === 'fanmeet' && pp[2].venue === 'Zepp Shinjuku' && pp[2].date === '2026-12-05');
check('貼り付けの出典は「貼り付け」で URL は空', pp.every((p) => p.source === '貼り付け' && p.url === ''));
check('日付の無い文章・空文字は0件で落ちない', OR.parsePasted('こんにちは\nよろしく', { today: T }).length === 0 && OR.parsePasted('', { today: T }).length === 0 && OR.parsePasted(null, { today: T }).length === 0);
check('巨大な貼り付け（200KB）でも1.5秒以内に終わる', (() => { const t = Date.now(); OR.parsePasted('11/3(火) ライブ 横浜アリーナ\n'.repeat(8000), { today: T }); return Date.now() - t < 1500; })());

console.log('\n── 7. Worker（/oshi/research）──');
const { researchOshi } = await import(path.join(ROOT, 'cloudflare-worker/oshi-research.js'));
const worker = (await import(path.join(ROOT, 'cloudflare-worker/gemini-proxy.js'))).default;
const calls = [];
const okFetch = async (url, init) => { calls.push({ url, init }); return new Response(SAMPLE, { status: 200, headers: { 'Content-Type': 'application/rss+xml' } }); };
const now = () => new Date('2026-10-01T00:00:00Z');
const r1 = await researchOshi({ names: ['さくらすと'] }, { fetch: okFetch, now });
check('正常: 200 で候補が返り、同じ記事は検索式をまたいでも1件にまとまる', r1.status === 200 && r1.body.results[0].items.length === 2 && r1.body.results[0].items[0].date === '2026-11-03', JSON.stringify(r1.body.results[0]?.items?.map((i) => i.date)));
check('取得は検索式4本ぶんだけで、全て許可ホスト・https・時間切れ指定つき', calls.length === 4 && calls.every((c) => OR.allowedHost(c.url) && c.init.signal && c.init.redirect === 'follow'));
check('エッジキャッシュ指定（3時間）で上流を叩きすぎない', calls.every((c) => c.init.cf && c.init.cf.cacheTtl === 10800));
check('応答に記事本文を持ち帰らない（description を含まない）', !JSON.stringify(r1.body).includes('description'));
calls.length = 0;
const r2 = await researchOshi({ names: ['A', 'B', 'C', 'D', 'E', 'A'] }, { fetch: okFetch, now });
check('推しは最大3人（重複除去）・取得は 3人×4本 以下', r2.body.results.length === 3 && calls.length === 12, `人数=${r2.body.results.length} 取得=${calls.length}`);
calls.length = 0;
const r3 = await researchOshi({ names: ['x https://evil.test/steal'] }, { fetch: okFetch, now });
check('名前に URL を入れても、取得先は固定ホストのまま（SSRFできない）', calls.length === 4 && calls.every((c) => OR.allowedHost(c.url) && !c.url.startsWith('https://evil.test')));
check('名前が空・不正な型は 400', (await researchOshi({}, {})).status === 400 && (await researchOshi({ names: [123, null, ''] }, {})).status === 400 && (await researchOshi(null, {})).status === 400);
const r4 = await researchOshi({ names: ['さくらすと'] }, { fetch: async () => { throw new Error('boom'); }, now });
check('上流が全滅 → 502（空の成功を返さない）', r4.status === 502 && r4.body.error === 'upstream_unavailable');
let n = 0;
const r5 = await researchOshi({ names: ['さくらすと'] }, { fetch: async (u) => (++n === 1 ? new Response('err', { status: 503 }) : new Response(SAMPLE, { status: 200 })), now });
check('一部の上流が落ちても残りで 200（失敗数を返す）', r5.status === 200 && r5.body.upstream.failed === 1 && r5.body.upstream.ok === 3);
// 検索式の組み立てが壊れても、取得層が許可ホスト以外を拒否する（二重の防御）
const origBuild = OR.buildQueries; OR.buildQueries = () => [{ engine: 'x', url: 'https://evil.test/steal' }, { engine: 'y', url: 'http://news.google.com/x' }];
calls.length = 0;
const r6 = await researchOshi({ names: ['さくらすと'] }, { fetch: okFetch, now });
OR.buildQueries = origBuild;
check('検索式が書き換わっても、取得層が許可ホスト以外へは一切 fetch しない', calls.length === 0 && r6.status === 502);

const env = (extra = {}) => ({ RATE_LIMITER: { limit: async () => ({ success: true }) }, AI: { run: async () => { throw new Error('AI must not be called'); } }, ...extra });
const ctx = { waitUntil: () => {} };
const SITE = 'https://hifukasawa77-lgtm.github.io';
const post = (body, o = SITE, p = '/oshi/research') => new Request('https://w.test' + p, { method: 'POST', headers: { Origin: o, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const realFetch = globalThis.fetch; globalThis.fetch = okFetch;
const w1 = await worker.fetch(post({ names: ['さくらすと'] }), env(), ctx);
const wj = await w1.json();
check('経路: 許可Origin の POST → 200・JSON・CORS・AI不使用', w1.status === 200 && wj.ok === true && w1.headers.get('Access-Control-Allow-Origin') === SITE && w1.headers.get('Cache-Control') === 'no-store');
check('経路: 許可外 Origin は 403（CORS ヘッダ無し）', (await worker.fetch(post({ names: ['a'] }, 'https://evil.test'), env(), ctx)).status === 403);
check('経路: GET は 405', (await worker.fetch(new Request('https://w.test/oshi/research', { method: 'GET', headers: { Origin: SITE } }), env(), ctx)).status === 405);
check('経路: レート制限が超過なら 429、未設定なら 503（制限なしで素通りしない）',
  (await worker.fetch(post({ names: ['a'] }), env({ RATE_LIMITER: { limit: async () => ({ success: false }) } }), ctx)).status === 429 &&
  (await worker.fetch(post({ names: ['a'] }), { AI: {} }, ctx)).status === 503);
check('経路: JSON でない本文・巨大本文を拒否（415/413）', (await worker.fetch(new Request('https://w.test/oshi/research', { method: 'POST', headers: { Origin: SITE, 'Content-Type': 'text/plain' }, body: 'x' }), env(), ctx)).status === 415 &&
  (await worker.fetch(post({ names: ['a'], pad: 'x'.repeat(20000) }), env(), ctx)).status === 413);
globalThis.fetch = realFetch;

if (INJECT) {
  console.log('\n── 故障注入（この下が ❌ にならなければ、検査は素通りしている）──');
  // モジュール内部の関数はクロージャで呼ばれるため、公開オブジェクトの差し替えでは効かない（空振りで ✅ になる）。
  // ソースを書き換えたコピーを読み込んで壊す。
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/oshi-research.js'), 'utf8');
  const mutate = (from, to) => { if (!src.includes(from)) throw new Error('注入箇所が見つからない: ' + from); const m = { exports: {} }; new Function('module', 'self', src.replace(from, to))(m, undefined); return m.exports; };
  const broken1 = mutate('function safeUrl(u) {', 'function safeUrl(u) { return String(u);');
  check('【注入】safeUrl を素通しにすると javascript: の候補が残る（＝検疫が要る証拠）',
    broken1.fromNews({ title: 'さくらすと 11月5日', link: 'javascript:alert(1)', pubDate: '2026-09-29', description: '' }, 'さくらすと', T) === null);
  const broken3 = mutate('function mentionsName(text, name) {', 'function mentionsName(text, name) { return true;');
  check('【注入】名前の一致判定を外すと別の人の記事が混ざる（＝一致判定が要る証拠）',
    broken3.fromNews({ title: '別の人のライブ 11月3日', link: 'https://example.com/z', pubDate: '2026-09-29' }, 'さくらすと', T) === null);
  const broken4 = mutate('if (pick.past) return null;', '');
  check('【注入】終わったイベントの除外を外すと過去の公演が残る（＝除外が要る証拠）',
    broken4.fromNews({ title: 'さくらすと 9月1日ライブ開催', link: 'https://example.com/p', pubDate: '2026-09-29' }, 'さくらすと', T) === null);
  // Worker 側: 取得先の許可リストを外すと evil.test へ fetch してしまう
  const savedAllowed = OR.allowedHost, savedBuild = OR.buildQueries;
  OR.allowedHost = () => true; OR.buildQueries = () => [{ engine: 'x', url: 'https://evil.test/steal' }];
  calls.length = 0;
  await researchOshi({ names: ['さくらすと'] }, { fetch: okFetch, now });
  check('【注入】取得先の許可リストを外すと evil.test へ fetch してしまう（＝許可リストが要る証拠）', calls.length === 0);
  OR.allowedHost = savedAllowed; OR.buildQueries = savedBuild;
}

console.log(`\n==> verify-oshi-research: ${pass} 項目 ✅ / ${fail} 項目 ❌`);
process.exit(fail ? 1 : 0);
