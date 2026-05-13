const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const apiKeyInput = document.getElementById('apiKey');
const languageSelect = document.getElementById('language');
const statusEl = document.getElementById('status');
const statusDot = document.getElementById('statusDot');

let isRecording = false;

async function init() {
  const saved = await chrome.storage.local.get(['apiKey', 'language', 'isRecording']);
  if (saved.apiKey) apiKeyInput.value = saved.apiKey;
  if (saved.language) languageSelect.value = saved.language;
  setUI(!!saved.isRecording);
}

startBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const language = languageSelect.value;

  if (!apiKey) {
    setStatus('APIキーを入力してください', 'error');
    return;
  }
  if (!apiKey.startsWith('sk-')) {
    setStatus('APIキーの形式が正しくありません (sk-...)', 'error');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const isTeamsTab = tab.url &&
    (tab.url.includes('teams.microsoft.com') || tab.url.includes('teams.live.com'));

  if (!isTeamsTab) {
    setStatus('TeamsのタブをアクティブにしてONにしてください', 'error');
    return;
  }

  await chrome.storage.local.set({ apiKey, language, isRecording: true });
  chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id, apiKey, language });
  setUI(true);
  setStatus('録音中...', 'ok');
});

stopBtn.addEventListener('click', async () => {
  chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
  await chrome.storage.local.set({ isRecording: false });
  setUI(false);
  setStatus('停止しました');
});

function setUI(recording) {
  isRecording = recording;
  startBtn.disabled = recording;
  stopBtn.disabled = !recording;
  startBtn.classList.toggle('recording', recording);
  statusDot.classList.toggle('active', recording);
}

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

init();
