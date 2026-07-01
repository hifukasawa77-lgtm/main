---
type: decision
date: 2026-07-01
status: accepted
tags: [decision, harness, skills]
related: ["[[harness-maintenance-patterns]]", "[[0006-activate-orphaned-skills]]", "[[0007-harness-lint-automation]]"]
---

# 0010 スキル一括拡充（8本→23本、スクリプト同梱型）

## 背景・問題
既存スキル8本は「制作フェーズ」（coding/design/game-dev等）と「運用メタ」（second-brain/self-improve/workflow）に厚い一方、調査で以下のギャップが判明:
- 公開後の品質が手薄: OGP未対応がHTML76本中53本、Canvasゲームのa11y指針なし、性能は手法のみで実測なし、大容量アセット（blogs.json 2.7MB等）が放置
- テスト自動化が埋没: dynamic-test-auto.cjs（Playwright検証）がエージェント定義内に埋もれスキル化されていない
- 反復運用が手作業: リリース前チェック（workflowに文章のみ）、経理の月次締め、週次振り返り、Vault整理

## 決定
深澤の承認（対象=全カテゴリ・スクリプト同梱型優先・一括実装）のもと、15スキルを新設:
- **開発・品質（7）**: dynamic-test / seo-audit / a11y-audit / perf-audit / asset-optimize / i18n-check / release-check
- **運用・リリース（4）**: deploy-verify / game-release / monthly-close / kpi-report
- **セカンドブレイン（2）**: weekly-review / vault-gc
- **学習・ユーティリティ（2）**: english-lesson / qiita-draft

設計原則:
- 機械検査できるものはスクリプト同梱（harness-lint 方式: スキルディレクトリ内・終了コード 0/1・bash罠対策済み）
- 監査系は「検査スクリプト＋是正ガイド」のペア構成。既存資産（dynamic-test-auto.cjs・gamekit・budget.md の MONTHLY_LIMIT）を再利用し重複実装しない
- CLAUDE.md には追記しない（肥大化防止。スキルは自動発見・frontmatterはharness-lint検査#1/#2がCIでガード）
- workflow スキルのチェックリストからは release-check を参照（重複記述の回避）

## 理由
- 「文書化された手順」を「実行可能なコマンド」へ昇格させる路線（0007のlint機械化と同型）を全運用領域へ展開するもの
- 役割分担を明確化: coding=最適化手法 / perf-audit=実測、self-improve=個別昇格 / weekly-review=週次俯瞰、workflow=目視項目 / release-check=機械項目

## 影響・トレードオフ
- スキル数が23本になり description の品質が invocation 精度を左右する。各スキルにトリガー語（「〜して」）を明記した
- 監査系スクリプトの検出パターンは今後のサイト構成変更で保守が必要（/self-improve のlint追記と同じ運用で対応）
- deploy-verify は本番URL、monthly-close は ledger.md の書式に依存（正の単一ソース。書式変更時は追従が必要）
