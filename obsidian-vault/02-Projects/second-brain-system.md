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
- 2026-06-22: 初期構築完了。フォルダ構成・テンプレート・recallフック・スキルを整備 → [[0001-second-brain-vault-structure]]
- 2026-07-09: recall hook の mtime 依存バグ（フレッシュクローンで全ファイル同一mtime → `ls -t` が不定）を修正。日付はファイル名で比較する方式へ → [[0011-mtime-free-file-selection]]
- 2026-07-16: Daily圧縮ルール（recallは直近Dailyを全文投入するため肥大化がコンテキストを圧迫）と昇格マーカー規約を second-brain スキルへ明文化 → [[0009-daily-hygiene-rule]] / [[0015-unpromoted-learning-lint]]
- 2026-07-25: 記録の空白（7営業日）が別セッション作業で発生することが判明し、`/self-improve` を週次Routine化して検知頻度を担保 → [[0020-perf-cost-placement-and-canvas-layout-promotion]] / [[0021-routine-schedule-single-source]]

## 既知の課題・TODO
- Daily Noteへの書き込みはClaudeの自律判断に依存する手動運用（Stop hookではLLM生成ができないため、完全自動化は不可）。
  - **緩和済み（2026-07-25）**: 書き込み自体は自動化できないが、**書かれなかったことの検知**は機械化した。harness-lint 検査#9 が「作業コミットあり・Dailyなし」の日を直近14日で警告し、週次 `/self-improve` Routine（日曜21:00 JST）が必ず検知圏内でそれを拾う。残る穴は「14日以上 `/self-improve` が回らなかった場合」のみ。
- **別ブランチ・別セッション（codex等）の作業はVaultへ書き戻されない**。recall hook は main の Vault しか見ないため、並行セッションの学びは検査#9経由の遡及Daily化でしか回収できない。
