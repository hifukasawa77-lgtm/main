---
type: ダッシュボード
agent: pmo
updated: 2026-06-18
tags: [claudechord, pmo, dashboard]
---

# 🎛️ PMO ダッシュボード

> Dataview プラグインが必要。プレビュー（読み取り）モードで開くと集計が表示されます。

## 進行中プロジェクト

```dataview
TABLE status AS "状態", phase AS "フェーズ", target_file AS "対象", start AS "開始"
FROM "claudechord-vault/projects"
WHERE type = "プロジェクト" AND status != "完了" AND status != "中断"
SORT start ASC
```

## 全プロジェクト一覧

```dataview
TABLE status AS "状態", phase AS "フェーズ", start AS "開始"
FROM "claudechord-vault/projects"
WHERE type = "プロジェクト"
SORT status ASC, start DESC
```

## フェーズ別の滞留状況（ボトルネック検知）

```dataview
TABLE rows.file.link AS "プロジェクト"
FROM "claudechord-vault/projects"
WHERE type = "プロジェクト" AND status = "作業中"
GROUP BY phase AS "フェーズ"
```

## 直近の成果物更新

```dataview
TABLE project AS "PJ", type AS "種別", status AS "状態", agent AS "担当", updated AS "更新"
FROM "claudechord-vault/deliverables"
SORT updated DESC
LIMIT 15
```

## 関連ビュー

- [[KPI_品質メトリクス]]
- [[リスク登録簿]]
- [[課題ログ]]
