let mediaRecorder = null;
let audioChunks = [];
let apiKey = '';
let language = 'ja';
let prevTranscript = ''; // 直前の認識結果（Whisper prompt用）
const CHUNK_INTERVAL_MS = 10000;
const MIN_BLOB_SIZE = 1000; // Whisper に送る最小バイト数
const PROMPT_MAX_CHARS = 500;

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'START_RECORDING') {
    await startRecording(msg.streamId, msg.apiKey, msg.language);
  } else if (msg.type === 'STOP_RECORDING') {
    stopRecording();
  }
});

async function startRecording(streamId, key, lang) {
  apiKey = key;
  language = lang;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });
  } catch (err) {
    chrome.runtime.sendMessage({ type: 'CAPTURE_ERROR', message: `マイクアクセスエラー: ${err.message}` });
    return;
  }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      audioChunks.push(e.data);
    }
  };

  mediaRecorder.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
  };

  // CHUNK_INTERVAL_MS ごとに ondataavailable が発火する
  mediaRecorder.start(CHUNK_INTERVAL_MS);

  // チャンク処理ループ
  (async function processLoop() {
    while (mediaRecorder && mediaRecorder.state !== 'inactive') {
      await sleep(CHUNK_INTERVAL_MS);
      if (audioChunks.length === 0) continue;

      const chunks = audioChunks.splice(0, audioChunks.length);
      const blob = new Blob(chunks, { type: mimeType });

      if (blob.size < MIN_BLOB_SIZE) continue;

      await transcribe(blob, mimeType);
    }
  })();
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  mediaRecorder = null;
  audioChunks = [];
  prevTranscript = '';
}

async function transcribe(blob, mimeType) {
  const formData = new FormData();
  const ext = mimeType.includes('webm') ? 'webm' : 'wav';
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', language);
  if (prevTranscript) {
    formData.append('prompt', prevTranscript.slice(-PROMPT_MAX_CHARS));
  }

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      chrome.runtime.sendMessage({
        type: 'CAPTURE_ERROR',
        message: `Whisper APIエラー (${res.status}): ${err.error?.message || res.statusText}`
      });
      return;
    }

    const data = await res.json();
    const text = (data.text || '').trim();
    if (text) {
      prevTranscript += (prevTranscript ? ' ' : '') + text;
      chrome.runtime.sendMessage({ type: 'TRANSCRIPT', text });
    }
  } catch (err) {
    chrome.runtime.sendMessage({ type: 'CAPTURE_ERROR', message: `ネットワークエラー: ${err.message}` });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
