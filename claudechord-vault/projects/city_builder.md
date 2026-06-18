---
type: プロジェクト
project: city_builder
status: 作業中
phase: 評価
target_file: city.html
owner: 深澤
start: 2026-05-17
tags: [claudechord, project]
---

# プロジェクト: city_builder

## 概要

ポートフォリオ収録済みの City Builder を SimCity ライクに大幅拡張する。サイバーパンクテーマを
「モダン都市計画」へ刷新し、インフラ・交通アニメーション・災害イベントを追加する。

## 現在のフェーズ: `= this.phase`

## 成果物（このプロジェクトに紐づくノート）

```dataview
TABLE type AS "種別", status AS "状態", agent AS "担当", updated AS "更新"
FROM "claudechord-vault/deliverables"
WHERE project = this.project
SORT updated DESC
```

## 評価履歴

```dataview
TABLE eval_score AS "点", spec_score AS "仕様", revision_count AS "回", verdict AS "判定"
FROM "claudechord-vault/deliverables"
WHERE project = this.project AND type = "評価レポート"
SORT revision_count ASC
```

## メモ・意思決定ログ

- 2026-05-17 要件確定（[[city_builder_要件定義]]）。サイバーパンク禁止規約に抵触していたためテーマ刷新を Must に。
- 2026-06-18 v1 評価で仕様適合性不足により不合格 → v2 で合格。
