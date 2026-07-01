---
name: asset-optimize
description: 画像・JSON・音声アセットの容量削減。大容量ファイルの検出スクリプト、画像圧縮・遅延読み込み・GameKitプロシージャル生成への置換判断を提供する。「画像を軽くして」「サイトを軽量化して」「容量を減らして」という依頼や、perf-audit で1MB超過が出たときに使用する。
---

# /asset-optimize — アセット最適化

## 使い方

```bash
bash .claude/skills/asset-optimize/find-heavy.sh        # 150KB超のアセット一覧（降順）
bash .claude/skills/asset-optimize/find-heavy.sh 50     # 閾値をKBで指定
```

終了コード: 閾値超なし=0 / あり=1。

## 削減手段の優先順位

1. **プロシージャル生成への置換（最優先・容量ゼロ）**: ゲーム用スプライト/背景/エフェクトは `gamekit/gamekit.js` の `Gen` またはCanvas描画（explain-code スキルの技法）で生成できないか先に検討する。`gamekit/generator.html` で書き出しも可能
2. **画像圧縮**: PNG→WebP変換（`cwebp -q 80`）またはPNG最適化。写真系はWebP、UIパーツ/ドット絵はPNGのまま減色。目安: タイトル画像は100KB以下
3. **遅延読み込み**: `<img loading="lazy" width=".." height="..">`（index.html は実装済み）。ゲーム内アセットは開始ボタン押下後にロード
4. **大容量データ（JSON等）**: 初期ロードで読まない。必要になったタイミングで `fetch()`、または月別/カテゴリ別に分割（例: `blogs.json` 2.7MB は分割候補）
5. **音声**: BGMはOGG（96-128kbps目安）。短いSEは Web Audio API のプロシージャル生成（music-generator の得意分野）で容量ゼロにできる

## 判断基準

| 状況 | 対応 |
|---|---|
| ゲームの図形的なスプライト | プロシージャル生成に置換（容量ゼロ・ライセンス問題もゼロ） |
| 写真・複雑なアート | WebP圧縮＋lazy |
| 使われていないアセット | 参照ゼロを確認して削除（`grep -r "ファイル名"` で確認） |
| 外部から取得した素材 | 圧縮前に legal-checker のライセンス確認を通す |

## 注意
- 圧縮・変換ツール（cwebp等）が無い環境ではCanvasベースの変換（`gamekit/generator.html` パターン）か、変換手順だけ整えて深澤のローカル実行に委ねる
- 画質劣化はスクショ比較（/dynamic-test のスクショ）で確認してからコミットする
