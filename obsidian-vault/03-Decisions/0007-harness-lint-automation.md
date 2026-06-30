---
type: decision
date: 2026-06-30
status: accepted
tags: [decision, self-improve, automation]
related: ["[[recursive-self-improvement]]", "[[0004-code-generator-color-scheme-align]]", "[[0005-billing-guard-matcher-sync]]", "[[0006-activate-orphaned-skills]]"]
---

# 0007: 繰り返した手作業監査を harness-lint.sh に機械化し /self-improve の手順0にする

## 背景・問題
同日のうちにハーネス整合性監査を手作業で5回繰り返した（色ドリフト3層・SKILL.md欠落・課金ガードのmatcher包含・主要参照の実在）。同じ検査を毎回手で回すのは非効率で、見落としも生む。これらは機械的に判定できる種類の劣化である。

## 決定
`.claude/skills/self-improve/harness-lint.sh` を新設し、次を一括検査する:
1. スキルの `SKILL.md` 存在（誤名・欠落でのサイレント死蔵検出）
2. agents/skills の frontmatter 妥当性
3. 課金ガードの2段ゲート同期（settings.json matcher == BILLING_RISK_TOOLS）
4. 色ドリフト（CLAUDE.md禁止のマゼンタ/原色ネオンが指示として残存していないか）
5. 主要参照パスの実在

`/self-improve` の SKILL.md に「手順0: ヘルスチェック」として組み込み、振り返りの前に必ず実行する運用にした。

## 理由
- 「手作業の繰り返し」は `/self-improve` が昇格すべき典型パターン。検査スクリプト化＝再利用可能な恒久ツールへの昇格。
- 機械検査（lint）と人間判断（reflect）を分離することで、前者を確実に・後者に集中できる。

## 影響・トレードオフ
- 色ドリフト検査はヒューリスティック（禁止文の除外・自スクリプト除外）。新パターンが出たら誤検知/見逃しが起き得るため、検査はスクリプトに追記して育てる前提。
- クリーン時 exit 0 / 問題検出時 exit 1 を正常系・異常系の両テストで確認済み。

## 追記（2026-06-30 CI強制化）
- `.github/workflows/harness-lint.yml` を新設し、`.claude/**` 変更を含む push/PR で harness-lint.sh を自動実行するようにした（既存のGitHub Actions運用に追随）。これで「構造→監査→自動化→**強制**」の最終段が揃い、ドリフト/死蔵/同期ズレが手作業に頼らずCIでガードされる。
- スクリプトは `CLAUDE_PROJECT_DIR` 未設定時に `git rev-parse --show-toplevel` へフォールバックするため、CIのクリーンチェックアウトでもサブディレクトリからでも動作する（検証済み）。
