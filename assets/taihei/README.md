# assets/taihei/

太平風雲記（`taihei.html`）専用のアセット置き場。他ゲームのフォルダを跨いで参照しない
（`taihei.html` は `assets/taihei/` 配下だけで自ゲーム完結させる方針。CLAUDE.md準拠）。

## provinces.json

- 出典: `assets/genpei/provinces.json`（源平争乱記・12世紀令制国66）を
  `scripts/gen-taihei-provinces.mjs` でフィールド名だけ変換して複製したもの。
  南北朝時代(1331-1392)の国境は源平期と同一のため地理データそのものは流用可能。
- フィールド対応: `nameJP→jp` / `nameEN→en` / `neighbors→adjacency` / `tasu→koku`
- `owner` / `facility` / `garrison` はランタイム状態のため静的JSONには含めない
  （`taihei.html` の `buildState()` が実行時に初期化する）
- 更新するときは `assets/genpei/provinces.json` を直接編集せず、
  `scripts/gen-taihei-provinces.mjs` を再実行して再生成すること
  （genpei側を汚さないため、genpeiは読むだけで書き戻さない設計）

## taihei-japan-map.webp

- 出典: `assets/sengoku/gpt/sengoku-japan-map-user-v1.webp`（1672×941）をそのままコピー
  （spec 4.1節。解像度・再エンコードなし、CLAUDE.md「アセットは全てWebP・解像度を変えない」準拠）。
- v1を選んだ理由: `assets/taihei/provinces.json`（`assets/genpei/provinces.json`複製）の
  x/y座標は genpei.html が `MAP_ASSET = 'assets/sengoku/gpt/sengoku-japan-map-user-v1.webp'`
  で校正した座標系のため、v1でなければ国ノードの位置が地図と合わない。
- 新規生成ではなく既存アセットのコピーのため、Graphic-Designerへの発注はせず
  Code-Generator（MapScene実装）が直接コピーした。

## 未着手（後続Phase）

- `taihei-thumb.webp`（index.html掲載用サムネイル）は未着手（spec 6章 step10、
  Evaluator合格後に `game-release` スキル手順で作成）。
