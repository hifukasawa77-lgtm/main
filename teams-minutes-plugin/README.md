# Teams 議事録文字起こし要約ツール（MVP）

このディレクトリは、Microsoft Teams 向け「議事録文字起こし要約ツール」の最小実装を始めるための土台です。

## 目的

- 会議の音声をテキスト化（文字起こし）
- テキストを自動要約（決定事項 / TODO / 論点）
- Teams のチャットまたはタブから要約を確認・共有

## 推奨アーキテクチャ

1. **Teams App (フロント)**
   - 会議チャットから起動できるタブ（Personal/Channel Tab）
   - 会議一覧、処理ステータス、要約結果を表示

2. **Bot / API (バックエンド)**
   - Teams から会議情報を受信
   - 音声/録画データの取得（Graph API）
   - 文字起こしジョブ実行
   - LLM に要約リクエスト

3. **データストア**
   - `meetings` テーブル：会議メタデータ
   - `transcripts` テーブル：全文テキスト
   - `summaries` テーブル：要約結果（版管理推奨）

## MVP の実装範囲

- [x] Teams アプリマニフェストのひな形
- [x] API 契約（最小）
- [x] 要約フォーマット定義
- [x] ローカルMVP API / タブ画面
- [ ] Graph API 連携
- [ ] 実際の文字起こしエンジン接続
- [ ] 本番認証・権限設定

## ローカル実行

Node.js 18 以上で、追加パッケージなしに動きます。

```bash
cd teams-minutes-plugin
npm test
npm start
```

起動後、ブラウザで `http://localhost:3978` を開くと、Teams タブ想定の入力画面を確認できます。

現在の要約器は外部APIを呼ばないルールベースMVPです。Graph API で取得した文字起こし、または既存の `teams-transcriber` で保存した文字起こしテキストを投入し、後続で LLM 要約へ差し替える前提です。

## API 契約（最小）

### 1) 会議登録

`POST /api/meetings`

```json
{
  "meetingId": "string",
  "title": "string",
  "startedAt": "2026-05-13T10:00:00Z"
}
```

### 2) 文字起こし投入

`POST /api/meetings/:meetingId/transcripts`

```json
{
  "language": "ja-JP",
  "segments": [
    { "speaker": "A", "text": "...", "timestamp": "2026-05-13T10:03:00Z" }
  ]
}
```

### 3) 要約生成

`POST /api/meetings/:meetingId/summarize`

```json
{
  "style": "executive",
  "maxBullets": 8,
  "includeActionItems": true
}
```

### 4) 要約取得

`GET /api/meetings/:meetingId/summary`

### 5) Teams 投稿用 Adaptive Card 取得

`GET /api/meetings/:meetingId/adaptive-card`

## 要約出力フォーマット（推奨）

```json
{
  "meetingId": "string",
  "headline": "1行要約",
  "decisions": ["決定事項1", "決定事項2"],
  "actionItems": [
    { "owner": "山田", "task": "見積作成", "dueDate": "2026-05-20" }
  ],
  "risks": ["懸念点"],
  "openQuestions": ["未決事項"]
}
```

## セキュリティ・運用メモ

- 個人情報/機密語のマスキングを要約前に実行
- 監査ログ（誰がいつ要約を閲覧/再生成したか）を保持
- データ保持期間（例: 90日）を設定
- 要約品質評価（ユーザーの👍/👎）を保存して改善ループを回す

## 次の一手

1. Azure AD アプリ登録と Graph 権限設計
2. Teams Toolkit で Tab + Bot の雛形生成
3. `src/server.js` のルールベース要約を LLM 要約へ差し替え
4. 会議チャットへの要約投稿（Adaptive Card）まで通す
