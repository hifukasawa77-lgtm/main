---
type: moc
tags: [moc]
---

# 🧠 第二の脳 — Map of Content

hide_0001 Portfolio プロジェクトの記憶ハブ。Claude Codeはセッション開始時にこのファイル・知見クイックインデックス・直近のDaily Noteを自動で読み込む（`.claude/hooks/second-brain-recall.sh`）。

## ♻️ 再帰的自己改善ループ
蓄積（`/second-brain`）→ 想起（recall hook）→ **反映（`/self-improve`）** の閉ループで、学びをハーネス自身の指示に昇格させる。詳細: [[recursive-self-improvement]] / [[0003-recursive-self-improvement-loop]]

## 📁 構成
- `00-Inbox/` — 未整理の一時メモ
- `01-Daily/` — セッションごとの作業記録（`YYYY-MM-DD.md`）
- `02-Projects/` — プロジェクト/ゲーム単位のノート
- `03-Decisions/` — 意思決定ログ（ADR形式）
- `04-Knowledge/` — 再利用可能な知見・ハマりどころ・パターン集

## 📌 進行中プロジェクト
- [[second-brain-system]] — このセカンドブレイン基盤自体
- [[recursive-self-improvement]] — 学び→反映の閉ループ（自己改善基盤）

## 📚 意思決定ログ
- [[0001-second-brain-vault-structure]]
- [[0002-admin-client-auth-unpublish]] — admin画面を公開から除外（静的ホスティングの認証限界）
- [[0003-recursive-self-improvement-loop]] — 学び→反映の再帰的自己改善ループを追加
- [[0004-code-generator-color-scheme-align]] — code-generatorの色指定をCLAUDE.mdに整合（/self-improve初回）
- [[0005-billing-guard-matcher-sync]] — 課金ガードのsettings.json matcherをguard.shと同期
- [[0006-activate-orphaned-skills]] — 孤立5スキルをSKILL.md化して有効化（design整合含む）
- [[0007-harness-lint-automation]] — 手作業監査をharness-lint.shに機械化し/self-improve手順0に

## 🧩 知見
- [[claude-md-project-rules]] — `CLAUDE.md` プロジェクトルールの要約
- [[static-hosting-security-limits]] — GitHub Pagesのセキュリティ制約・XSS/escHtmlのハマりどころ

## 🔗 関連
- リポジトリルートの `CLAUDE.md` — プロジェクト全体ルール
- `.claude/skills/second-brain/SKILL.md` — 運用ルール詳細
