---
type: decision
date: 2026-07-17
status: accepted
tags: [decision, skills, cleanup]
related: ["[[0006-activate-orphaned-skills]]", "[[harness-maintenance-patterns]]"]
---

# 0017: レガシー `.agents/skills/` を削除し video-editing を正式スキルへ救出

## 背景・問題
[[0006-activate-orphaned-skills]] は `.claude/skills/` 内の `Skills.md` を是正したが、**別系統のレガシーツリー `.agents/skills/`**（coding / design / explain-code / game-dev / video-editing / workflow の旧 `Skills.md` 6本）が残存していた。ハーネス・CLAUDE.md・Vault・gamekit のどこからも参照されない完全孤立で、しかも `design/Skills.md` には CLAUDE.md 禁止の**マゼンタ #ff00ff／ネオングロウ指示が現役の書きぶりで残存**（lint検査#4は `.claude/` 配下しか見ないため検出圏外）。リポジトリ横断grepをするエージェントが誤って旧指示を拾うリスクがあった。

## 決定
1. `video-editing`（`.claude/skills/` に対応物が無い唯一のスキル。Canvas + MediaRecorder 録画ガイドで内容はCLAUDE.md準拠・有用）を frontmatter 付き `SKILL.md` として `.claude/skills/video-editing/` へ救出・有効化。
2. `.agents/` ツリー全体を `git rm` で削除。他5本は `.claude/skills/` の現行版（frontmatter＋昇格分を含む上位互換）の旧版コピーであることを行数・内容比較で確認済み。内容はgit履歴に残るため可逆。

## 理由
- ADR 0006 の確定方針「ロードされないスキルは知見の死蔵→有効化、CLAUDE.md違反ガイドは残さない」をレガシーツリーへ適用したもの（新規の方針判断ではない）。
- 禁止色ドリフトの温床を、lint検査#4のスコープ拡張（巨大リポジトリの横断grepで遅い・ノイズが多い）ではなく**発生源の除去**で解消する方が確実。

## 影響・トレードオフ
- 利用可能スキルが1つ増える（`/video-editing`）。lint検査#1・#2の対象に自動的に入る。
- 万一 `.agents/` を参照する未知の外部ツールがあれば影響するが、参照ゼロを確認済み。
