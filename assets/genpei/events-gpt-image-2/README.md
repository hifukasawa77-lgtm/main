# 源平争乱記 — 歴史イベント画（GPT Image 2）

- 生成ツール: OpenAI GPT Image 2（Codex built-in image generation）
- 生成日: 2026-08-30
- 用途: `genpei.html` の `TIMELINE` 全15イベント
- 形式: WebP（quality 88）、1672×941、16:9（GPT Image 2のPNG原本から配信用変換）
- 共通方針: 平安末期の絵巻感と映画的厚塗りを合わせた歴史ゲーム用イラスト。画像内文字・透かしなし。
- 時代考証上の除外: 天守閣、近世石垣、火縄銃、西洋甲冑、近現代品。

## 対応表

| 年月 | イベント | ファイル |
|---|---|---|
| 1180-08 | 石橋山の戦い | `ishibashiyama.webp` |
| 1180-10 | 富士川の戦い | `fujikawa.webp` |
| 1180-12 | 南都焼討 | `nanto-shoutou.webp` |
| 1181-02 | 平清盛の死 | `kiyomori-death.webp` |
| 1181-06 | 養和の飢饉 | `yowa-famine.webp` |
| 1183-05 | 倶利伽羅峠の戦い | `kurikara.webp` |
| 1183-07 | 平氏都落ち | `miyako-ochi.webp` |
| 1183-10 | 寿永二年十月宣旨 | `juei-senji.webp` |
| 1184-01 | 宇治川・粟津の戦い | `ujigawa-awazu.webp` |
| 1184-02 | 一ノ谷の戦い | `ichinotani.webp` |
| 1185-02 | 屋島の戦い・扇の的 | `yashima-yoichi.webp` |
| 1185-03 | 壇ノ浦の戦い | `dannoura.webp` |
| 1185-11 | 文治の勅許・守護地頭 | `shugo-jito.webp` |
| 1189-04 | 衣川 | `koromogawa.webp` |
| 1189-09 | 奥州合戦 | `oshu-war.webp` |

## プロンプト設計

全画像に次の共通指定を使用した。

> Use case: historical-scene. Asset type: landscape game event illustration, 16:9. Premium Japanese historical game key art, painterly cinematic realism blended with late-Heian emaki sensibility, rich brush texture. No text, captions, or watermark. Historically plausible late 12th-century Japan. No keep-style castles, massive stone walls, firearms, European armor, or modern objects.

各画像では上記に、対応表の出来事、季節・時刻・場所、中心人物または象徴物、構図、光と感情を追加した。具体的な主題は順に、雨夜の石橋山退却、水鳥が飛び立つ富士川、炎上する南都寺院、病間の清盛、旱魃下の民衆、夜の倶利伽羅急襲、安徳天皇を伴う都落ち、宣旨伝達、冬の宇治川と粟津、一ノ谷の逆落とし、那須与一の扇、壇ノ浦の潮流、守護地頭任命、衣川の最期、奥州への大軍進撃。死や入水は直接的・残虐な表現を避け、象徴的に描写した。
