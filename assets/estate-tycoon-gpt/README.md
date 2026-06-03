# Block Baron Tokyo GPT-image2 Assets

GPT-image2.0で描き直した「街区王 東京23区編」用グラフィックです。

## Files

- `board-background-gpt-image-2.png`: 盤面背景の原寸生成画像
- `board-background-720.png`: Canvas表示用の720px版
- `estate-thumb-gpt-image-2.png`: `index.html` のカード用サムネイル
- `icons/dice.png`: サイコロ
- `icons/building.png`: 建物
- `icons/money-stack.png`: 資金
- `icons/token-player.png`: プレイヤー駒
- `icons/token-ai.png`: AI駒
- `asset-preview.png`: 取り込み済みアセットの確認用プレビュー

## Integration

`estate-tycoon.html` は盤面背景、ヘッダーアイコン、サイドパネルのサイコロ、Canvas内の資金アイコン、プレイヤー駒をこのPNGアセットから読み込みます。

`index.html` の街区王カードと検索メタデータも `estate-thumb-gpt-image-2.png` を参照します。
