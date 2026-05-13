let offscreenCreated = false;
let activeTabId = null;

chrome.runtime.onMessage.addListener((msg) => {
  switch (msg.type) {
    case 'START_CAPTURE':
      startCapture(msg.tabId, msg.apiKey, msg.language);
      break;
    case 'STOP_CAPTURE':
      stopCapture();
      break;
    case 'TRANSCRIPT':
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'TRANSCRIPT', text: msg.text });
      }
      break;
    case 'CAPTURE_ERROR':
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'SHOW_ERROR', message: msg.message });
      }
      break;
  }
});

async function startCapture(tabId, apiKey, language) {
  activeTabId = tabId;

  if (!offscreenCreated) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Teams会議の音声をキャプチャして文字起こしするため'
    });
    offscreenCreated = true;
  }

  chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
    if (chrome.runtime.lastError || !streamId) {
      console.error('tabCapture error:', chrome.runtime.lastError);
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, {
          type: 'SHOW_ERROR',
          message: '音声キャプチャに失敗しました。タブをリロードして再試行してください。'
        });
      }
      return;
    }
    // offscreen document が初期化されるまで少し待つ
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'START_RECORDING', streamId, apiKey, language });
    }, 300);
  });

  chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY' });
}

async function stopCapture() {
  chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });

  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { type: 'STOP_OVERLAY' });
    activeTabId = null;
  }

  setTimeout(async () => {
    if (offscreenCreated) {
      await chrome.offscreen.closeDocument();
      offscreenCreated = false;
    }
  }, 1000);
}
