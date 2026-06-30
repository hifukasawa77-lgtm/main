---
type: decision
date: 2026-06-30
status: accepted
tags: [decision, skills, design]
related: ["[[recursive-self-improvement]]", "[[0004-code-generator-color-scheme-align]]"]
---

# 0006: 孤立していた5スキルを正式SKILL.mdに変換して有効化

## 背景・問題
スキル定義のヘルスチェックで、`.claude/skills/` 下の5ディレクトリ（coding / design / explain-code / game-dev / workflow）が **`SKILL.md` ではなく `Skills.md`** というファイル名で、かつ YAML frontmatter を持たない**ガイドライン集（参照ドキュメント）**になっており、スキルとしてロードされず死蔵されていた。中身は実用的なプロジェクト固有知見（Glassmorphism・衝突判定・有機的キャラ描画・コードレビューチェックリスト等）。

さらに `design/Skills.md` は「ネオングロウエフェクト」「マゼンタ #ff00ff」を基本UIとして教えており、CLAUDE.md の「サイバーパンク的演出（ネオングロウ過多・原色ネオン）禁止」と矛盾していた（ヘッダ自身は禁止と明記する内部矛盾）。

## 決定
1. 5ファイルを `git mv Skills.md → SKILL.md` でリネームし、各々に YAML frontmatter（`name`＝ディレクトリ名、`description`＝内容を正確に要約）を付与して**正式な呼び出し可能スキル**として有効化した。
2. `design` スキルは有効化と同時に CLAUDE.md 準拠へ整合（[[0004-code-generator-color-scheme-align]] の原則を踏襲）: マゼンタをパレットから除去、「ネオングロウエフェクト」→「アクセント発光エフェクト」へ改題、多重強発光を1〜2層の控えめな発光に修正。他4スキルは矛盾がないため本文は変更せず frontmatter のみ追加。

## 理由
- ロードされないスキルは知見の死蔵。リネーム＋frontmatterで `/coding` `/design` 等として呼び出し可能・関連時に自動参照される生きた資産になる。
- CLAUDE.md違反のガイドを有効化するわけにはいかないため、design は活性化前提として整合が必須だった。

## 影響・トレードオフ
- 利用可能スキルが5つ増える（coding/design/explain-code/game-dev/workflow）。
- `explain-code` はディレクトリ名と内容（Canvasキャラクター描画）が不一致だが、ディレクトリ改名は参照破壊リスクがあるため見送り、description で内容を明確化して invocation 精度を担保した。将来の整理候補として残す。
