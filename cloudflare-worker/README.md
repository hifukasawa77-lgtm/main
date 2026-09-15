# AI Agent Proxy — Cloudflare Worker セットアップ

Workers AI を使ったプロキシです。APIキーをブラウザへ配布せず、Worker側のバインディングで実行します。

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

## 会話のプライバシー（2026-09-14変更）

訪問者の質問・履歴に由来する回答はKVへ自動保存せず、他の訪問者への回答にも再利用しません。AI生成文にも入力者の個人情報が含まれる可能性があるためです。匿名の共有メモリ更新（/feedback）も無効にしています。チャット自体は引き続き利用できます。

以前のKVデータは自動削除していません。管理画面から確認・削除してください。/stats は件数・数値のみを返し、質問文・回答・エントリキーは公開しません。

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

- 本番Originは完全一致で照合します。CORSはブラウザのアクセス制御であり、API認証の代わりにはなりません。ローカル開発を許可する場合のみ、環境変数 ALLOW_LOCAL_DEV を文字列 true に設定します。
- RATE_LIMITER バインディングを必須化しています。ai-proxy はIPごとに30回/60秒、notebook-proxy は10回/60秒。Cloudflare拠点ごとの近似制限なので、厳密な課金上限ではありません。共有IPでは複数の利用者に制限が及びます。namespace_id はこのアカウントの他の設定と重複させないでください。
- バインディング未設定・障害時は503、上限超過は429を返し、AIを呼びません。両WorkerのTOML設定も一緒に反映してください。
- AIプロキシは16 KiB、ノートブックは128 KiBまで、Content-Lengthに頼らず受信バイトを制限してからJSONを解析します。ノートブックは1ソース8,000文字・合計20,000文字までです。
- メッセージの長さ制限はリソース保護です。プロンプトインジェクションを完全に防ぐものではありません。
- 管理APIは X-Admin-Token ヘッダーのみを受け付けます。URLの token パラメータは廃止しました。ADMIN_TOKEN未設定時は管理APIを404で無効化します。
- 管理画面はトークンをlocalStorageへ保存しません。旧保存値は管理画面を次に開いた際に削除します。以前使った別のブラウザ・端末にも保存値が残り得るため、管理用トークンのローテーションを推奨します。
- 管理画面のCORSはローカルファイル利用との互換性のため全Originを許可しますが、毎回トークンで認可します。任意Origin許可を認証とは扱いません。
- AI・管理レスポンスはno-store。上流AIサービスの例外詳細はクライアントへ返しません。

## 検証と反映

リポジトリ直下で以下を実行します。

```sh
node scripts/security-csp.mjs
node --test tests/security.test.mjs
node scripts/verify-service-worker.mjs
npm ci --ignore-scripts
node scripts/security-browser.cjs
```

HTML内のスクリプトを編集した場合は node scripts/security-csp.mjs --write でCSPハッシュを再生成してください。

mainへの反映後、既存のdeploy-worker.ymlがai-proxyをデプロイします。notebook-proxyは別設定のため、承認済みの運用環境で npx wrangler deploy --config cloudflare-worker/wrangler-notebook.toml を別途実行する必要があります。この修正だけではCloudflareの既存設定やKVデータは変更されません。
