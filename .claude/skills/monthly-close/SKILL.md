---
name: monthly-close
description: accounting（経理）の月次締め。ledger.md の前月分アーカイブ・当月セクション作成・累計とMONTHLY_LIMITの照合をスクリプトで検査し、締め手順を提供する。「月次締めして」「経理を締めて」「今月の課金を確認して」という依頼、および月初のセッションで使用する。
---

# /monthly-close — 経理の月次締め

`accounting/ledger.md` は当月分のみを保持し、月初に前月分を `accounting/archive/YYYY-MM.md` へ退避する運用（ledger.md 記載のルール）。このスキルはその締め作業を定型化する。

## 使い方

```bash
bash .claude/skills/monthly-close/monthly-close.sh
```

終了コード: 当月セクションが最新=0 / 締め作業が必要=1。検査内容:
- `ledger.md` の「## 当月（YYYY-MM）」が実際の当月と一致するか
- `CURRENT_TOTAL` と `budget.md` の `MONTHLY_LIMIT` の照合（使用率）

## 締め手順（スクリプトが「要締め」を出したら）

1. **前月分アーカイブ**: `ledger.md` の当月セクション（テーブル）を `accounting/archive/YYYY-MM.md` へコピーして保存（archiveディレクトリが無ければ作成）
2. **当月セクション初期化**: ヘッダを新しい `YYYY-MM` に更新し、テーブルを空行（課金イベントなし）に戻す
3. **累計リセット**: `CURRENT_TOTAL: 0` に更新（機械可読ブロック。accounting-guard.sh が読む値）
4. **状態行更新**: 「当月累計: ¥0 / ¥5,000（0%）🟢」
5. **月次レポート**: 前月の課金実績（通常¥0）を Daily Note に1行記録。課金があった月は accounting-agent の書式でPM深澤へ報告

## 原則
- 大前提は**課金ゼロの維持**（CLAUDE.md）。締めはその確認作業であり、¥0なら1〜4のみで完了
- 秘密情報（Webhook URL・カード情報等）は台帳に書かない
- `MONTHLY_LIMIT` の変更は深澤の承認事項（harness-lint 検査#5が再掲先との整合を監視している）
