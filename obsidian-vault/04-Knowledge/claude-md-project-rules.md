---
type: knowledge
tags: [knowledge, rules, claude-md]
related: ["[[MOC]]", "[[second-brain-system]]"]
---

# CLAUDE.md プロジェクトルール（要約）

リポジトリルートの `CLAUDE.md` の要約版。本体は常にClaude Codeへ自動ロードされるため全文転記はしない。Obsidian側からも要点を辿れるように知見として記録する。原本: リポジトリルート `CLAUDE.md`。

## プロジェクト概要
- hideの個人ポートフォリオサイト（GitHub Pagesホスティング）
- `index.html`（ポートフォリオ本体）/ `game.html`（ZELDA QUEST）/ `shogi.html`・`shogi_rpg.html`（将棋系）

## デザイン・コーディング方針
- 黒背景 + シアン/パープル系アクセント。Glassmorphism + Canvasパーティクル背景
- **サイバーパンク的演出（ネオングロウ過多・SF都市風）は禁止**
- UIは日英バイリンガル表記、既存ビジュアルを壊さない
- フレームワーク不使用・素のHTML/CSS/JS（Canvas API）優先、ライブラリはCDN経由・ビルドツール不使用

## GameKit
- 新規ゲームは `gamekit/gamekit.js`（自作マイクロエンジン）+ `gamekit/template.html` を土台にする
- `/new-game` スキルでエージェントパイプライン一式を起動可能

## Git運用
- メインブランチ `main` / 作業ブランチ `kai_001`
- `.edge-test-profile/` がコミットに含まれないか必ず確認（.gitignore推奨）
- コミットメッセージは日本語可

## エージェントパイプライン（要点）
PMO（常時横断監視）→ 深澤(PM) → Researcher（任意）→ Planner（要件/設計）→ Graphic-Designer / Music-Generator（並行）→ Code-Generator（実装）→ Legal-Checker（RED/YELLOW/GREEN判定、起因元へ差し戻し）→ Dynamic-Tester（Playwright動作確認・必須ゲート）→ Evaluator（100点満点採点、合格基準80点以上＆仕様適合性16点以上）→ 合格後にkai_001へpush → Marketer（任意）。
詳細フローと各エージェントの役割は `CLAUDE.md` 本文および `.claude/agents/` 参照。

## APIキー禁止事項（最重要）
- 有料APIキー（`ANTHROPIC_API_KEY` 等）を環境変数・設定ファイル・コードに記述することを禁止
- Claude Codeの認証はOAuth経由のみ。`.env`/`config.json`等に誤って書いた場合は即削除し、キーは即時revoke

## コンテキスト節約ルール
- Read前にgrep/findで対象行を特定し、offset+limit指定で読む（全体読み込み禁止）
- エージェント間の受け渡しはファイル全体ではなく変更箇所スニペット（前後10行）のみ
- Evaluatorは `git diff HEAD` で差分確認、ファイル全体の再読み込みは禁止
- 完了したプランタスクは1行サマリーに圧縮する

## 第二の脳（このVault自体のルール）
- `obsidian-vault/` の運用ルールは `.claude/skills/second-brain/SKILL.md` に分離して定義されている（本ノートはCLAUDE.md側のプロジェクトルールの要約であり、Vault運用ルールそのものではない）
