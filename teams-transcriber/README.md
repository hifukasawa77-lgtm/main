# Teams Transcriber

Microsoft Teams Web会議のリアルタイム文字起こし Chrome/Edge 拡張機能。

## 動作要件

- Chrome または Microsoft Edge (最新版)
- OpenAI APIキー (`sk-...`)
- Teams **Web版** (`teams.microsoft.com`) — デスクトップアプリは非対応

## インストール手順

1. Chrome/Edge で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」→ この `teams-transcriber/` フォルダを選択

## 使い方

1. ブラウザで Teams 会議を開く
2. 拡張アイコンをクリックしてポップアップを開く
3. OpenAI APIキーと言語を設定
4. **開始** をクリック
5. 画面右下に文字起こしオーバーレイが表示される
6. 会議終了後に **停止** → 「保存」か「コピー」でテキストを取得

## 仕組み

```
Teamsタブ音声
  → chrome.tabCapture (background.js)
  → MediaRecorder 6秒チャンク (offscreen.js)
  → Whisper API (openai.com/v1/audio/transcriptions)
  → content.js オーバーレイに表示
```

## 注意事項

- APIキーはブラウザの `chrome.storage.local` にのみ保存されます（外部送信なし）
- Whisper API の利用料金が発生します（目安: 1時間 ≒ $0.36）
- 6秒ごとに送信するため、約6〜8秒の遅延があります
- 無音区間はスキップされます
