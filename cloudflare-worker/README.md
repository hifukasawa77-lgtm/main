# AI Agent Proxy — Cloudflare Worker セットアップ

Workers AI を使ったリバースプロキシ ＋ KV共有学習メモリです。**APIキー不要**で最もセキュアな構成です。

---

## 自動デプロイ（GitHub Actions・推奨）

`.github/workflows/deploy-worker.yml` により、`cloudflare-worker/` 配下の変更が main に push されると自動でデプロイされます（KV namespace `AGENT_MEMORY` の作成・バインドも自動）。

**初回のみ、以下の1回だけの設定が必要です:**

1. **CloudflareでAPIトークンを作成**
   - https://dash.cloudflare.com/profile/api-tokens →「Create Token」→「Create Custom Token」
   - 権限（Permissions）に以下の2つを追加:
     - `Account` → `Workers Scripts` → `Edit`
     - `Account` → `Workers KV Storage` → `Edit`
   - 「Continue to summary」→「Create Token」→ 表示されたトークンをコピー
2. **GitHubにシークレットを登録**
   - このリポジトリの Settings → Secrets and variables → Actions →「New repository secret」
   - Name: `CLOUDFLARE_API_TOKEN` / Secret: コピーしたトークン
   - （トークンが複数のCloudflareアカウントに属する場合のみ `CLOUDFLARE_ACCOUNT_ID` も追加）
3. **ワークフローを実行**
   - リポジトリの Actions タブ →「Deploy Cloudflare Worker (ai-proxy)」→「Run workflow」
   - 末尾の Smoke test が `OK` になれば本番反映完了

> このトークンはGitHubのSecretsにのみ保存され、リポジトリのコードや設定ファイルには書き込みません。

---

## 手動セットアップ手順（ダッシュボードから行う場合）

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
`{"text":"...","source":"ai","key":"..."}` が返れば成功。2回目に同じ質問をすると `"source":"learned"`（KV設定済みの場合）になります。

---

## 使用モデル

以下を上から順に試行（先頭が利用不可なら自動フォールバック）:

1. `@cf/google/gemma-3-12b-it` (Gemma 3 12B Instruct)
2. `@cf/meta/llama-3.1-8b-instruct-fast`
3. `@cf/meta/llama-3.1-8b-instruct`

Workers AI のモデルカタログ: https://developers.cloudflare.com/workers-ai/models/

---

## 共有学習メモリの仕組み

- AIが回答した Q&A を KV に保存（最大400件）
- 次回以降、類似質問には保存済み回答を即返却 — **全訪問者で共有**され、AIの無料枠も消費しない
  - 比較前に文末の決まり文句（「教えて」「ください」「ですか」等）や末尾助詞を除去して正規化（表記ゆれ吸収）
  - 正規化後の文字バイグラム類似度 ≥ 0.75 でマッチ
- 保存されるのは **AIが生成した回答のみ**（訪問者の入力テキストは回答として保存されない）
- レスポンスにはエントリを特定する `key` が含まれ、サイト上の 👍/👎 ボタンはその `key` を `/feedback` に送って該当エントリに直接スコアを反映する（旧クライアント互換のため `key` 未指定時は質問文の類似検索にフォールバック）
- 👎が累積したエントリ（score ≤ -2）は自動削除される
- 容量超過時は「価値（評価×10＋利用回数）が低く、最近使われていない」エントリから自動的に入れ替えられる（鮮度・有用性ベース）

---

## 学習メモリの管理（admin.html）

`cloudflare-worker/admin.html` をブラウザで直接開く（`file://` でOK）と、学習メモリの内容を一覧・削除できます。

1. Workerに管理用トークンを設定:
   ```bash
   cd cloudflare-worker
   npx wrangler secret put ADMIN_TOKEN
   ```
   （`ADMIN_TOKEN` を設定しない場合、`/admin/*` は常に404を返し無効化されます）
2. `admin.html` を開き、Worker URL と上記トークンを入力 →「読み込み」
3. 質問・評価・利用回数・最終利用日時の一覧が表示され、不要なエントリは「削除」できる

> `admin.html` はポートフォリオサイトからはリンクされていない、ヒデ専用のローカルツールです。

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
- `/admin/*` は `ADMIN_TOKEN`（Secret）必須。未設定の場合は常に404で無効化される
