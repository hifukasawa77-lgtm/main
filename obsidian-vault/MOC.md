---
type: moc
tags: [moc]
---

# 🧠 第二の脳 — Map of Content

hide_0001 Portfolio プロジェクトの記憶ハブ。Claude Codeはセッション開始時にこのファイルと直近のDaily Noteを自動で読み込む（`.claude/hooks/second-brain-recall.sh`）。

## 📁 構成
- `00-Inbox/` — 未整理の一時メモ
- `01-Daily/` — セッションごとの作業記録（`YYYY-MM-DD.md`）
- `02-Projects/` — プロジェクト/ゲーム単位のノート
- `03-Decisions/` — 意思決定ログ（ADR形式）
- `04-Knowledge/` — 再利用可能な知見・ハマりどころ・パターン集

## 📌 進行中プロジェクト
- [[second-brain-system]] — このセカンドブレイン基盤自体

## 📚 意思決定ログ
- [[0001-second-brain-vault-structure]]
- [[0002-admin-client-auth-unpublish]] — admin画面を公開から除外（静的ホスティングの認証限界）

## 🧩 知見
- [[claude-md-project-rules]] — `CLAUDE.md` プロジェクトルールの要約
- [[static-hosting-security-limits]] — GitHub Pagesのセキュリティ制約・XSS/escHtmlのハマりどころ

## 🔗 関連
- リポジトリルートの `CLAUDE.md` — プロジェクト全体ルール
- `.claude/skills/second-brain/SKILL.md` — 運用ルール詳細
