---
name: second-brain
description: Obsidian Vault（obsidian-vault/）をClaude Codeの第二の脳として運用するスキル。SessionStart hookでMOCと直近のDaily Noteを自動読み込みし、重要な意思決定・学び・進行中プロジェクトの状態をMarkdownノートとして書き戻す。「メモして」「覚えておいて」「記録して」等の指示、セッションの区切り、重要な意思決定・学びが生じた際に使用する。
---

# /second-brain — Obsidianセカンドブレイン運用

`obsidian-vault/` をClaude Codeの永続メモリとして使う。会話が終わってもこのVaultに書いたことは次回セッションのSessionStart hookで自動的に読み込まれる。

## 自動読み込み（Recall）
- `.claude/hooks/second-brain-recall.sh` がセッション開始時に `obsidian-vault/MOC.md` と直近のDaily Noteをstdoutへ出力し、コンテキストに自動追加される
- 設定は `.claude/settings.json` の `hooks.SessionStart`

## Vault構成
```
obsidian-vault/
  MOC.md          # 目次（Map of Content）。プロジェクト一覧・各フォルダへのリンクのハブ
  00-Inbox/       # 未整理の一時メモ・思いつき
  01-Daily/       # YYYY-MM-DD.md 形式のセッション作業記録
  02-Projects/    # プロジェクト/ゲーム単位のノート（1ファイル1プロジェクト）
  03-Decisions/   # 意思決定ログ（ADR形式、NNNN-スラッグ.md で連番）
  04-Knowledge/   # 再利用可能な知見・ハマりどころ・パターン集
  Templates/      # 各ノート種別のテンプレート
```

## いつ書くか
以下に該当したら都度 `obsidian-vault/` へ追記する（ユーザーへの確認は不要、淡々と記録する）。

1. ユーザーが「メモして」「記録して」「覚えておいて」と明示的に指示したとき → `00-Inbox/` または該当カテゴリへ即時追記
2. 後で取り消しにくい/再現性のある意思決定をしたとき（設計方針・技術選定・運用ルール変更） → `03-Decisions/NNNN-スラッグ.md`（テンプレート: `Templates/decision-note.md`、連番は既存ファイルの最大値+1）
3. デバッグで判明したハマりどころ・再利用可能な知見 → `04-Knowledge/`
4. セッションの区切り（大きめのタスク完了時・切りの良いところで終了する時） → `01-Daily/YYYY-MM-DD.md` に追記（同日複数セッションなら追記、新規なら `Templates/daily-note.md` から作成）
5. 新しいプロジェクト/ゲームの制作を開始 or 状態が変化したとき → `02-Projects/<プロジェクト名>.md` を作成・更新し `MOC.md` にリンクを追加

## 書式ルール
- 全ノートにYAML frontmatter（`type` / `tags` / 必要に応じて `date` `status` `related`）を付与する
- ノート間の関連は `[[ノート名]]` のwikilinkで結ぶ（Obsidianのグラフビュー・バックリンクが機能するように）
- 新規ノートは必ず `MOC.md` または親ノートからリンクする（孤立ノートを作らない）
- ファイル全体を読み直す必要はない。追記は対象ノートの末尾セクションにEditで差分追加する（`CLAUDE.md`のコンテキスト節約ルールに従う）

## 書かないこと（禁止事項）
- APIキー・パスワード・個人の機微情報は書かない（このVaultはgit管理されGitHub Pagesと同じリポジトリにある）
- PMOエージェントが管理する `pmo/`（Google Drive）の進捗・リスク・KPI文書とは役割分担する。Vaultは「個人の知的資産・意思決定の理由・学び」、PMOは「ステークホルダー向け進捗管理」を担当する
