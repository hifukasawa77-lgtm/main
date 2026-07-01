---
type: decision
date: 2026-06-30
status: accepted
tags: [decision, harness, self-improve, lint]
related: ["[[harness-maintenance-patterns]]", "[[0007-harness-lint-automation]]"]
---

# 0008 CLAUDE.md正の具体値ドリフトを harness-lint で機械検査

## 背景・問題
[[harness-maintenance-patterns]] の教訓「色以外の具体値（閾値・予算・ブランチ名）をCLAUDE.mdとエージェント定義に重複記述すると必ずドリフトする」は文書化済みだが、`harness-lint.sh` は**色ドリフトしか機械検査していなかった**。実際に予算上限¥5,000は4箇所（CLAUDE.md / accounting-agent.md / budget.md / guard）、採点閾値80・16点は2箇所、作業ブランチ`kai_001`は複数箇所に重複しており、現状は一致しているが無防備だった。

## 決定
`harness-lint.sh` に検査#5「CLAUDE.md正の具体値ドリフト」を追加。各値を**正の単一ソースから導出**し再掲先と突き合わせる:
- 予算上限: 正=`accounting/budget.md` の `MONTHLY_LIMIT`（ガードが実際に読む値）→ CLAUDE.md / accounting-agent.md と照合
- 採点閾値: 正=CLAUDE.md「N点以上 かつ … M点以上」→ evaluator.md と照合
- 作業ブランチ: 正=CLAUDE.md「作業ブランチ: \`xxx\`」→ pmo.md と照合

カンマ表記差（¥5,000 / 5000）は除去して比較。負テストで9999に変えると検出することを確認。`.claude/**` 変更時はCI（harness-lint.yml）が自動実行する。

## 理由
- 「蓄積→想起」止まりだった line-13 の教訓を、機械強制（指示そのもの）へ昇格させ閉ループを閉じる。
- 値の重複を消す（DRY化）と各エージェント定義が運用値を失い使い勝手が落ちるため、**重複は許容しつつ不一致だけを検出**する方針を採った。

## 影響・トレードオフ
- 追加型・振る舞い不変。CIが緑のまま、将来の値ズレだけを落とす。
- 正の単一ソースの所在（予算=budget.md, 閾値/ブランチ=CLAUDE.md）が固定化される。ソースを移す場合は検査#5の抽出元も更新が必要。
