---
type: project
tags: [project, infra]
status: active
related: ["[[MOC]]", "[[0001-second-brain-vault-structure]]"]
---

# second-brain-system

## 概要
Obsidian Vault（`obsidian-vault/`）をClaude Codeの第二の脳として運用するための基盤。SessionStart hookで直近の記憶を自動読み込みし、セッション内で生じた意思決定・学びをMarkdownノートとして書き戻す。

## 関連ファイル
- `obsidian-vault/` — Vault本体
- `.claude/skills/second-brain/SKILL.md` — 運用ルール
- `.claude/hooks/second-brain-recall.sh` — セッション開始時の記憶読み込みhook
- `.claude/hooks/second-brain-session-log.sh` — やりとり自動記録hook（Stop/SessionEnd）
- `.github/workflows/vault-sync.yml` / `.github/scripts/vault-sync.sh` — スマホObsidian連携の双方向同期
- `obsidian-vault/MOBILE-SETUP.md` — スマホ側セットアップ手順
- `.claude/settings.json` — hook登録

## 現在の状態
2026-06-22: 初期構築完了。フォルダ構成・テンプレート・recallフック・スキルを整備。
2026-06-30: 学び→反映の閉ループ追加（[[recursive-self-improvement]]）。
2026-07-02: スマホObsidian連携を追加（[[0011-mobile-vault-private-repo-sync]]）。専用プライベートリポジトリへの双方向同期＋セッションログ自動記録＋CLAUDE.md全文ミラー。**初回のみ手動設定が必要**（Vaultリポジトリ作成・PAT・Secret登録 → [[MOBILE-SETUP]]）。

## 既知の課題・TODO
- Daily Noteへの書き込みはClaudeの自律判断に依存する手動運用（Stop hookではLLM生成ができないため、完全自動化は不可）
- [ ] 深澤: [[MOBILE-SETUP]] のSTEP 1〜4（Vaultリポジトリ作成・`VAULT_SYNC_TOKEN` 登録・初回同期・スマホ設定）を実施する
- `01-Daily/sessions/` の生ログが肥大化したら vault-gc で古いものを削除する
