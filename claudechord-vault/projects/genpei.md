---
type: プロジェクト
project: genpei
status: 作業中
phase: 要件定義
target_file: genpei.html
owner: 深澤
start: 2026-08-05
tags: [claudechord, project, genpei]
---

# プロジェクト: 源平争乱記（genpei）

## 概要

戦国風雲記（`sengoku.html`）の日本地図・GameKit エンジン・ヘックス合戦資産を土台に、
源平合戦（治承・寿永の乱 1180–1185 から奥州合戦 1189 まで）を扱う歴史シミュレーションを作る。
全6シナリオ（本編5＋解禁1）。保元・平治はシナリオ化せず前史として扱う。

**戦国のリスキンにはしない。** 12世紀には城がなく、土地は京の権門が所有し、武士は御恩と奉公で契約する。
中核資源は「兵力」でも「石高」でもなく **「名分」（院宣・宣旨・官位・三種の神器）** とする。
平氏は全国の官位を握りながら滅び、頼朝は一度も京で戦わずに勝った——その構造をそのままルールにする。

- 構想: [[genpei_基本構想]]
- 姉妹作: 戦国風雲記（`sengoku.html`）／ [[sanguo]]（三国志・天下三分）

## 現在のフェーズ: `= this.phase`

**構想フェーズ完了**（[[genpei_基本構想]] 第3版・承認済み）。深澤の意思決定 全6件を反映済み。
未決事項なし。次は `genpei_要件定義.md`（MoSCoW法）の作成。

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

- 2026-08-05 構想フェーズ着手。地図（`sengoku-japan-map-user-v1.webp` 1672×941）と `provinces.json`（令制国65）は
  令制国の区割りが12世紀と16世紀でほぼ同一のため無加工で流用可能と判断。
- 2026-08-05 `siro_ichi.csv`（戦国の城164）は流用しない方針。12世紀に存在しない城が大半のため、
  国衙・荘園・館・湊からなる `kyoten_ichi.csv`（約145拠点）を新規に起こす。座標系は地図画素座標で既存パイプラインと共通。
- 2026-08-05 **【決定・深澤】序章2本（1156保元 / 1159平治）は作らない。** 全シナリオを1180年以降の全国マップとする。
  名分システムの導入役は1180シナリオが担う（鎌倉源氏＝流人から令旨一枚で始まる側、平氏＝名分最高値から削れていく側の対比で教える）。
  1180年以前に没した人物（源義朝・源為義・平忠正・藤原信西・藤原信頼・平重盛ほか）は武将データを持たず、人物列伝のテキストにのみ登場させる。
- 2026-08-05 **【決定・深澤】`sengoku.html`（1.3MB / 17,651行）には一切手を入れない。** 共通ライブラリへの切り出しも行わない。
  再利用はコードの移植（コピー）と `assets/sengoku/` のその場参照の2形態に限る。
  参照側の地図が将来別解像度で再エンコードされても壊れないよう、拠点座標は絶対画素値ではなく
  **正規化座標 `mx,my`（0..1）**で `kyoten_ichi.csv` に持つ（`castleMapRecordToWorld()` が `mx/my` を最優先で使うため）。
- 2026-08-05 **【決定・深澤】残る4件を planner 推奨どおり確定。** タイトル=「源平争乱記 / Genpei Souranki」、
  1ターン＝1ヶ月、攻城戦あり（館・城郭の簡易戦のみ・石垣/水堀/天守なし）、プレイ可能5勢力（平氏・鎌倉・木曽・甲斐・奥州）。
  → 構想フェーズの未決事項ゼロ。基本構想 第3版を承認済みとして確定。
