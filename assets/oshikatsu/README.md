# assets/oshikatsu/ — 推し活ログの初期キャラ

`oshikatsu.html` の推しアイコン用「初期キャラ」5体（WebP・200×200）。

| ファイル | 名前 | 特徴 |
|---|---|---|
| chara-sakura.webp | さくら | ピンク髪の女の子 |
| chara-minato.webp | みなと | 青髪の男の子 |
| chara-haru.webp | はる | 紫髪の男の子 |
| chara-mio.webp | みお | ミント髪の女の子 |
| chara-sora.webp | そら | 金髪の男の子 |

## 出自（追跡可能性）
- 生成日: 2026-09-30 / 生成元: Canva の AI 画像生成（`generate-image`・Claude の Canva コネクタ経由）
- **完全オリジナルのキャラ**。既存作品・実在人物・特定のキャラクター名を指定していない
- プロンプトは「original anime-style character avatar icon, … no text, no watermark, no logo」＋髪色・服装・背景色の指定のみ
- 有料APIキーは使用していない（CLAUDE.md「APIキー禁止」に適合）
- 取得元の解像度が 200×200 のため、そのまま WebP q90 へ変換（拡大はしていない）
- **Canva の利用規約（AI生成物の商用利用条件）は公開前に `legal-checker` で再確認すること**

## 差し替え・追加するとき
`oshikatsu.html` の `PRESET_AVATARS` に `{ k, name, color }` を足し、`chara-<k>.webp` を置く。
`scripts/verify-oshikatsu.mjs` が「全プリセットが実際に読み込まれるか」を検査する。
