# assets/sengoku/ アセット出所

## 戦国風雲記の日本地図（`gpt/sengoku-japan-map-user-v2.webp`）

- 生成: ChatGPT の画像生成機能で深澤が生成し、2026-08-15 に提供
- 取り込み: 添付 PNG（1654×951）を、既存の城・施設座標との互換性を保つため 1672×941 に変換
- 配布形式: WebP q90。高ズーム用に `sengoku-japan-map-user-v2-detail.webp`
  （3344×1882、Lanczos 2倍、WebP q92、アンシャープ無し）を併用
- 用途: `sengoku.html` の全国図背景
- 対応する生成プロンプトはリポジトリに存在しない

## 旧日本地図（`gpt/sengoku-japan-map-user-v1.webp`）

- 生成: ChatGPT/DALL-E系のAI画像生成ツールで深澤が生成
- リポジトリ初出: 2026-07-27（コミット `38fbced`。当時は `sengoku-japan-map-user-v1.png`。
  2026-08-02 のWebP一括変換で `.webp` 化）
- 用途: `genpei.html` の全国図背景として継続利用（戦国風雲記は v2 へ移行）
- `assets/og/sengoku.jpg` / `assets/og/genpei.jpg` / `assets/genpei/genpei-thumb.webp` は
  この地図を含む画面のスクリーンショットとして配布される（[[genpei_法務チェック]] 参照）

`gpt/` 配下の他アセットは `gpt/prompts/*.txt` にAI生成プロンプトが残っているが、これらの地図は
深澤が直接生成した経緯のため対応するプロンプトファイルは存在しない。
