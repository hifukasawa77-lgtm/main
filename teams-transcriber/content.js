(function () {
  if (window.__teamsTranscriber) return;
  window.__teamsTranscriber = true;

  let overlay = null;
  let transcripts = [];
  let isRecording = false;

  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'SHOW_OVERLAY':
        showOverlay();
        setRecordingState(true);
        break;
      case 'STOP_OVERLAY':
        setRecordingState(false);
        break;
      case 'TRANSCRIPT':
        appendTranscript(msg.text);
        break;
      case 'SHOW_ERROR':
        showError(msg.message);
        break;
    }
  });

  function showOverlay() {
    if (overlay) return;

    injectStyles();

    overlay = document.createElement('div');
    overlay.id = 'tt-overlay';
    overlay.innerHTML = `
      <div class="tt-header" id="tt-header">
        <div class="tt-title">
          <span class="tt-dot" id="tt-dot"></span>
          文字起こし
        </div>
        <div class="tt-controls">
          <button id="tt-summarize" title="要約してテキスト保存">要約保存</button>
          <button id="tt-export" title="テキスト保存">全文保存</button>
          <button id="tt-copy" title="クリップボードにコピー">コピー</button>
          <button id="tt-clear" title="クリア">クリア</button>
          <button id="tt-close" title="閉じる">×</button>
        </div>
      </div>
      <div class="tt-body" id="tt-body">
        <div class="tt-placeholder">録音中... 音声を検出すると文字起こしが表示されます</div>
      </div>
    `;

    document.body.appendChild(overlay);
    makeDraggable(overlay, document.getElementById('tt-header'));

    document.getElementById('tt-close').onclick = () => { overlay.remove(); overlay = null; };
    document.getElementById('tt-clear').onclick = clearAll;
    document.getElementById('tt-copy').onclick = copyToClipboard;
    document.getElementById('tt-export').onclick = exportAsText;
    document.getElementById('tt-summarize').onclick = summarizeAndExport;
  }

  function setRecordingState(recording) {
    isRecording = recording;
    const dot = document.getElementById('tt-dot');
    if (dot) dot.classList.toggle('tt-dot-active', recording);
  }

  function appendTranscript(text) {
    if (!overlay) showOverlay();

    const body = document.getElementById('tt-body');
    const placeholder = body.querySelector('.tt-placeholder');
    if (placeholder) placeholder.remove();

    const time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    transcripts.push({ time, text });

    const entry = document.createElement('div');
    entry.className = 'tt-entry';
    entry.innerHTML = `<span class="tt-time">${time}</span><span class="tt-text">${escapeHtml(text)}</span>`;
    body.appendChild(entry);
    body.scrollTop = body.scrollHeight;
  }

  function showError(message) {
    if (!overlay) showOverlay();
    const body = document.getElementById('tt-body');
    const entry = document.createElement('div');
    entry.className = 'tt-entry tt-error';
    entry.textContent = `⚠ ${message}`;
    body.appendChild(entry);
    body.scrollTop = body.scrollHeight;
  }

  function clearAll() {
    transcripts = [];
    const body = document.getElementById('tt-body');
    if (body) body.innerHTML = '<div class="tt-placeholder">クリアしました</div>';
  }

  function copyToClipboard() {
    const text = transcripts.map(t => `[${t.time}] ${t.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => flashButton('tt-copy', 'コピー済'));
  }

  function exportAsText() {
    const text = transcripts.map(t => `[${t.time}] ${t.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
    a.download = `transcript_${date}.txt`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function summarizeAndExport() {
    if (transcripts.length === 0) {
      flashButton('tt-summarize', '内容なし');
      return;
    }

    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
      flashButton('tt-summarize', 'APIキー未設定');
      return;
    }

    const btn = document.getElementById('tt-summarize');
    btn.textContent = '要約中...';
    btn.disabled = true;

    const fullText = transcripts.map(t => `[${t.time}] ${t.text}`).join('\n');
    const prompt = `以下は会議の文字起こしです。次の形式でMarkdown形式の日本語要約を作成してください。\n\n## 概要\n（2〜3文で会議全体の内容を要約）\n\n## 主要な議題\n（箇条書き）\n\n## 決定事項\n（箇条書き。なければ「なし」）\n\n## アクションアイテム\n（担当者・期限があれば記載。なければ「なし」）\n\n---\n文字起こし:\n${fullText}`;

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || res.statusText);
      }

      const data = await res.json();
      const summary = (data.choices?.[0]?.message?.content || '').trim();

      const date = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
      const content = `${summary}\n\n${'='.repeat(60)}\n全文\n${'='.repeat(60)}\n${fullText}`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `summary_${date}.txt`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showError(`要約エラー: ${err.message}`);
    } finally {
      btn.textContent = '要約保存';
      btn.disabled = false;
    }
  }

  function flashButton(id, label) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = label;
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function makeDraggable(el, handle) {
    let ox = 0, oy = 0;
    handle.style.cursor = 'move';
    handle.addEventListener('mousedown', (e) => {
      ox = e.clientX - el.getBoundingClientRect().left;
      oy = e.clientY - el.getBoundingClientRect().top;
      const onMove = (e) => {
        el.style.left = (e.clientX - ox) + 'px';
        el.style.top = (e.clientY - oy) + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
  }

  function injectStyles() {
    if (document.getElementById('tt-styles')) return;
    const style = document.createElement('style');
    style.id = 'tt-styles';
    style.textContent = `
      #tt-overlay {
        position: fixed;
        bottom: 90px;
        right: 24px;
        width: 400px;
        max-height: 320px;
        background: rgba(12, 12, 22, 0.94);
        border: 1px solid rgba(0, 200, 255, 0.35);
        border-radius: 12px;
        backdrop-filter: blur(12px);
        z-index: 2147483647;
        font-family: 'Segoe UI', 'Meiryo', sans-serif;
        font-size: 13px;
        color: #dde;
        box-shadow: 0 4px 32px rgba(0, 180, 255, 0.18), 0 0 0 1px rgba(0,200,255,0.1);
        display: flex;
        flex-direction: column;
        resize: both;
        overflow: hidden;
        user-select: none;
      }
      .tt-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(0, 180, 255, 0.08);
        border-bottom: 1px solid rgba(0, 200, 255, 0.18);
        flex-shrink: 0;
      }
      .tt-title {
        font-size: 12px;
        font-weight: 600;
        color: #7ee8ff;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tt-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #555;
        transition: background 0.3s;
      }
      .tt-dot-active {
        background: #ff4444;
        animation: tt-pulse 1.2s ease-in-out infinite;
      }
      @keyframes tt-pulse {
        0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255,68,68,0.4); }
        50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(255,68,68,0); }
      }
      .tt-controls {
        display: flex;
        gap: 5px;
      }
      .tt-controls button {
        padding: 2px 9px;
        border: 1px solid rgba(0, 200, 255, 0.3);
        background: transparent;
        color: #7ee8ff;
        border-radius: 5px;
        cursor: pointer;
        font-size: 11px;
        transition: background 0.15s;
      }
      .tt-controls button:hover {
        background: rgba(0, 200, 255, 0.15);
      }
      #tt-close {
        border-color: rgba(255,100,100,0.35) !important;
        color: #ff9999 !important;
      }
      #tt-close:hover {
        background: rgba(255,100,100,0.15) !important;
      }
      .tt-body {
        padding: 10px 12px;
        overflow-y: auto;
        flex: 1;
        user-select: text;
        min-height: 60px;
      }
      .tt-placeholder {
        color: rgba(150,180,200,0.45);
        font-size: 12px;
        text-align: center;
        padding: 20px 0;
      }
      .tt-entry {
        margin-bottom: 7px;
        padding: 5px 8px;
        background: rgba(255,255,255,0.03);
        border-radius: 6px;
        border-left: 2px solid rgba(0,200,255,0.3);
        line-height: 1.55;
      }
      .tt-time {
        color: rgba(0,200,255,0.5);
        font-size: 10px;
        margin-right: 6px;
        font-variant-numeric: tabular-nums;
      }
      .tt-text { color: #cde; }
      .tt-error {
        border-left-color: rgba(255,80,80,0.5);
        color: #ff9999;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
  }
})();
