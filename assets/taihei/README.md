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

## 未着手（後続Phase）

- 全国地図背景画像（`assets/sengoku/gpt/sengoku-japan-map-user-v2.webp` 相当を
  コピーして自ゲーム完結にする、spec 4.1節）はPhase A（骨格・ロジックのみ）では
  未着手。MapScene実装フェーズ（spec 6章 step6）でコピーする。
- `taihei-thumb.webp`（index.html掲載用サムネイル）も同様に未着手（spec 6章 step10）。
