---
type: decision
date: 2026-06-30
status: accepted
tags: [decision, security, accounting, hooks]
related: ["[[recursive-self-improvement]]"]
---

# 0005: 課金ガードの settings.json matcher を BILLING_RISK_TOOLS と同期させる

## 背景・問題
ハーネス参照健全性監査で、課金ガードの2段ゲートにズレを発見した。
- `.claude/settings.json` の PreToolUse `matcher` = hook を起動するかの**外側ゲート**
- `.claude/hooks/accounting-guard.sh` の `BILLING_RISK_TOOLS` = ask/deny の内側判定

matcher は `license_and_download_stock|…`、guard.sh は `asset_license_and_download_stock|license_and_download|…` で不一致。実在のAdobeツール `asset_license_and_download_stock` は両方にマッチするため現状の実害はないが、guard.sh が意図する `license_and_download`（`_stock` 無し）を持つツールが来た場合、matcher が `_stock` を要求するため **hook 自体が発火せずガードが素通りする潜在ギャップ**があった。accounting-agent.md が明記する同期ルールにも違反していた。

## 決定
1. settings.json の matcher を `BILLING_RISK_TOOLS` と**同一文字列**（`asset_license_and_download_stock|license_and_download|purchase|checkout|subscribe|billing|payment`）に揃える。
2. 同期ルールの**対象を3箇所に明文化**（accounting-agent.md の監視表 / guard.sh の BILLING_RISK_TOOLS / settings.json の matcher）。matcher が外側ゲートでありBILLING_RISK_TOOLSの上位集合でなければならない旨を accounting-agent.md と guard.sh のコメントに追記。

## 理由
- カバレッジを広げる安全側の変更（ask ゲートが増えるだけで減らない）。
- 根本原因は「同期ルールが settings.json を対象に含めていなかった」こと。ルール本文を直さない限りドリフトは再発する。

## 影響・トレードオフ
- 課金リスク操作の検知漏れの潜在ギャップが閉じる。誤検知が増える可能性はあるが、ask（停止確認）であり実行はブロックしないため実害は小さい。
- 今後 課金リスクツールを追加する際は3箇所同時更新が必須になる（コメントで明示済み）。
