/**
 * Teams Chat Notifier — content script
 *
 * Teams Web の左ペイン（チャット一覧）を定期スキャンし、
 *   - チャット名簿（roster）を popup 用に background へ送る
 *   - 最終メッセージのプレビュー文が変化したチャットを「新着」として background へ送る
 *
 * 【設計方針】Teams 側の DOM は予告なく変わる。壊れにくくするため:
 *   1. セレクタは SELECTORS に外出しし、候補を上から順に試す
 *   2. 全滅したら role / href ベースのヒューリスティックへフォールバック
 *   3. 新着判定は「未読バッジ」ではなく「プレビュー文の変化」で行う
 *      （バッジのセレクタは変わりやすいが、プレビュー文の表示自体は不変）
 */
(() => {
  'use strict';

  if (window.top !== window) return; // チャット一覧はトップフレームのみ

  const SCAN_INTERVAL_MS = 6000;
  const DEBOUNCE_MS = 700;

  // ---- Teams の DOM セレクタ候補（上から順に試す） ---------------------------
  const SELECTORS = {
    list: [
      '[data-tid="chat-list"]',
      '[data-tid="chat-list-container"]',
      '[data-tid="chatListPane"]',
      'div[role="tree"][aria-label]',
      'div[role="tree"]'
    ],
    item: [
      '[data-tid="chat-list-item"]',
      '[data-tid^="chat-list-item"]',
      'li[role="treeitem"]',
      '[role="treeitem"]',
      '[role="listitem"]'
    ],
    title: [
      '[data-tid="chat-list-item-title"]',
      '[data-tid="chat-list-item-subject"]',
      '[data-tid="title"]',
      'span[title]'
    ],
    preview: [
      '[data-tid="chat-list-item-preview"]',
      '[data-tid="preview-text"]',
      '[data-tid="chat-list-item-message"]'
    ],
    unread: [
      '[data-tid="chat-list-item-unread"]',
      '[data-tid="unread-indicator"]',
      '[data-tid="chat-list-item-badge"]'
    ]
  };

  // プレビュー欄に自分の発言が入ったときの接頭辞（通知しない）
  const SELF_SENDERS = ['あなた', '自分', 'You', 'you'];

  let enabled = true;
  let seeded = false;              // 初回スキャンは差分を出さず基準値だけ作る
  let observer = null;
  let observedRoot = null;
  let debounceTimer = null;
  const prevPreview = new Map();   // chatId -> 直近のプレビュー文

  // ---- 起動 ------------------------------------------------------------------
  chrome.storage.local.get({ settings: null }, (res) => {
    if (res.settings && typeof res.settings.enabled === 'boolean') {
      enabled = res.settings.enabled;
    }
    scan(true);
    setInterval(() => scan(false), SCAN_INTERVAL_MS);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const next = changes.settings.newValue;
    if (!next || typeof next.enabled !== 'boolean') return;
    const wasEnabled = enabled;
    enabled = next.enabled;
    // OFF の間の変化をまとめて通知しないよう、再開時は基準値を取り直す
    if (!wasEnabled && enabled) {
      seeded = false;
      prevPreview.clear();
      scan(true);
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'RESCAN') scan(true);
  });

  // ---- スキャン --------------------------------------------------------------
  function scan(force) {
    if (!enabled && !force) return;

    const root = resolveList();
    attachObserver(root);

    const chats = [];
    const seen = new Set();
    for (const el of collectItems(root)) {
      const chat = extract(el);
      if (!chat || !chat.title || seen.has(chat.id)) continue;
      seen.add(chat.id);
      chats.push(chat);
    }

    if (!chats.length) {
      send({
        type: 'CHAT_ROSTER',
        chats: [],
        diagnostic: 'チャット一覧を取得できませんでした。Teamsのチャット画面を開いているか確認してください。'
      });
      return;
    }

    const events = [];
    for (const chat of chats) {
      const before = prevPreview.get(chat.id);
      prevPreview.set(chat.id, chat.preview);
      if (!seeded) continue;                       // 初回は基準値作りのみ
      if (before === undefined) continue;          // 新規に現れた行も初回は見送る
      if (!chat.preview || chat.preview === before) continue;
      events.push(chat);
    }
    seeded = true;

    send({ type: 'CHAT_ROSTER', chats, diagnostic: '' });

    if (!enabled) return;
    for (const chat of events) {
      const { sender, body } = splitSender(chat.preview);
      if (SELF_SENDERS.includes(sender)) continue; // 自分の発言では通知しない
      send({
        type: 'CHAT_ACTIVITY',
        chat: { id: chat.id, title: chat.title, url: chat.url, sender, body }
      });
    }
  }

  // ---- DOM 抽出 --------------------------------------------------------------
  function resolveList() {
    for (const sel of SELECTORS.list) {
      const el = safeQuery(document, sel);
      if (el) return el;
    }
    return null;
  }

  function collectItems(root) {
    const scope = root || document;
    for (const sel of SELECTORS.item) {
      const els = safeQueryAll(scope, sel);
      if (els.length) return els;
    }
    // フォールバック: 会話へのリンクを持つ行を拾う
    const rows = new Set();
    for (const a of safeQueryAll(document, 'a[href*="/conversations/"]')) {
      rows.add(a.closest('[role="treeitem"],[role="listitem"],li') || a);
    }
    return Array.from(rows);
  }

  function extract(el) {
    const link = el.tagName === 'A' ? el : el.querySelector('a[href]');
    const href = link ? link.getAttribute('href') || '' : '';

    const segments = textSegments(el);

    const title = textOf(el, SELECTORS.title) || segments[0] || '';
    if (!title) return null;

    let preview = textOf(el, SELECTORS.preview);
    if (!preview && segments.length > 1) {
      const tail = segments[segments.length - 1];
      // 末尾が時刻・曜日だけならプレビューではない
      if (!looksLikeTimestamp(tail) && tail !== title) preview = tail;
    }

    const id = chatIdFrom(el, href, title);
    return {
      id,
      title,
      preview: preview || '',
      url: chatUrl(href, id),
      unread: isUnread(el)
    };
  }

  function chatIdFrom(el, href, title) {
    const fromHref = href.match(/\/conversations\/([^?#/]+)/);
    if (fromHref) return decodeURIComponent(fromHref[1]);

    const attr = `${el.getAttribute('data-tid') || ''} ${el.id || ''}`;
    const thread = attr.match(/(19:[^\s"']+)/);
    if (thread) return thread[1];

    return `title:${title}`;
  }

  function chatUrl(href, id) {
    if (href) {
      try {
        return new URL(href, location.origin).href;
      } catch (_) { /* 相対URLの解決に失敗したら下のフォールバックへ */ }
    }
    if (id.startsWith('19:')) {
      return `${location.origin}/_#/conversations/${encodeURIComponent(id)}?ctx=chat`;
    }
    return `${location.origin}/_#/conversations`;
  }

  function isUnread(el) {
    for (const sel of SELECTORS.unread) {
      if (safeQuery(el, sel)) return true;
    }
    const aria = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`;
    return /未読|unread/i.test(aria);
  }

  function looksLikeTimestamp(text) {
    return /^(\d{1,2}[:：]\d{2}(\s*(AM|PM))?|\d{1,2}\/\d{1,2}(\/\d{2,4})?|[月火水木金土日]曜?日?|昨日|Yesterday|(Mon|Tue|Wed|Thu|Fri|Sat|Sun))$/i
      .test(text.trim());
  }

  /** 「送信者: 本文」形式を分解する。分解できなければ本文のみ返す。 */
  function splitSender(preview) {
    const m = preview.match(/^([^:：]{1,24})[:：]\s*([\s\S]+)$/);
    if (m) return { sender: m[1].trim(), body: m[2].trim() };
    return { sender: '', body: preview };
  }

  /**
   * 行のテキストを「表示上の断片」単位で取り出す（例: ['開発チーム', '10:24', '田中: 資料を送りました']）。
   * innerText の改行に頼るとCSSレイアウト依存になり、行がインライン表示だと
   * 全部つながった1行として返ってしまうため、DOM構造から拾う。
   */
  function textSegments(el) {
    const out = [];
    const walk = (node) => {
      const children = Array.from(node.children || []);
      const hasTextChild = children.some((c) => (c.textContent || '').trim());
      if (!hasTextChild) {
        const text = (node.textContent || '').trim();
        if (text) out.push(text);
        return;
      }
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = (child.textContent || '').trim();
          if (text) out.push(text);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      }
    };
    walk(el);
    return out;
  }

  function textOf(el, candidates) {
    for (const sel of candidates) {
      const node = safeQuery(el, sel);
      const text = node && node.innerText ? node.innerText.trim() : '';
      if (text) return text;
    }
    return '';
  }

  function safeQuery(root, sel) {
    try {
      return root.querySelector(sel);
    } catch (_) {
      return null;
    }
  }

  function safeQueryAll(root, sel) {
    try {
      return Array.from(root.querySelectorAll(sel));
    } catch (_) {
      return [];
    }
  }

  // ---- 監視 ------------------------------------------------------------------
  /**
   * チャット一覧のコンテナにだけ MutationObserver を張る。
   * body 全体を subtree 監視すると Teams では負荷が高すぎるため、
   * コンテナが取れないときは定期スキャンだけに任せる。
   */
  function attachObserver(root) {
    if (!root || root === observedRoot) return;
    if (observer) observer.disconnect();
    observedRoot = root;
    observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => scan(false), DEBOUNCE_MS);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }

  function send(message) {
    try {
      chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
    } catch (_) {
      // 拡張のリロード直後などコンテキストが切れている場合は次回スキャンで回復する
    }
  }
})();
