---
type: project
tags: [project, infra, second-brain]
status: active
related: ["[[MOC]]", "[[second-brain-system]]", "[[0003-recursive-self-improvement-loop]]"]
---

# recursive-self-improvement

## 概要
セカンドブレイン（[[second-brain-system]]）の上に「学び→反映」の閉ループを乗せ、蓄積した教訓をハーネス自身の指示（エージェント定義・CLAUDE.md・スキル・フック）へ昇格させることで、セッション/パイプラインが恒久的に賢くなる再帰的自己改善の基盤。

## ループの3段
1. **蓄積** — `/second-brain`：学び・決定を `obsidian-vault/` に記録
2. **想起** — `second-brain-recall.sh`：MOC・**知見クイックインデックス**・直近Dailyを毎セッション投入
3. **反映** — `/self-improve`：再利用価値のある教訓を恒久ルールへ昇格（このプロジェクトで追加）

## 関連ファイル
- `.claude/skills/self-improve/SKILL.md` — 反映（昇格）ループの手順とガードレール
- `.claude/hooks/second-brain-recall.sh` — 知見クイックインデックスを追加（想起の強化）
- `.claude/skills/second-brain/SKILL.md` — 蓄積側の運用ルール
- `CLAUDE.md` — Obsidianセクションに自己改善ループを明記

## 現在の状態
2026-06-30: 初期構築完了。recall hook に知見インデックス追加、`/self-improve` スキル新設、ADR [[0003-recursive-self-improvement-loop]] 記録。

## 既知の課題・TODO
- 反映は半自動（Claude判断＋ユーザー承認）。hookはLLMを呼べないため完全自動化はしない方針（暴走防止）。
- 昇格の繰り返しによるCLAUDE.md肥大化は「狭く効かせる/重複させない/差分追記」のガードレールで抑制。運用しながら効き目を観察する。
