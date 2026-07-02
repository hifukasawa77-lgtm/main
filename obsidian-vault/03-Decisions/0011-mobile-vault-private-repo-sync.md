---
type: decision
date: 2026-07-02
status: accepted
tags: [decision, second-brain, mobile]
related: ["[[second-brain-system]]", "[[0001-second-brain-vault-structure]]"]
---

# 0011: スマホObsidian連携は専用プライベートリポジトリ経由の双方向同期にする

## 背景・問題
スマホのObsidianを第二の脳の閲覧・入力端末にしたい（やりとりのログやCLAUDE.mdもスマホで読みたい）。しかし:
- 本リポジトリはpackサイズ約800MiBで、スマホのObsidian Gitプラグイン（isomorphic-git）ではクローン困難。さらに同プラグインは**クローン時のブランチ指定が未実装**（ソースコードで確認）のため、「Vaultだけの軽量ブランチ」を作ってもスマホから直接クローンできない
- Obsidian Sync（公式）は有料 → 課金ゼロ原則（CLAUDE.md）に抵触。iCloud/Working Copy等はOS依存・一部有料

## 決定
1. **専用Vaultリポジトリ**（既定: `hifukasawa77-lgtm/obsidian-vault`、プライベート推奨）を同期先とし、スマホはそれをObsidian Gitプラグインでクローンする
2. GitHub Actions **`vault-sync.yml`**（実体: `.github/scripts/vault-sync.sh`）が双方向同期する
   - 公開: main の `obsidian-vault/` → Vaultリポジトリ（push契機＋30分毎cron）。`sync-base` タグを公開時点に置き、次回取込の差分基準にする
   - 取込: Vaultリポジトリの `sync-base..main` 差分（=スマホ編集）を `git apply --directory=obsidian-vault --3way` で main へマージ
   - コンフリクト時はActionが失敗 → `force_publish=true` の手動実行でmainへ強制統一（エスケープハッチ）
3. **やりとりの自動記録**: Stop/SessionEnd hook `.claude/hooks/second-brain-session-log.sh` が会話ログ（テキストのみ・ツール呼び出し除外・1500字/メッセージ）を `01-Daily/sessions/` へ冪等に書き出す。リモートセッション（claude/*ブランチ）ではSessionEndに自動コミット＆プッシュ（コンテナ破棄でログが消えるため）
4. **CLAUDE.md全文ミラー**: 同期時に `04-Knowledge/claude-md-mirror.md` を自動再生成（単一ソースはCLAUDE.md。ミラー編集は上書きされるためドリフトしない）

## 理由
- 巨大リポジトリ・プラグイン制約・課金ゼロの3制約を同時に満たすのは「軽量リポジトリを挟むgit同期」のみ
- Actionsの実行は blobless + sparse-checkout で `obsidian-vault/` とルートだけ取得するため、30分毎cronでも数秒〜十数秒で完了する
- 差分基準を `sync-base` タグに一本化することで、双方向同期のループ・削除の誤伝播を防ぐ（GITHUB_TOKENのpushはワークフローを再トリガーしない性質も併用）

## 影響・トレードオフ
- 初期設定に手作業が必要: Vaultリポジトリ作成・PAT発行・Secret `VAULT_SYNC_TOKEN` 登録（手順: [[MOBILE-SETUP]]）。未設定の間はActionが静かにスキップする
- mainリポジトリ側のVaultは従来どおり**公開**。プライベート化されるのは同期先のみ → 機微情報禁止ルールは継続
- セッションログは生ログのため蓄積する。recall hookの対象外（`01-Daily/sessions/` は直近Daily検出のglobに含まれない）だが、肥大化したら vault-gc で古いログを削除してよい
- モバイルのGitプラグインは公式に不安定とされる。クラッシュ時は再クローンで復旧
