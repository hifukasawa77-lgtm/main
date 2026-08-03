#!/usr/bin/env node
/**
 * teams-chat-notifier の検査。
 *
 *   1. 静的検査   — manifest.json の参照ファイル実在・権限・innerHTML の不使用
 *   2. ロジック検査 — background.js を vm で読み込み、静音時間帯とキーワード判定を検証
 *   3. DOM検査    — Playwright で Teams 風のダミーDOMを組み、content.js が
 *                   名簿抽出・新着検知・自分の発言の除外を正しく行うか検証
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node scripts/verify-teams-notifier.mjs
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'teams-chat-notifier');

let failures = 0;
let checks = 0;

function ok(name, condition, detail = '') {
  checks++;
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function eq(name, actual, expected) {
  ok(name, actual === expected, `expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
}

// ---------------------------------------------------------------- 1. 静的検査
function staticChecks() {
  console.log('\n[1] 静的検査');

  const manifestPath = path.join(EXT, 'manifest.json');
  ok('manifest.json が存在する', fs.existsSync(manifestPath));
  if (!fs.existsSync(manifestPath)) return;

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    ok('manifest.json がJSONとして妥当', true);
  } catch (e) {
    ok('manifest.json がJSONとして妥当', false, String(e));
    return;
  }

  eq('manifest_version が 3', manifest.manifest_version, 3);
  for (const perm of ['storage', 'notifications', 'tabs']) {
    ok(`permissions に ${perm} がある`, (manifest.permissions || []).includes(perm));
  }
  ok('host_permissions に teams.microsoft.com がある',
    (manifest.host_permissions || []).some((h) => h.includes('teams.microsoft.com')));

  const referenced = [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
    ...(manifest.content_scripts || []).flatMap((cs) => cs.js || [])
  ].filter(Boolean);

  for (const rel of [...new Set(referenced)]) {
    ok(`参照ファイルが実在: ${rel}`, fs.existsSync(path.join(EXT, rel)));
  }

  // Teams由来の文字列（チャット名・本文）を扱うため innerHTML は使わない
  for (const file of ['popup.js', 'content.js', 'background.js']) {
    const src = fs.readFileSync(path.join(EXT, file), 'utf8');
    ok(`${file} が innerHTML を使っていない`, !/\.innerHTML\s*=/.test(src));
  }

  // APIキーを持たない拡張であること（本リポジトリの有料API禁止規約）
  const allSrc = ['popup.js', 'content.js', 'background.js']
    .map((f) => fs.readFileSync(path.join(EXT, f), 'utf8'))
    .join('\n');
  ok('外部APIへの送信コードが無い', !/fetch\s*\(|XMLHttpRequest/.test(allSrc));
}

// ------------------------------------------------------------ 2. ロジック検査
function logicChecks() {
  console.log('\n[2] ロジック検査 (background.js)');

  const noop = () => {};
  const listener = { addListener: noop };
  const sandbox = {
    console,
    chrome: {
      runtime: { onInstalled: listener, onMessage: listener, getURL: (p) => p, lastError: undefined },
      notifications: { onClicked: listener, create: noop, clear: noop },
      storage: { local: { get: async (d) => d, set: async () => {} } },
      tabs: { query: async () => [], update: async () => {}, create: async () => {} },
      windows: { update: async () => {} },
      action: { setBadgeText: noop, setBadgeBackgroundColor: noop }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(EXT, 'background.js'), 'utf8'), sandbox);

  const { isQuietNow, toMinutes, matchKeyword } = sandbox;
  ok('関数が読み込めた', [isQuietNow, toMinutes, matchKeyword].every((f) => typeof f === 'function'));
  if (typeof isQuietNow !== 'function') return;

  // toMinutes
  eq('toMinutes("19:00")', toMinutes('19:00'), 19 * 60);
  eq('toMinutes("08:05")', toMinutes('08:05'), 8 * 60 + 5);
  eq('toMinutes("25:00") は不正', toMinutes('25:00'), null);
  eq('toMinutes("") は不正', toMinutes(''), null);

  const at = (h, m = 0) => new Date(2026, 7, 3, h, m);

  // 日中帯（start < end）
  const day = { quietEnabled: true, quietStart: '09:00', quietEnd: '17:00' };
  eq('09:00-17:00 の 12:00 は静音中', isQuietNow(day, at(12)), true);
  eq('09:00-17:00 の 08:59 は通知する', isQuietNow(day, at(8, 59)), false);
  eq('09:00-17:00 の 17:00 は通知する（終了時刻は含まない）', isQuietNow(day, at(17)), false);

  // 日をまたぐ帯（start > end）
  const night = { quietEnabled: true, quietStart: '19:00', quietEnd: '08:00' };
  eq('19:00-08:00 の 23:00 は静音中', isQuietNow(night, at(23)), true);
  eq('19:00-08:00 の 03:00 は静音中', isQuietNow(night, at(3)), true);
  eq('19:00-08:00 の 12:00 は通知する', isQuietNow(night, at(12)), false);
  eq('19:00-08:00 の 19:00 は静音中（開始時刻を含む）', isQuietNow(night, at(19)), true);

  // 無効・不正
  eq('OFF なら常に通知する', isQuietNow({ ...night, quietEnabled: false }, at(23)), false);
  eq('開始と終了が同じなら通知する', isQuietNow({ quietEnabled: true, quietStart: '09:00', quietEnd: '09:00' }, at(9)), false);

  // matchKeyword
  const chat = { title: '営業チーム', sender: '田中', body: '至急ご確認ください' };
  eq('本文のキーワードに一致', matchKeyword(['至急'], chat), '至急');
  eq('チャット名のキーワードに一致', matchKeyword(['営業'], chat), '営業');
  eq('送信者名のキーワードに一致', matchKeyword(['田中'], chat), '田中');
  eq('大文字小文字を区別しない', matchKeyword(['URGENT'], { title: '', sender: '', body: 'This is urgent' }), 'URGENT');
  eq('一致しなければ空文字', matchKeyword(['見積'], chat), '');
  eq('空のキーワードは無視する', matchKeyword(['', '  '], chat), '');
}

// ----------------------------------------------------------------- 3. DOM検査
const CHAT_LIST_PAGE = `<!DOCTYPE html><html lang="ja"><body>
<div data-tid="chat-list" role="tree" aria-label="チャット一覧">
  <div data-tid="chat-list-item" role="treeitem" id="chat-list-item-19:aaa@thread.v2">
    <a href="/_#/conversations/19:aaa@thread.v2?ctx=chat">
      <span data-tid="chat-list-item-title">開発チーム</span>
      <span>10:24</span>
      <span data-tid="chat-list-item-preview" id="p-aaa">田中: 資料を送りました</span>
    </a>
    <span data-tid="chat-list-item-unread"></span>
  </div>
  <div data-tid="chat-list-item" role="treeitem" id="chat-list-item-19:bbb@thread.v2">
    <a href="/_#/conversations/19:bbb@thread.v2?ctx=chat">
      <span data-tid="chat-list-item-title">総務連絡</span>
      <span>9:02</span>
      <span data-tid="chat-list-item-preview" id="p-bbb">山田: 明日は休館です</span>
    </a>
  </div>
  <div data-tid="chat-list-item" role="treeitem" id="chat-list-item-19:ccc@thread.v2">
    <a href="/_#/conversations/19:ccc@thread.v2?ctx=chat">
      <span data-tid="chat-list-item-title">新規チャット</span>
      <span>10:00</span>
    </a>
  </div>
</div></body></html>`;

// data-tid も role も無い構成（Teams のUI変更を想定したフォールバック経路）
const FALLBACK_PAGE = `<!DOCTYPE html><html lang="ja"><body>
<ul>
  <li><a href="/_#/conversations/19:zzz@thread.v2?ctx=chat">
    <span>雑談</span><span>12:01</span><span>鈴木: おつかれさまです</span>
  </a></li>
</ul></body></html>`;

const MOCK_CHROME = `
window.__events = [];
window.chrome = {
  runtime: {
    sendMessage: (msg, cb) => { window.__events.push(msg); if (cb) cb(); },
    onMessage: { addListener: () => {} },
    lastError: undefined
  },
  storage: {
    local: { get: (defaults, cb) => cb(defaults) },
    onChanged: { addListener: () => {} }
  }
};
`;

async function domChecks() {
  console.log('\n[3] DOM検査 (content.js / Playwright)');

  const require = createRequire(import.meta.url);
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (_) {
    try {
      ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
    } catch (e) {
      failures++;
      console.log('  ✗ playwright を読み込めませんでした', e.message);
      return;
    }
  }

  const pages = { '/': CHAT_LIST_PAGE, '/fallback': FALLBACK_PAGE };
  const contentSrc = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');

  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (pages[url]) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pages[url]);
      return;
    }
    // 拡張本体のファイル（popup.html / popup.js）をそのまま配信する
    const file = path.join(EXT, url.replace(/^\/+/, ''));
    if (file.startsWith(EXT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const type = file.endsWith('.js') ? 'text/javascript' : 'text/html';
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      res.end(fs.readFileSync(file));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.addInitScript(MOCK_CHROME);
    await page.goto(base + '/');
    await page.addScriptTag({ content: contentSrc });
    await page.waitForTimeout(300);

    // --- 初回スキャン: 名簿は出るが通知イベントは出ない ---
    let events = await page.evaluate(() => window.__events);
    const rosters = events.filter((e) => e.type === 'CHAT_ROSTER');
    ok('初回スキャンで名簿を送信する', rosters.length >= 1);
    eq('初回スキャンでは新着イベントを出さない', events.filter((e) => e.type === 'CHAT_ACTIVITY').length, 0);

    const chats = rosters[rosters.length - 1].chats;
    eq('チャットを3件抽出した', chats.length, 3);
    eq('チャットIDをhrefから復元した', chats[0].id, '19:aaa@thread.v2');
    eq('チャット名を抽出した', chats[0].title, '開発チーム');
    eq('プレビュー文を抽出した', chats[0].preview, '田中: 資料を送りました');
    eq('未読バッジを検出した', chats[0].unread, true);
    eq('未読でない行は false', chats[1].unread, false);
    eq('時刻だけの行はプレビューにしない', chats[2].preview, '');
    ok('チャットURLを組み立てた', chats[0].url.includes('/conversations/19:aaa@thread.v2'));

    // --- プレビュー変化 → 新着イベント ---
    await page.evaluate(() => { window.__events = []; });
    await page.evaluate(() => {
      document.getElementById('p-aaa').textContent = '佐藤: 会議を30分ずらせますか';
    });
    await page.waitForTimeout(1200); // MutationObserver のデバウンス(700ms)待ち

    events = await page.evaluate(() => window.__events);
    const activities = events.filter((e) => e.type === 'CHAT_ACTIVITY');
    eq('プレビュー変化で新着イベントが1件出る', activities.length, 1);
    if (activities.length === 1) {
      eq('新着イベントのチャットID', activities[0].chat.id, '19:aaa@thread.v2');
      eq('送信者を分離した', activities[0].chat.sender, '佐藤');
      eq('本文を分離した', activities[0].chat.body, '会議を30分ずらせますか');
    }

    // --- 同じ内容の再スキャンでは再通知しない ---
    await page.evaluate(() => { window.__events = []; });
    await page.evaluate(() => {
      document.getElementById('p-bbb').setAttribute('data-noop', '1'); // 無関係な変化
    });
    await page.waitForTimeout(1200);
    events = await page.evaluate(() => window.__events);
    eq('内容が変わらなければ再通知しない', events.filter((e) => e.type === 'CHAT_ACTIVITY').length, 0);

    // --- 自分の発言は通知しない ---
    await page.evaluate(() => { window.__events = []; });
    await page.evaluate(() => {
      document.getElementById('p-bbb').textContent = 'あなた: 了解です';
    });
    await page.waitForTimeout(1200);
    events = await page.evaluate(() => window.__events);
    eq('自分の発言では通知しない', events.filter((e) => e.type === 'CHAT_ACTIVITY').length, 0);

    // --- フォールバック経路（data-tid も role も無い） ---
    const page2 = await browser.newPage();
    page2.on('pageerror', (e) => pageErrors.push(e.message));
    await page2.addInitScript(MOCK_CHROME);
    await page2.goto(base + '/fallback');
    await page2.addScriptTag({ content: contentSrc });
    await page2.waitForTimeout(300);

    const events2 = await page2.evaluate(() => window.__events);
    const roster2 = events2.filter((e) => e.type === 'CHAT_ROSTER').pop();
    ok('セレクタが全滅してもチャットを拾える', !!roster2 && roster2.chats.length === 1,
      JSON.stringify(roster2));
    if (roster2 && roster2.chats.length === 1) {
      eq('フォールバック時のチャット名', roster2.chats[0].title, '雑談');
      eq('フォールバック時のプレビュー', roster2.chats[0].preview, '鈴木: おつかれさまです');
      eq('フォールバック時のチャットID', roster2.chats[0].id, '19:zzz@thread.v2');
    }

    eq('JSランタイムエラーが無い', pageErrors.length, 0, pageErrors.join('\n      '));

    await popupChecks(browser, base);
  } finally {
    await browser.close();
    server.close();
  }
}

// --------------------------------------------------------------- 4. popup検査
const MOCK_CHROME_POPUP = `
window.__sent = [];
window.__store = {
  settings: {
    enabled: true,
    selected: { '19:aaa@thread.v2': true },
    keywordsEnabled: true,
    keywords: ['至急', 'レビュー'],
    quietEnabled: true,
    quietStart: '19:00',
    quietEnd: '08:00'
  },
  roster: {
    chats: [
      { id: '19:aaa@thread.v2', title: '開発チーム', preview: '田中: 資料を送りました', unread: true, url: '#a' },
      { id: '19:bbb@thread.v2', title: '総務連絡', preview: '山田: 明日は休館です', unread: false, url: '#b' }
    ],
    diagnostic: '',
    updatedAt: Date.now()
  },
  history: [
    { id: 'n_1', chatId: '19:aaa@thread.v2', title: '開発チーム', sender: '田中',
      body: '資料を送りました', url: '#a', ts: Date.now(), tag: '', keyword: '' },
    { id: 'n_2', chatId: '19:ccc@thread.v2', title: '営業', sender: '佐藤',
      body: '至急ご確認ください', url: '#c', ts: Date.now() - 3600000, tag: 'keyword', keyword: '至急' }
  ]
};
window.chrome = {
  runtime: {
    sendMessage: (msg, cb) => { window.__sent.push(msg); if (cb) cb(); },
    lastError: undefined
  },
  storage: {
    local: {
      get: async (defaults) => {
        const out = {};
        for (const key of Object.keys(defaults)) {
          out[key] = key in window.__store ? window.__store[key] : defaults[key];
        }
        return out;
      },
      set: async (obj) => { Object.assign(window.__store, obj); }
    },
    onChanged: { addListener: () => {} }
  },
  tabs: {
    query: async () => [{ id: 1, windowId: 1 }],
    sendMessage: (id, msg, cb) => { if (cb) cb(); }
  }
};
`;

async function popupChecks(browser, base) {
  console.log('\n[4] popup検査');

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.addInitScript(MOCK_CHROME_POPUP);
  await page.goto(`${base}/popup.html`);
  await page.waitForTimeout(400);

  eq('チャット行を2件描画した', await page.locator('#chatList .row').count(), 2);
  eq('全件数を表示した', await page.locator('#allCount').textContent(), '2');
  eq('選択件数を表示した', await page.locator('#selCount').textContent(), '1');
  eq('選択済みの行に on クラスが付く', await page.locator('#chatList .row.on').count(), 1);
  eq('未読ドットを表示した', await page.locator('#chatList .unread').count(), 1);

  // 設定タブへ既存値が反映されている
  eq('静音時間帯の開始が反映されている', await page.locator('#quietStart').inputValue(), '19:00');
  eq('静音時間帯の終了が反映されている', await page.locator('#quietEnd').inputValue(), '08:00');
  eq('キーワードが反映されている', await page.locator('#keywords').inputValue(), '至急\nレビュー');
  eq('キーワード監視のスイッチが入っている', await page.locator('#keywordsEnabled').isChecked(), true);

  // 行クリックで選択が保存される
  await page.locator('#chatList .row').nth(1).click();
  await page.waitForTimeout(200);
  const selected = await page.evaluate(() => window.__store.settings.selected);
  eq('クリックしたチャットが選択に入る', selected['19:bbb@thread.v2'], true);
  eq('選択件数が2に増える', await page.locator('#selCount').textContent(), '2');

  // 全解除
  await page.locator('#clearSel').click();
  await page.waitForTimeout(200);
  eq('全解除で選択が空になる',
    Object.keys(await page.evaluate(() => window.__store.settings.selected)).length, 0);

  // 検索フィルタ
  await page.locator('#filter').fill('総務');
  await page.waitForTimeout(200);
  eq('検索で行が絞り込まれる', await page.locator('#chatList .row').count(), 1);
  await page.locator('#filter').fill('');
  await page.waitForTimeout(200);

  // 履歴タブ
  await page.locator('.tabs button[data-tab="history"]').click();
  eq('履歴を2件描画した', await page.locator('#histList .hist').count(), 2);
  eq('キーワード通知にタグが付く', await page.locator('#histList .tag.keyword').count(), 1);
  eq('履歴件数を表示した', await page.locator('#histCount').textContent(), '2');

  // 監視スイッチ（チェックボックス本体は視覚的に隠してあるのでラベルを押す）
  eq('起動時は監視ONの表示', await page.locator('#dot.active').count(), 1);
  await page.locator('.header .switch').click();
  await page.waitForTimeout(200);
  eq('監視OFFが保存される', await page.evaluate(() => window.__store.settings.enabled), false);
  eq('監視OFFでインジケータが消える', await page.locator('#dot.active').count(), 0);

  ok('popup起動時に POPUP_OPENED を送る',
    (await page.evaluate(() => window.__sent)).some((m) => m.type === 'POPUP_OPENED'));

  eq('popupでJSエラーが出ない', errors.length, 0, errors.join('\n      '));
  await page.close();
}

// ------------------------------------------------------------------ 実行
console.log('teams-chat-notifier verification');
staticChecks();
logicChecks();
await domChecks();

console.log(`\n${failures === 0 ? '✅ PASS' : '❌ FAIL'} — ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
