---
type: 要件定義書
project: city_builder
status: 合格
agent: planner
target_file: city.html
created: 2026-05-17
updated: 2026-05-17
tags: [claudechord, 要件定義, city_builder]
---

# 要件定義書 — city_builder

> プロジェクトハブ: [[city_builder]]

## 1. 背景・目的

道路・住宅・商業・工業の 4 種のみで戦略性が薄く、テーマもサイバーパンク（CLAUDE.md 禁止規約に抵触）。
インフラ・交通アニメーション・災害イベントを追加し、Canvas API のみで SimCity ライク体験を実現する。

## 2. 機能要件（抜粋・MoSCoW）

### Must
- M-01 テーマをモダン都市計画へ刷新（黒背景＋シアン/パープルは継承）
- M-04 電力システム（発電所＋送電線）
- M-10 地震イベント

### Should
- S-01 施設ステータスのホバー表示

詳細は `.claude/specs/city_builder_req.md` を正本とし、本ノートは vault 内のハブから辿るためのインデックス。

## 5. 承認

- [x] 深澤（PM）承認
- 次工程: [[city_builder]] の基本設計・詳細設計へ
