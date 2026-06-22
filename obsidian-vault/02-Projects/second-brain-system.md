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
- `.claude/settings.json` — hook登録

## 現在の状態
2026-06-22: 初期構築完了。フォルダ構成・テンプレート・recallフック・スキルを整備。

## 既知の課題・TODO
- Daily Noteへの書き込みはClaudeの自律判断に依存する手動運用（Stop hookではLLM生成ができないため、完全自動化は不可）
