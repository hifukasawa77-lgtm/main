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

- 構想: [[genpei_基本構想]]（第3版・承認済み）
- 要件: [[genpei_要件定義]]（Must 50 / Should 13 / Could 8・承認待ち）
- 基本設計: [[genpei_基本設計]]（承認待ち）
- 詳細設計: [[genpei_詳細設計]]（承認待ち・拠点147のロスター確定）
- 法務: [[genpei_法務チェック]]（GREEN。地図の出所記録漏れは深澤確認で是正済み）
- 姉妹作: 戦国風雲記（`sengoku.html`）／ [[sanguo]]（三国志・天下三分）

## 現在のフェーズ: `= this.phase`

構想フェーズ完了（[[genpei_基本構想]] 第3版・承認済み。意思決定6件すべて反映、未決なし）。
**設計フェーズ**: [[genpei_要件定義]]（Must 50 / Should 13 / Could 8）と [[genpei_基本設計]] を提出、いずれも深澤の承認待ち。
基本設計は名分・奉公度・恩賞債務・無血開城・朝敵認定・騎射・潮流の計算式を初期値まで確定し、
Must 50件すべてを設計箇所へ対応づけた（同 第10節 トレーサビリティ）。
[[genpei_詳細設計]] も提出。拠点147（国衙66/荘園40/館25/湊16）のロスターを確定し、
全アンカー城89件が `siro_ichi.csv` に実在することを機械確認済み。定数テーブル `RULE`・Rule層の関数仕様・
`endTurn()` のシーケンス・実装順序表21ステップまで落とした。

**実装フェーズ**: Phase 1〜4 が動作。
- Phase 1 地図・拠点270・ターン進行
- Phase 2 名分・無血開城・朝敵認定・御恩と奉公・勧誘（コマンド5種が開通）
- Phase 3 ヘックス合戦（騎射の間合い・士気決着・名乗り・一騎討ち）・攻城戦
- Phase 4 渡海・海戦・潮流・水軍の離反
- Phase 5 史実イベントの効果・三種の神器・人物列伝・家紋と肖像（すべて Canvas 描画）

検査:
- `scripts/verify-genpei-boot.mjs` 全27項目 PASS（http / file:// 両方）
- `scripts/verify-genpei-kyoten.mjs` 拠点270 PASS
- `scripts/verify-genpei-balance.mjs` 5試行 PASS（113ターン完走・5勢力残存・
  最大占有68%・無血開城が1試行あたり平均88回）

実装順序表21ステップを完了。

**公開フェーズ**: `index.html` へ掲載し、公開前監査と法務チェックを通した。
- 掲載: ツールカード／作品カード／JSON-LD `ItemList`（position 34）／`sitemap.xml`／
  案内エージェントの `GAMES`（36本目）＋ `site-knowledge.js` 再生成／日英辞書エントリ8件
- 画像: `scripts/gen-genpei-og.mjs` が実画面から OGP（`assets/og/genpei.jpg` 1200×630 JPEG）と
  カードサムネイル（`assets/genpei/genpei-thumb.webp` 960×540）を同時に書き出す。
  UI を変えたら撮り直すだけで両方が追随する
- 監査: seo-audit ✅／a11y-audit ✅／i18n-check ✅（103件）／release-check（index.html の
  Google Identity Services が SRI なしで残るが、GSI は安定ハッシュを公開しておらず SRI を付けられない）／
  dynamic-test で `genpei.html` PASS／`verify-game-assets.mjs` で genpei は404・例外ともに0件
- 法務: [[genpei_法務チェック]] GREEN（地図の出所記録漏れは深澤確認・`assets/sengoku/README.md`記録で是正済み）

残りは絵素材（合戦背景・イベント絵）とSFXのみ（S-08/S-09/S-10、着手中）。

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
- 2026-08-05 Phase 2 実装。武士団は別ファイルを作らず拠点データから決定論的に起こす方式にした（65団）。
  平氏に `paperRule` を導入し、本貫の外の武士団は拠点の持ち主が誰であれ中立から始まるようにした。
  「版図は最大なのに動員が伸びない」という史実の弱点が数値として出る。
- 2026-08-05 **【決定・深澤】残る4件を planner 推奨どおり確定。** タイトル=「源平争乱記 / Genpei Souranki」、
  1ターン＝1ヶ月、攻城戦あり（館・城郭の簡易戦のみ・石垣/水堀/天守なし）、プレイ可能5勢力（平氏・鎌倉・木曽・甲斐・奥州）。
  → 構想フェーズの未決事項ゼロ。基本構想 第3版を承認済みとして確定。
- 2026-08-05 公開監査で**監査スクリプト自体のバグを3件**見つけて直した。いずれも
  「緑にならない」ではなく「**間違った答えを返していた**」種類で、放置すると監査が信用できなくなる:
  - `i18n-check.sh`: PCRE の `\x{3040}` を `(*UTF)` なしで使い、LANG 未設定の環境で
    grep が毎回エラー→0を返す。**日本語を含む全ページが「title英語のみ」と誤警告**されていた
  - `seo-audit.sh`: `head -c 20000` で head を切っていたため、巨大な JSON-LD を持つ
    `index.html`（og:* が27KB目）が**OGP完全欠落と誤判定**。`</head>` までを見るよう変更
  - `a11y-audit.sh`: 装飾用 canvas の正解である `aria-hidden="true"` を認めていなかった
- 2026-08-05 上記の修正で露出した実際の指摘も是正した。`index.html` のグラフ用 canvas 8枚へ
  `role="img"` ＋ `aria-label`、`teams-transcriber/offscreen.html` と
  `float_sink_game/web/index.html` へ `lang="ja"`。
