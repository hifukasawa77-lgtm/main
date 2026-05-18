# AI Agent Proxy — Cloudflare Worker セットアップ

Workers AI (Gemma 2) を使ったリバースプロキシです。**APIキー不要**で最もセキュアな構成です。

---

## セットアップ手順

### Step 1: Cloudflareアカウント作成（無料）
https://cloudflare.com にアクセスしてアカウントを作成

### Step 2: Workers & Pages に移動
ダッシュボード左メニュー「Workers & Pages」→「Create」→「Create Worker」

### Step 3: Workerを作成
1. Worker名を入力（例: `ai-proxy`）
2. 「Deploy」を押してデフォルトのWorkerを作成
3. 「Edit code」ボタンをクリック
4. `gemini-proxy.js` の内容を全て貼り付けて「Save and deploy」

### Step 4: Workers AI バインディングを追加
Worker の設定画面 → 「Settings」→「Bindings」→「Add」→「AI」
- Variable name: `AI`
- 「Save」

> **APIキーは不要です。** Workers AI バインディングは Cloudflare が内部で管理します。

### Step 5: WorkerのURLを確認
Worker の概要ページに表示される URL をコピー
```
https://ai-proxy.{your-name}.workers.dev
```

### Step 6: index.html を更新
index.html の以下の行を変更:
```js
// 変更前
const AGENT_PROXY_URL = '';

// 変更後
const AGENT_PROXY_URL = 'https://ai-proxy.{your-name}.workers.dev';
```

---

## 使用モデル

`@cf/google/gemma-2-2b-it` (Gemma 2 2B Instruct)

Workers AI のモデルカタログ: https://developers.cloudflare.com/workers-ai/models/

---

## 無料枠

| サービス | 無料枠 |
|---|---|
| Cloudflare Workers | 100,000 リクエスト/日 |
| Cloudflare Workers AI | 10,000 neurons/日 |

---

## セキュリティ

- APIキー不要（Workers AI バインディングを使用）
- `ALLOWED_ORIGINS` にサイトのドメインのみ許可（他ドメインからは403）
- 入力長制限（500文字）でプロンプトインジェクション対策
- システムプロンプトはWorker側で管理（クライアントに非公開）
