---
name: seo-audit
description: サイト全HTMLのSEO/OGP監査と是正。og:title・og:description・og:image・twitter:card・meta description・canonical の有無を機械検査し、欠落ページへ本サイト標準のOGPテンプレを展開する。「SEO対応して」「OGP付けて」「SNSでシェアしたときの見た目を整えて」という依頼や、新規ページ公開前に使用する。
---

# /seo-audit — SEO/OGP監査・展開

## 使い方

```bash
bash .claude/skills/seo-audit/seo-audit.sh          # 全HTML監査（欠落テーブル出力）
bash .claude/skills/seo-audit/seo-audit.sh zelda_like.html # 指定ファイルのみ
```

終了コード: 欠落なし=0 / 欠落あり=1。admin系・テスト用HTMLは除外済み。

## 本サイト標準のOGPテンプレ

`<head>` 内に以下を追記する（値はページごとに差し替え）:

```html
<meta name="description" content="ページの説明（日本語70字目安。ゲームならジャンル＋遊び方の一言）">
<link rel="canonical" href="https://hifukasawa77-lgtm.github.io/main/PAGE.html">
<meta property="og:type" content="website">
<meta property="og:title" content="ページ名 | hide_0001 Portfolio">
<meta property="og:description" content="descriptionと同文でよい">
<meta property="og:url" content="https://hifukasawa77-lgtm.github.io/main/PAGE.html">
<meta property="og:image" content="https://hifukasawa77-lgtm.github.io/main/assets/og/PAGE.png">
<meta property="og:site_name" content="hide_0001 Portfolio">
<meta name="twitter:card" content="summary_large_image">
```

- **og:image の方針**: 1200x630。ダーク背景（#0a0a12系）＋シアン/パープルのアクセントで既存ビジュアルと統一（サイバーパンク演出禁止）。ゲームは `test-screenshots/` のスクショを加工して使ってよい。専用画像が無い間は index.html が使っているサイト共通OG画像へフォールバックする
- **日英**: title は「日本語名 | 英語名」併記が既存慣例（index.html 準拠）
- ゲームページは index.html の JSON-LD（`SoftwareApplication` の ItemList）にもエントリを追加する

## sitemap.xml への追記

新規ページ公開時は `sitemap.xml` に `<url><loc>...</loc></url>` を1エントリ追加する（存在確認: リポジトリ直下）。

## 運用
- 新規HTML作成時は必ずこの監査を通してからコミットする（/release-check からも参照される）
- 一括是正するときは欠落テーブルの上から、公開価値の高いページ（index からリンクされているもの）を優先する
