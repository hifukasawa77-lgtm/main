# SNS自動投稿のセットアップ

`Auto Social Post`（毎週水曜 21:00 JST）が X / Instagram / Bluesky / Reddit へ投稿するために必要な
GitHub Secrets の登録手順。**認証情報が未設定のプラットフォームはスキップされる**ので、
やりたいものから1つずつ足していけばよい。

登録場所: リポジトリ → Settings → Secrets and variables → Actions → New repository secret

> **費用**: 以下はすべて無料枠のみで完結する（CLAUDE.md「有料APIキー禁止」に抵触しない）。
> X の無料枠は月500投稿まで。本ワークフローは週1（月4〜5投稿）なので上限に当たらない。

---

## X（旧Twitter）— 4つ

| Secret 名 | 取得元 |
|---|---|
| `X_API_KEY` | Consumer Keys → API Key |
| `X_API_SECRET` | Consumer Keys → API Key Secret |
| `X_ACCESS_TOKEN` | Authentication Tokens → Access Token |
| `X_ACCESS_TOKEN_SECRET` | Authentication Tokens → Access Token Secret |

1. <https://developer.x.com/> にログインし、Free プランでアプリを作る
2. アプリの **User authentication settings** で **App permissions を Read and write** にする
   （既定は Read only。ここを直さずにトークンを作ると **投稿だけ 403 で落ちる**）
3. Keys and tokens タブで上記4つを発行する
   （**権限を変更した場合は Access Token を作り直す**。古いトークンには古い権限が焼き付いている）

## Instagram — 2つ

| Secret 名 | 内容 |
|---|---|
| `IG_USER_ID` | Instagram **ビジネス/クリエイター**アカウントのID（数字） |
| `IG_ACCESS_TOKEN` | Facebookページ経由の長期アクセストークン |

前提（個人アカウントのままでは投稿APIが使えない）:

1. Instagram を**プロアカウント（ビジネスまたはクリエイター）**に切り替える
2. **Facebookページ**を作り、Instagram アカウントと連携する
3. <https://developers.facebook.com/> でアプリを作り、**Instagram Graph API** を追加
4. 必要な権限: `instagram_basic` / `instagram_content_publish` / `pages_show_list` / `pages_read_engagement`
5. グラフAPIエクスプローラで短期トークンを発行 → **長期トークン（60日）に交換**して `IG_ACCESS_TOKEN` に入れる
6. `me/accounts` → 該当ページの `instagram_business_account.id` が `IG_USER_ID`

**注意: 長期トークンは60日で失効する。** 期限が切れると投稿がエラーになるので、
2ヶ月に一度は取り直す（カレンダーに繰り返し予定を入れておくと確実）。

投稿画像は `assets/marketing/*.jpg` を GitHub Pages 経由で Meta が取りに来る。
**画像はリポジトリにコミットされ公開されている必要がある**（ローカルのファイルは渡せない）。

## Bluesky — 2つ

| Secret 名 | 内容 |
|---|---|
| `BLUESKY_HANDLE` | `xxxx.bsky.social` 形式のハンドル |
| `BLUESKY_APP_PASSWORD` | 設定 → App Passwords で発行（**本体のパスワードは使わない**） |

## Reddit — 4つ

| Secret 名 | 内容 |
|---|---|
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | <https://www.reddit.com/prefs/apps> で script タイプのアプリを作成 |
| `REDDIT_USERNAME` / `REDDIT_PASSWORD` | 投稿に使うRedditアカウント |

---

## 動作確認（投稿せずに試す）

Actions → Auto Social Post → Run workflow で **dry_run に ✓** を入れて実行すると、
実際には投稿せず「何を投稿するか」だけをログに出す。文面の確認はこれで行う。

投稿前の機械検査（認証情報が無くても実行できる）:

```bash
node scripts/verify-social-posts.mjs
```

検査内容: OAuth 1.0a 署名がX公式のテストベクタと一致するか／X 280文字・Instagram 2200文字の上限／
Instagram画像がJPEGで実在するか／投稿文のゲーム本数が実データ（`agent-data.js`）と一致するか。

ローカルでも同じことができる:

```bash
node scripts/post-social.js x --dry-run
node scripts/post-social.js instagram --dry-run
```

本番投稿は dry_run のチェックを外して Run workflow（または毎週水曜の自動実行を待つ）。

## 文面を変えるとき

投稿文の**正本は `marketing/social_2026-08_x_instagram.md`**。
`scripts/post-social.js` の `X_POSTS` / `INSTAGRAM_POSTS` はその実行用の写しなので、**両方を直す**。
変更後は必ず `--dry-run` で文字数（X: 280、Instagram: 2200）を確認すること。

## 画像を作り直すとき

Instagram用の1080×1080画像は `scripts/gen-instagram-images.mjs` で生成する。

```bash
node scripts/gen-instagram-images.mjs      # assets/marketing/*.jpg を再生成
```

**Instagram Graph API は JPEG しか受け付けない**ため、この4枚だけは
リポジトリのWebP原則の例外として JPEG で置く。
