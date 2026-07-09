---
type: decision
date: 2026-07-09
status: accepted
tags: [decision, harness, hook, lint]
related: ["[[harness-maintenance-patterns]]", "[[0007-harness-lint-automation]]"]
---

# 0011 mtime依存のファイル選択を廃止（recall hook / kpi-report）＋lint機械検査化

## 背景・問題
CCRリモート環境はコンテナ起動時にリポジトリをフレッシュクローンするため、**全ファイルのmtimeがほぼ同一**になる。この前提を欠いたmtime依存処理が2箇所で実害を出していた:
- `second-brain-recall.sh` が `ls -t` で「直近のDaily」を選択 → 不定順となり、2026-07-09のセッションで実際に最新（07-05）ではなく06-28を投入（**想起の劣化＝閉ループの土台の故障**）
- `kpi-report.sh` が `find -newermt` で期間内Daily数を集計 → 全ファイルが「新しい」扱いになり全件カウント

## 決定
1. 両スクリプトを**ファイル名の日付（`YYYY-MM-DD.md`）による比較**へ変更（mtime不使用）。
2. `harness-lint.sh` に検査#7「mtime依存ソート検出」を追加（`ls -t` / `find -newer*` 等を hooks/skills スクリプトから grep。自己除外＋コメント行除外）。正・負テスト済み。

## 理由
- 日付情報はファイル名に既に持っているので、名前比較が環境非依存で決定的。
- 同種バグの再発は grep で機械検出できる形をしており、lint恒久化の条件を満たす（/self-improve 手順0の方針）。

## 影響・トレードオフ
- recall hookは意図どおり「最新のDaily」を投入するようになる（挙動の修正であり仕様変更ではない）。
- 今後 hooks/skills でmtimeを使う正当な理由が出た場合は、lint検査#7の除外リストへの追加が必要。
