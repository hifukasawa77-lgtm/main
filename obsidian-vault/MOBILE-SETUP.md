---
type: guide
tags: [guide, mobile, second-brain]
---

# 📱 スマホObsidian連携セットアップ（MOBILE-SETUP）

スマホのObsidianアプリでこの第二の脳（`obsidian-vault/`）を読み書きするための手順。
一度セットアップすれば、Claude Codeのセッションログ・意思決定・知見・CLAUDE.md全文がスマホに自動で届き、スマホで書いたメモは30分以内に `main` へ取り込まれて次のClaude Codeセッションに想起される。

## 全体像

```
main リポジトリ (hifukasawa77-lgtm/main)          専用Vaultリポジトリ（プライベート推奨）
┌──────────────────────────┐   GitHub Actions    ┌──────────────────┐   Obsidian Git   ┌──────────┐
│ obsidian-vault/          │ ⇄ vault-sync.yml  ⇄ │ Vaultの内容のみ   │ ⇄ (pull/push) ⇄ │ スマホの  │
│  ├ 01-Daily/sessions/ ←──┼── セッションログ自動記録│ （数百KBの軽量repo）│                  │ Obsidian │
│  └ 04-Knowledge/         │   (Stop/SessionEnd   │                  │                  └──────────┘
│     claude-md-mirror.md ←┼──  hook)             └──────────────────┘
│     （CLAUDE.md全文ミラー） │
└──────────────────────────┘
   公開時: push契機＋30分毎cron / 取込: スマホ編集を3-way mergeでmainへ
```

**なぜ専用リポジトリを挟むのか**: 本リポジトリはゲーム・画像込みで約800MiBあり、スマホのObsidian Gitプラグイン（isomorphic-git実装）ではクローンできない（クローン時のブランチ指定も不可）。Vaultの内容だけを持つ軽量リポジトリを同期先にすることで、スマホは数百KBのクローンで済む。プライベートリポジトリにすればスマホ経由のメモを公開せずに済む（※mainリポジトリ側のVaultは従来どおり公開なので機微情報は書かないこと）。

## STEP 1: 専用Vaultリポジトリを作成（PC/ブラウザ・1回だけ）

1. GitHubで新規リポジトリ `obsidian-vault` を作成（アカウント: `hifukasawa77-lgtm`）
   - **Private** を選択
   - **README・.gitignore・ライセンスは追加しない（完全に空で作る）**
2. 別名にした場合は、mainリポジトリの **Settings → Secrets and variables → Actions → Variables** に `VAULT_REPO`（例: `hifukasawa77-lgtm/my-vault`）を登録する（既定値は `hifukasawa77-lgtm/obsidian-vault`）

## STEP 2: 同期用PATを作成してSecretに登録（1回だけ）

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token
   - Repository access: **Only select repositories → 手順1のVaultリポジトリのみ**
   - Permissions: **Contents → Read and write**
   - 有効期限は運用に合わせて（切れたら同期が止まるだけ。作り直して再登録）
2. mainリポジトリの **Settings → Secrets and variables → Actions → Secrets** に `VAULT_SYNC_TOKEN` として登録

## STEP 3: 初回同期を実行（1回だけ）

mainリポジトリの **Actions → 「Vault同期（スマホObsidian連携）」 → Run workflow** を手動実行する。
成功するとVaultリポジトリの `main` ブランチにVaultの内容一式（＋ `04-Knowledge/claude-md-mirror.md`）が公開される。
以後は `obsidian-vault/` か `CLAUDE.md` に変更が入るたび＋30分毎に自動同期される。

## STEP 4: スマホのObsidianをセットアップ

1. Obsidianアプリをインストールし、**空のVaultを新規作成**して開く
2. 設定 → **コミュニティプラグイン** → 制限モードをオフ → 「**Git**」（作者: Vinzent03）を検索してインストール・有効化
3. スマホ用PATを用意する（STEP 2と同じ手順。同じPATの使い回しでも可だが、紛失リスクを考えると別トークン推奨）
4. プラグイン設定（Git → Authentication）に **Username**（`hifukasawa77-lgtm`）と **Password/PAT** を入力
5. コマンドパレット（引き下げ→「Git」で検索）→ **「Git: Clone an existing remote repo」**
   - URL: `https://github.com/hifukasawa77-lgtm/obsidian-vault.git`
   - クローン先ディレクトリ: Vaultルート（`.`）
   - 「.obsidianディレクトリを含むか」→ **No**
   - Depth: **空欄（フルクローン）** ※軽量リポジトリなので問題ない。深さ指定はその後の同期エラーの原因になる
6. アプリを再起動するとノート一式が表示される

### 日常の使い方（スマホ側）
- **読む**: 開くだけ。最新化はコマンド「Git: Pull」（プラグイン設定で「Auto pull on startup」をオンにすると自動）
- **書く**: どこに書いてもよいが、迷ったら `00-Inbox/` に新規ノートを作る → コマンド「**Git: Commit-and-sync**」で送信
- スマホでpushした編集は、**最大30分後**（cron）にmainリポジトリの `obsidian-vault/` へ自動で取り込まれ、次のClaude Codeセッションの想起対象になる

## 何が自動で届くか

| 内容 | 経路 |
|---|---|
| Claude Codeのやりとり（会話ログ） | Stop/SessionEnd hookが `01-Daily/sessions/YYYY-MM-DD-<id>.md` に自動記録 → 同期 |
| CLAUDE.md の全文 | 同期のたびに `04-Knowledge/claude-md-mirror.md` へ自動ミラー（編集不可・上書きされる） |
| Daily Note・意思決定（ADR）・知見 | Claudeが second-brain スキルに従って記録 → 同期 |

## 注意・トラブルシューティング

- **モバイルのGitプラグインは公式に「不安定」とされている**。クローンやpullでクラッシュする場合はアプリ再起動→再実行。改善しない場合はVaultを作り直して再クローンが早い
- **コンフリクトで同期Actionが失敗した場合**（mainとスマホで同じファイルを同時編集）: Actionsの「Vault同期」を `force_publish=true` で手動実行すると、mainの内容へ強制統一される（**スマホ側の未取込編集は破棄**されるので、必要なら先にスマホのノートを退避）
- **機微情報を書かない**: mainリポジトリ側のVaultは公開リポジトリにある。APIキー・パスワード・個人情報は書かない（[[claude-md-project-rules]]）
- セッションログが不要な場合: 環境変数 `SECOND_BRAIN_SESSION_LOG=0` で記録停止（詳細: `.claude/hooks/second-brain-session-log.sh` のヘッダ）
- 同期の仕組みの詳細: `.github/scripts/vault-sync.sh` / 導入の経緯: [[0011-mobile-vault-private-repo-sync]]
