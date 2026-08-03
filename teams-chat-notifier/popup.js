/**
 * Teams Chat Notifier — popup
 *
 * チャット一覧のチェックボックス選択・静音時間帯・キーワード監視・通知履歴のUI。
 * チャット名や本文は Teams 由来の外部文字列なので、innerHTML は使わず
 * textContent / createElement で描画する。
 */

const SETTINGS_KEY = 'settings';
const ROSTER_KEY = 'roster';
const HISTORY_KEY = 'history';

const DEFAULT_SETTINGS = {
  enabled: true,
  selected: {},
  keywordsEnabled: false,
  keywords: [],
  quietEnabled: false,
  quietStart: '19:00',
  quietEnd: '08:00'
};

const TEAMS_URLS = ['https://teams.microsoft.com/*', 'https://teams.live.com/*'];

const $ = (id) => document.getElementById(id);

let settings = { ...DEFAULT_SETTINGS };
let roster = { chats: [], diagnostic: '', updatedAt: 0 };
let history = [];
let filterText = '';

init();

async function init() {
  chrome.runtime.sendMessage({ type: 'POPUP_OPENED' }, () => void chrome.runtime.lastError);

  const stored = await chrome.storage.local.get({
    [SETTINGS_KEY]: null,
    [ROSTER_KEY]: null,
    [HISTORY_KEY]: []
  });
  settings = Object.assign({}, DEFAULT_SETTINGS, stored[SETTINGS_KEY] || {});
  roster = stored[ROSTER_KEY] || roster;
  history = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];

  bindTabs();
  bindControls();
  applySettingsToForm();
  renderAll();

  await requestRescan();

  // content script のスキャン結果が届いたら描画を更新する
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[ROSTER_KEY]) {
      roster = changes[ROSTER_KEY].newValue || roster;
      renderChats();
    }
    if (changes[HISTORY_KEY]) {
      history = changes[HISTORY_KEY].newValue || [];
      renderHistory();
    }
  });
}

// ---- 保存 -------------------------------------------------------------------
async function save() {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

async function requestRescan() {
  const tabs = await chrome.tabs.query({ url: TEAMS_URLS });
  if (!tabs.length) {
    roster = { chats: [], diagnostic: 'NO_TAB', updatedAt: Date.now() };
    renderChats();
    return;
  }
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: 'RESCAN' }, () => void chrome.runtime.lastError);
  }
}

// ---- イベント ---------------------------------------------------------------
function bindTabs() {
  document.querySelectorAll('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`panel-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function bindControls() {
  $('enabled').addEventListener('change', async (e) => {
    settings.enabled = e.target.checked;
    await save();
    renderStatus();
  });

  $('filter').addEventListener('input', (e) => {
    filterText = e.target.value.trim().toLowerCase();
    renderChats();
  });

  $('clearSel').addEventListener('click', async () => {
    settings.selected = {};
    await save();
    renderChats();
  });

  $('quietEnabled').addEventListener('change', async (e) => {
    settings.quietEnabled = e.target.checked;
    await save();
  });
  $('quietStart').addEventListener('change', async (e) => {
    settings.quietStart = e.target.value || DEFAULT_SETTINGS.quietStart;
    await save();
  });
  $('quietEnd').addEventListener('change', async (e) => {
    settings.quietEnd = e.target.value || DEFAULT_SETTINGS.quietEnd;
    await save();
  });

  $('keywordsEnabled').addEventListener('change', async (e) => {
    settings.keywordsEnabled = e.target.checked;
    await save();
  });
  $('keywords').addEventListener('change', async (e) => {
    settings.keywords = e.target.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    await save();
  });

  $('clearHist').addEventListener('click', async () => {
    history = [];
    await chrome.storage.local.set({ [HISTORY_KEY]: [] });
    renderHistory();
  });
}

function applySettingsToForm() {
  $('enabled').checked = settings.enabled;
  $('quietEnabled').checked = settings.quietEnabled;
  $('quietStart').value = settings.quietStart;
  $('quietEnd').value = settings.quietEnd;
  $('keywordsEnabled').checked = settings.keywordsEnabled;
  $('keywords').value = (settings.keywords || []).join('\n');
}

// ---- 描画 -------------------------------------------------------------------
function renderAll() {
  renderStatus();
  renderChats();
  renderHistory();
}

function renderStatus() {
  $('dot').classList.toggle('active', !!settings.enabled);
}

function renderChats() {
  const list = $('chatList');
  const warn = $('rosterWarn');
  list.textContent = '';
  warn.textContent = '';

  const chats = roster.chats || [];
  const selectedIds = Object.keys(settings.selected || {}).filter((k) => settings.selected[k]);

  $('allCount').textContent = String(chats.length);
  $('selCount').textContent = String(selectedIds.length);

  if (roster.diagnostic === 'NO_TAB') {
    warn.appendChild(warnBox(
      'Teams のタブが見つかりません。ブラウザで teams.microsoft.com を開いた状態で使用してください。'
    ));
  } else if (roster.diagnostic) {
    warn.appendChild(warnBox(roster.diagnostic));
  }

  if (!chats.length) {
    list.appendChild(emptyBox(
      'チャット一覧がまだ取得できていません。\nTeams のチャット画面を開いて数秒待ってから、もう一度開いてください。'
    ));
    return;
  }

  const visible = filterText
    ? chats.filter((c) => `${c.title} ${c.preview}`.toLowerCase().includes(filterText))
    : chats;

  if (!visible.length) {
    list.appendChild(emptyBox('該当するチャットがありません。'));
    return;
  }

  for (const chat of visible) {
    list.appendChild(chatRow(chat));
  }
}

function chatRow(chat) {
  const on = settings.selected[chat.id] === true;

  const row = document.createElement('div');
  row.className = on ? 'row on' : 'row';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = on;

  const body = document.createElement('div');
  body.className = 'body';

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = chat.title;
  body.appendChild(name);

  if (chat.preview) {
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = chat.preview;
    body.appendChild(sub);
  }

  row.appendChild(box);
  row.appendChild(body);

  if (chat.unread) {
    const dot = document.createElement('div');
    dot.className = 'unread';
    dot.title = '未読';
    row.appendChild(dot);
  }

  const toggle = async (checked) => {
    if (checked) settings.selected[chat.id] = true;
    else delete settings.selected[chat.id];
    await save();
    renderChats();
  };

  box.addEventListener('click', (e) => e.stopPropagation());
  box.addEventListener('change', (e) => toggle(e.target.checked));
  row.addEventListener('click', () => toggle(!box.checked));

  return row;
}

function renderHistory() {
  const list = $('histList');
  list.textContent = '';
  $('histCount').textContent = String(history.length);

  if (!history.length) {
    list.appendChild(emptyBox('通知履歴はまだありません。'));
    return;
  }

  for (const entry of history) {
    list.appendChild(historyRow(entry));
  }
}

function historyRow(entry) {
  const item = document.createElement('div');
  item.className = 'hist';

  const top = document.createElement('div');
  top.className = 'top';

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = entry.title;
  top.appendChild(name);

  if (entry.tag === 'keyword' || entry.tag === 'quiet') {
    const tag = document.createElement('span');
    tag.className = `tag ${entry.tag}`;
    tag.textContent = entry.tag === 'keyword' ? 'キーワード' : '静音中';
    top.appendChild(tag);
  }

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = formatTime(entry.ts);
  top.appendChild(time);

  const msg = document.createElement('div');
  msg.className = 'msg';
  msg.textContent = entry.sender ? `${entry.sender}: ${entry.body}` : entry.body;

  item.appendChild(top);
  item.appendChild(msg);

  item.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_CHAT', entry }, () => void chrome.runtime.lastError);
    window.close();
  });

  return item;
}

// ---- 小物 -------------------------------------------------------------------
function warnBox(text) {
  const el = document.createElement('div');
  el.className = 'warn';
  el.textContent = text;
  return el;
}

function emptyBox(text) {
  const el = document.createElement('div');
  el.className = 'empty';
  el.textContent = text;
  return el;
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? hhmm : `${d.getMonth() + 1}/${d.getDate()} ${hhmm}`;
}
