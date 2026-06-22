---
type: decision
date: 2026-06-22
status: accepted
tags: [decision, infra]
related: ["[[second-brain-system]]"]
---

# 0001: Obsidian Vaultをセカンドブレインとして導入する

## 背景・問題
Claude Codeのセッションは会話が終わると記憶が失われる。`CLAUDE.md`とgit履歴以外に、プロジェクトの意思決定・学び・進行中プロジェクトの状態を横断的に蓄積し次回セッションでも参照できる仕組みがなかった。

## 決定
リポジトリ直下に `obsidian-vault/` を作成し、Obsidian互換のMarkdown Vault（YAML frontmatter + `[[wikilink]]`）として運用する。SessionStart hook（`.claude/hooks/second-brain-recall.sh`）が `MOC.md` と直近のDaily Noteを自動読み込みし、書き込みはClaude自身が `.claude/skills/second-brain/SKILL.md` のルールに従って実施する。

## 理由
- Obsidianは深澤が使い慣れたPKMツールであり、実体はMarkdownのため将来どのツールにも移行しやすい
- gitで履歴管理できるため、PMOのGoogle Drive文書（ステークホルダー向け）とは別に「個人の知的資産」として版管理できる
- hookによる自動読み込みは追加のAPIキーや有料外部サービスを必要としない（`CLAUDE.md`のAPIキー禁止ルールに準拠）

## 影響・トレードオフ
- Vaultへの書き込みはClaudeの自律判断に依存するため完全自動化ではない（Stop hookではLLM生成ができない）
- 公開リポジトリ内に個人の意思決定メモが入るため、機微情報を書かない運用ルールが必要
