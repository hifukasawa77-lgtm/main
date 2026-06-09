# Hyakki GPT Image 2 Assets

`hyakki.html` 用に GPT Image 2 で描き直した画像アセットです。

- `sheets/`: 5キャラクターの4x2アクションシート原画
- `char-{0..4}/`: Canvasランタイム用の透明ポーズPNG
- `stages/`: 2ステージの背景画像
- `hyakki-title-key-art-gpt-image-2.png`: タイトル画面用キーアート
- `hyakki-thumb-gpt-image-2.png`: OGP / ポートフォリオカード用サムネイル

キャラクター画像の再処理:

```powershell
node scripts\process_hyakki_gpt_assets.cjs
```
