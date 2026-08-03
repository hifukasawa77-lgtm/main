/**
 * Teams Chat Notifier — service worker
 *
 * content script から届く新着イベントを、設定（選択チャット / キーワード / 静音時間帯）
 * と突き合わせてデスクトップ通知に変換する。通知履歴も保持する。
 */

const SETTINGS_KEY = 'settings';
const ROSTER_KEY = 'roster';
const HISTORY_KEY = 'history';
const UNSEEN_KEY = 'unseen';

const HISTORY_MAX = 50;
const DEDUPE_MS = 5000;

const DEFAULT_SETTINGS = {
  enabled: true,
  selected: {},          // chatId -> true
  keywordsEnabled: false,
  keywords: [],
  quietEnabled: false,
  quietStart: '19:00',
  quietEnd: '08:00'
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get({ [SETTINGS_KEY]: null });
  if (!current[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !msg.type) return;
  switch (msg.type) {
    case 'CHAT_ROSTER':
      saveRoster(msg.chats || [], msg.diagnostic || '');
      break;
    case 'CHAT_ACTIVITY':
      handleActivity(msg.chat, sender && sender.tab ? sender.tab.id : null);
      break;
    case 'POPUP_OPENED':
      clearBadge();
      break;
    case 'OPEN_CHAT':
      openChat(msg.entry);
      break;
  }
});

// ---- 設定・保存領域 ---------------------------------------------------------
async function getSettings() {
  const res = await chrome.storage.local.get({ [SETTINGS_KEY]: null });
  return Object.assign({}, DEFAULT_SETTINGS, res[SETTINGS_KEY] || {});
}

async function getHistory() {
  const res = await chrome.storage.local.get({ [HISTORY_KEY]: [] });
  return Array.isArray(res[HISTORY_KEY]) ? res[HISTORY_KEY] : [];
}

async function saveRoster(chats, diagnostic) {
  await chrome.storage.local.set({
    [ROSTER_KEY]: { chats, diagnostic, updatedAt: Date.now() }
  });
}

// ---- 新着イベントの処理 -----------------------------------------------------
async function handleActivity(chat, tabId) {
  if (!chat || !chat.id) return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  const selected = settings.selected[chat.id] === true;
  const keywordHit = settings.keywordsEnabled ? matchKeyword(settings.keywords, chat) : '';
  if (!selected && !keywordHit) return;

  const history = await getHistory();
  const now = Date.now();

  // 同じチャットの同じ本文が短時間に重複して届いた場合は捨てる
  const duplicate = history.some(
    (h) => h.chatId === chat.id && h.body === chat.body && now - h.ts < DEDUPE_MS
  );
  if (duplicate) return;

  const quiet = isQuietNow(settings);
  const entry = {
    id: `n_${now}_${Math.random().toString(36).slice(2, 8)}`,
    chatId: chat.id,
    title: chat.title || '(名称不明のチャット)',
    sender: chat.sender || '',
    body: chat.body || '',
    url: chat.url || '',
    tabId: tabId || null,
    ts: now,
    tag: quiet ? 'quiet' : (selected ? '' : 'keyword'),
    keyword: keywordHit || ''
  };

  await chrome.storage.local.set({
    [HISTORY_KEY]: [entry, ...history].slice(0, HISTORY_MAX)
  });

  // 静音時間帯は通知を出さず履歴にだけ残す（後から popup で確認できる）
  if (quiet) return;

  notify(entry, !selected && keywordHit ? keywordHit : '');
  await bumpBadge();
}

function matchKeyword(keywords, chat) {
  const haystack = `${chat.title || ''}\n${chat.sender || ''}\n${chat.body || ''}`.toLowerCase();
  for (const raw of keywords || []) {
    const kw = String(raw).trim().toLowerCase();
    if (kw && haystack.includes(kw)) return raw;
  }
  return '';
}

/** 静音時間帯の判定。start > end の場合は日をまたぐ帯として扱う。 */
function isQuietNow(settings, date = new Date()) {
  if (!settings.quietEnabled) return false;
  const start = toMinutes(settings.quietStart);
  const end = toMinutes(settings.quietEnd);
  if (start === null || end === null || start === end) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  return start < end ? (now >= start && now < end) : (now >= start || now < end);
}

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// ---- 通知 -------------------------------------------------------------------
function notify(entry, keyword) {
  const options = {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: entry.title,
    message: entry.sender ? `${entry.sender}: ${entry.body}` : entry.body,
    priority: 2
  };
  if (keyword) options.contextMessage = `キーワード一致: ${keyword}`;

  chrome.notifications.create(entry.id, options, () => void chrome.runtime.lastError);
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  chrome.notifications.clear(notificationId);
  const history = await getHistory();
  const entry = history.find((h) => h.id === notificationId);
  if (entry) await openChat(entry);
});

/** 通知をクリックしたら Teams のタブを前面に出し、該当チャットへ遷移する。 */
async function openChat(entry) {
  if (!entry) return;
  const tabs = await chrome.tabs.query({
    url: ['https://teams.microsoft.com/*', 'https://teams.live.com/*']
  });

  if (tabs.length) {
    const tab = tabs.find((t) => t.id === entry.tabId) || tabs[0];
    const update = { active: true };
    if (entry.url) update.url = entry.url;
    await chrome.tabs.update(tab.id, update);
    await chrome.windows.update(tab.windowId, { focused: true });
    return;
  }

  if (entry.url) await chrome.tabs.create({ url: entry.url });
}

// ---- バッジ -----------------------------------------------------------------
async function bumpBadge() {
  const res = await chrome.storage.local.get({ [UNSEEN_KEY]: 0 });
  const count = Number(res[UNSEEN_KEY] || 0) + 1;
  await chrome.storage.local.set({ [UNSEEN_KEY]: count });
  chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
  chrome.action.setBadgeBackgroundColor({ color: '#22d3ee' });
}

async function clearBadge() {
  await chrome.storage.local.set({ [UNSEEN_KEY]: 0 });
  chrome.action.setBadgeText({ text: '' });
}
