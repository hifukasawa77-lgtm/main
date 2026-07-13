---
type: decision
date: 2026-07-13
status: accepted
tags: [decision, harness, release-check, bash]
related: ["[[harness-maintenance-patterns]]", "[[0007-harness-lint-automation]]"]
---

# 0013 release-check検査#2からscripts/を除外＋grep正規表現バグ2件を修正

## 背景・問題
- 検査#2（console.log追加検出）が `scripts/` 配下のCLIツール（fetch-garmin.js等）の**意図的な実行ログ**を誤検出していた（2026-07-09発見、深澤承認 2026-07-13）。
- 是正作業の正・負テストで**既存の検出バグ2件**を発見:
  1. `^\+[^+].*console\.log` は行頭直書きの追加行（`+console.log…`）を取りこぼす（`[^+]` が先頭文字を消費するため）
  2. 修正時に書いた `grep -v '^\+\+\+'`（BRE）は GNU拡張で `\+` が「1回以上」量指定子となり、`+` で始まる**全行**を除外して検査が空振りする

## 決定
- 検査#2の対象から `':(exclude)scripts/**'` でscripts/を除外（代替案「許可コメント方式」は既存全行への付与作業が重く不採用）。
- パイプラインを「`grep -E '^\+'` → `grep -Ev '^\+\+\+'`（ヘッダ除外・必ずERE） → パターン検索」の分離型に修正。

## 理由
- CLIスクリプトの実行ログは仕様であり、公開ページ（*.html / assets/js）の検査密度は変わらない。
- 検証: col0直書き=検出✓ / インデント行=検出✓ / scripts/内=除外✓ / クリーン=✅ の4パターンで確認済み。

## 影響・トレードオフ
- scripts/ に「消し忘れデバッグlog」が入っても検出されなくなる（CLIログと区別不能なため許容）。
- bash罠2件は [[harness-maintenance-patterns]] へ追記済み。
