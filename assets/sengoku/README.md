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

## 武将データの出典（`general_chronicles_researched.js` / `general_lifespans.js` / `.csv`）

- `general_chronicles_researched.js`: Wikipedia日本語版の記事本文を要約して収録（MediaWiki Action API 経由、
  2026年7月25日取得）。レコードごとに `sourceTitle`（記事名）・`sourceUrl`（記事URL）・`source`
  （「Wikipedia日本語版「◯◯」を要約（取得日、CC BY-SA 4.0）」の帰属表記）を保持し、
  ゲーム内の武将列伝パネル（`_generalChronicleText` / `_drawGeneralChronicle`、`sengoku.html`）で
  プレイヤーにもこの帰属表記が表示される。CC BY-SA 4.0 の要求（帰属・改変の明示・ライセンス名の表示）に対応
- `general_lifespans.js` / `general_lifespans.csv`: Wikidata（CC0 パブリックドメイン提供、P569/P570生年没年プロパティ）
  および既存文献による確認情報。CC0のため帰属表示義務なし
- 上記以外の武将能力値・エピソード短文（`GENERAL_HISTORICAL_CHRONICLES` 等、`sengoku.html` 内）は
  国立国会図書館リサーチ・ナビ「戦国大名・戦国武将を調べる」を調査の手がかりとした独自要約であり、
  他者著作物からの逐語転記ではない
