# SEO 点検結果と Google Search Console の設定（Phase 6）

点検日: 2026-11-14 ／ 機械検査: `node scripts/seo-tags.mjs`（103ページ＋構造化データ）✅

## 点検結果

| 項目 | 状態 | 今回の対応 |
|---|---|---|
| title / meta description | ✅ あり | 「ブラウザゲーム40本以上」→ 実数57本に合わせ「50本以上」に修正（title・description・OGP・Twitter・FAQ本文とFAQの構造化データ・英訳） |
| 見出し構造 | ✅ h1 は1つ（ヒーロー）／各セクション h2／カード h3 | ヒーローの h1 に SEO 用の不可視テキスト（既存）を残し、表示文も h1 内に |
| canonical | ✅ `https://hifukasawa77-lgtm.github.io/main/` | 変更なし |
| OGP・Twitterカード | ✅ `assets/og/og-default.jpg` | 文言のみ更新 |
| sitemap.xml | ✅ 103 URL（seo-tags が公開ページとの一致を検査） | 変更なし（トップのURLは不変） |
| robots.txt | ✅ 全許可＋Sitemap 行 | 変更なし |
| JSON-LD | ✅ WebSite / FAQPage / ItemList（numberOfItems=57） | FAQ本文の更新に合わせ CSP ハッシュを再生成（`security-csp.mjs --write`） |
| 画像 alt | ✅ 49枚すべてに alt | 新着・おすすめの棚の複製サムネは `aria-hidden`（同じ画像の重複読み上げを避ける） |
| 内部リンク | ✅ 切れ0（`verify-portal.mjs` が毎回検査） | ヒーローからゲーム・ツール・ZERO-1へ直接リンク、カテゴリー移動の帯を追加 |
| モバイル対応 | ✅ 390/768/1440px で横はみ出し0 | スマホはメニュー1つに集約、ヘッダーを1段に |

検索順位の上昇は保証できない。上記は「検索エンジンが内容を正しく読める状態」を保つための点検。

## Google Search Console でやること（深澤の操作）

1. 所有権の確認: `index.html` に `google-site-verification` の meta が既にある → Search Console に該当プロパティがあるか確認
   （プロパティ種別は「URL プレフィックス」で `https://hifukasawa77-lgtm.github.io/main/`）
2. **サイトマップ**: 「サイトマップ」→ `sitemap.xml` を送信（送信済みなら「成功しました」と最終読み込み日を確認）
3. **URL 検査**: トップ URL を検査 →「インデックス登録をリクエスト」（デザイン刷新後の再クロールを促す）
4. **ページのエクスペリエンス／ウェブに関する主な指標**: 公開後 28 日分のデータが溜まってから LCP・INP・CLS を確認
5. **検索パフォーマンス**: 「クエリ」で “ブラウザゲーム 無料” “将棋 ブラウザ” 等の表示回数・CTR を月1回見る。
   CTR が低いページは description を見直す（`seo-tags.mjs` が長さと有無を見ている）
6. **リッチリザルト テスト**（<https://search.google.com/test/rich-results>）でトップの FAQ / ItemList が読めるか確認
