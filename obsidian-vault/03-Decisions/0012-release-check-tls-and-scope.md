---
type: decision
date: 2026-07-09
status: accepted
tags: [decision, self-improve, release-check, security]
related: ["[[2026-07-09]]", "[[harness-maintenance-patterns]]", "[[0007-harness-lint-automation]]"]
---

# release-check の検査スコープ是正とTLS検証無効化の機械検査追加

## 背景・問題
1. 検査#2（console.log）が `scripts/` のCLIツールの意図的な実行ログを誤検出していた（07-09のGarmin Sync対応時に顕在化。Dailyで /self-improve 候補としてマーク済み）。
2. `scripts/fetch-garmin.js` に `NODE_TLS_REJECT_UNAUTHORIZED='0'`（TLS検証無効化）が長期間残存していた。認証情報を扱うスクリプトで重大だが、機械検査がなく人手レビュー頼みだった。
3. 検証中に検査#2の潜在バグを発見: 1段grep `^\+[^+].*console\.log` は `[^+]` が行頭の1文字目を消費するため、**インデントなしで行頭から始まる console.log を見逃していた**。

## 決定
- 検査#2: `scripts/` を pathspec `':(exclude)scripts'` で除外（CLIの実行ログは対象外）。1段grepを2段grep（`grep '^\+[^+]'` → `grep 'console\.log'`）に修正。
- 検査#7を新設: 追加行の `NODE_TLS_REJECT_UNAUTHORIZED` / `rejectUnauthorized: false` / `verify=False` / `--insecure` を検出。対象はコードファイル（js/cjs/mjs/html/sh/yml）のみ・自スキル除外（ドキュメントのパターン説明文の自己誤検出防止）。
- `security.md`（エージェント）のHIGHに「TLS検証無効化」「認証情報を渡す非公式パッケージのバージョン固定」を追記。

## 理由
- 誤検出は検査の信頼を毀損し「✗を無視する習慣」を生む。許可コメント方式より scripts/ 除外の方が単純で、本リポジトリの scripts/ は全てCLIツールのため過剰除外にならない。
- TLS無効化は今回の実例（fetch-garmin.js）が「一度混入すると長期残存する」ことを示した。追加行ベースの機械検査で再混入を水際で止める。

## 影響・トレードオフ
- scripts/ 内のデバッグconsole.logは検出されなくなる（CLIでは実害小と判断）。
- 検査#7はドキュメント（.md）を対象外にするため、指示ファイルへの誤った推奨記述は検出できない（そちらは harness-lint の守備範囲）。
