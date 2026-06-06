# Kage Shura Den GPT Image 2 Assets

`kage_shura_den.html` 用に GPT Image 2 で描き直した画像アセットです。

ビジュアル方針は明るい和風伝奇・時代劇アクションです。ダークファンタジー、ホラー、ゴア、サイバーパンク表現は使用していません。

- `actors/`: 主人公、雑兵、提灯妖怪、大鬼
- `stages/`: 竹林と雪の神社
- `props/`: 足場5種とアイテム3種
- `source/`: 生成したアトラス原画とエフェクト/UIアトラス
- `kage-shura-title-art.png`: タイトル画面
- `kage-shura-thumb.png`: ポートフォリオカード

透明PNGの再生成:

```powershell
node scripts\process_kage_shura_gpt_assets.cjs
```
