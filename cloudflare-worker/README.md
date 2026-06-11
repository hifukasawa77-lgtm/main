# AI Agent Proxy — Cloudflare Worker セットアップ

Workers AI を使ったリバースプロキシ ＋ KV共有学習メモリです。**APIキー不要**で最もセキュアな構成です。

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

### Step 5: KV namespace を作成（共有学習メモリ用）
1. ダッシュボード左メニュー「Storage & Databases」→「KV」→「Create namespace」
2. Namespace名: `AGENT_MEMORY` を入力して作成
3. Worker の設定画面 → 「Settings」→「Bindings」→「Add」→「KV namespace」
   - Variable name: `KV`
   - KV namespace: `AGENT_MEMORY` を選択
   - 「Save」

> KV を設定しなくても Worker は動作します（学習機能だけがオフになります）。

### Step 6: WorkerのURLを確認
Worker の概要ページに表示される URL をコピー
```
https://ai-proxy.{your-name}.workers.dev
```

### Step 7: index.html を更新
index.html の以下の行を変更:
```js
const AGENT_PROXY_URL = 'https://ai-proxy.{your-name}.workers.dev';
```

---

## 更新（再デプロイ）の手順

`gemini-proxy.js` を変更した場合、**リポジトリへのpushだけでは反映されません**。

1. ダッシュボード「Workers & Pages」→ `ai-proxy` →「Edit code」
2. 最新の `gemini-proxy.js` の内容を全て貼り付け
3. 「Save and deploy」

### 動作確認（ブラウザの開発者コンソール or curl）
```bash
curl -X POST 'https://ai-proxy.{your-name}.workers.dev' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://hifukasawa77-lgtm.github.io' \
  -d '{"message":"こんにちは","history":[]}'
```
`{"text":"...","source":"ai"}` が返れば成功。2回目に同じ質問をすると `"source":"learned"`（KV設定済みの場合）になります。

---

## 使用モデル

以下を上から順に試行（先頭が利用不可なら自動フォールバック）:

1. `@cf/google/gemma-3-12b-it` (Gemma 3 12B Instruct)
2. `@cf/meta/llama-3.1-8b-instruct-fast`
3. `@cf/meta/llama-3.1-8b-instruct`

Workers AI のモデルカタログ: https://developers.cloudflare.com/workers-ai/models/

---

## 共有学習メモリの仕組み

- AIが回答した Q&A を KV に保存（最大300件・古いものから削除）
- 次回以降、類似質問（文字バイグラム類似度 ≥ 0.85）には保存済み回答を即返却 — **全訪問者で共有**され、AIの無料枠も消費しない
- 保存されるのは **AIが生成した回答のみ**（訪問者の入力テキストは回答として保存されない）
- サイト上の 👍/👎 ボタンが `/feedback` エンドポイントに送られ、👎が累積したエントリ（score ≤ -2）は自動削除される

---

## 無料枠

| サービス | 無料枠 |
|---|---|
| Cloudflare Workers | 100,000 リクエスト/日 |
| Cloudflare Workers AI | 10,000 neurons/日 |
| Cloudflare KV | 読み取り100,000回/日・書き込み1,000回/日 |

---

## セキュリティ

- APIキー不要（Workers AI バインディングを使用）
- `ALLOWED_ORIGINS` にサイトのドメインのみ許可（他ドメインからは403）
- 入力長制限（500文字）でプロンプトインジェクション対策
- システムプロンプトはWorker側で管理（クライアントに非公開）
- 学習メモリにはAI生成回答のみ保存（訪問者による任意テキストの注入不可）
