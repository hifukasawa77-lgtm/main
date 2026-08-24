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
- **生成元・権利者**: このコピー元 `sengoku-japan-map-user-v1.webp` は
  ChatGPT/DALL-E系のAI画像生成ツールで深澤本人が生成したもの。記録は
  `assets/sengoku/README.md`（「旧日本地図」節）が正本（`[[genpei_法務チェック]]` で確認済み）。

## assets/og/taihei.jpg / taihei-thumb.webp（焼き込み配布・法務チェック済み）

- `scripts/gen-taihei-og.mjs` が MapScene を実描画→スクリーンショットして生成する
  （2026-08-21、legal-checkerによる法務チェック時点で既に生成済み）。
  すなわち `taihei-japan-map.webp`（上記・AI生成物のコピー）を**含む画面をそのまま焼き込んで配布**している。
- 出所は上記「taihei-japan-map.webp」節の記録（`assets/sengoku/README.md`）に一本化されており、
  `assets/og/sengoku.jpg` 等の先例と同じ扱い。追跡可能なため権利者上の懸念なし（GREEN）。
