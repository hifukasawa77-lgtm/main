# hideの部屋 トップ刷新 — 最終報告（本番未反映・承認待ち）

作業ブランチ: `ccr-b6b95c08-j3obvl` ／ 作業日: 2026-11-14 ／ **main へのマージ・本番デプロイはしていない**

| # | 成果物 | 場所 |
|---|---|---|
| 1 | 現状分析と改善項目一覧 | [`01-analysis.md`](01-analysis.md) |
| 2 | デザイン方針と画面構成 | 本書 §1 ／ `01-analysis.md` §4 |
| 3 | 修正したソースコード | §2 のファイル一覧（コミット単位は §2 末尾） |
| 4 | 追加・変更ファイル一覧 | §2 |
| 5 | 実装済み／未実装 | §3 |
| 6 | テスト結果 | §4 |
| 7 | Lighthouse | §5 |
| 8 | GitHub Pages 公開手順 | §6 |
| 9 | 今後の改善候補 TOP10 | §7 |
| — | アクセス解析の比較・導入手順 | [`03-analytics.md`](03-analytics.md) |
| — | SEO 点検と Search Console | [`04-seo-search-console.md`](04-seo-search-console.md) |
| — | 変更前後のスクリーンショット | [`screenshots/`](screenshots/)（before-*/after-* × desktop/mobile/works） |

## 1. デザイン方針と画面構成

- **ダークネイビー（#070d1a）× ブルー/シアン（#38bdf8・#22d3ee）**、パープルは状態表示に少しだけ。
  発光・ネオンは使わず、ガラス調カードと細い罫線で層を作る（CLAUDE.md のサイバーパンク禁止に沿う）
- 実装は **main.css の上に重ねる上書き層 `assets/css/portal.css`**。`<link>` を1行外せば旧デザインに戻る（比較・切り戻しが容易）
- 構成: ヘッダー（スクロールで縮む・検索・言語・メニュー）→ ヒーロー（価値提案・主ボタン「ゲームを探す」・実数の統計・今日のおすすめ）
  → カテゴリー移動の帯（スクロール追従）→ ゲーム（気分で選ぶ表〈スマホは畳む〉・新着/おすすめ棚・検索/並べ替え/ジャンル・カード）
  → AIツール → **ZERO-1（新設）** → 既存セクション（順序・アンカーは不変）

## 2. 追加・変更ファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `index.html` | 変更 | ヘッダー/メニュー/検索ダイアログ/ヒーロー/カテゴリー帯/カタログのツールバー/ZERO-1 節を追加。カード2枚にジャンル付与・ジャンルボタン2つ追加。サムネ参照を軽量版へ。SEO 文言を実数に。CSP 再生成 |
| `assets/css/portal.css` | 新規 | ダークネイビーの上書き層・新UIのスタイル・レスポンシブ・reduced-motion・コントラスト修正 |
| `assets/js/portal.js` | 新規 | メニュー・サイト内検索・カタログ・棚・今日のおすすめ・ページトップへ・英語訳 |
| `assets/js/app.js` | 変更（最小） | テーマ色が背景を白に戻す不具合／背景粒子の配色／タイプライター無しで落ちない／訪問数カードの表記と終了済みAPI削除／blogs.json の遅延取得／「40本以上」→「50本以上」 |
| `data/catalog-meta.json` | 新規（生成物） | 作品の公開日（git 履歴から） |
| `assets/thumbs/*.webp`（20枚・1.1MB） | 新規（生成物） | カード用の軽量サムネ（原画は未変更） |
| `scripts/gen-catalog-meta.mjs` | 新規 | 公開日の生成・`--check` |
| `scripts/gen-top-thumbs.py` | 新規 | 軽量サムネの生成・`--check` |
| `scripts/verify-portal.mjs` | 新規 | E2E 検査 32 項目＋故障注入 4 種 |
| `CLAUDE.md` / `.claude/agent-conventions.md` | 変更 | トップの必須検査を登録 |
| `docs/portal-redesign/*` | 新規 | 本書・分析・解析設計・SEO・スクリーンショット |

コミット: `17e6a03` Phase1 → `b7ec9bd` Phase2-3 → `504b289` E2E → `82ba82c` Phase6 → `da81d2c` Phase4 → 検査登録・本書

## 3. 実装済み／未実装

**実装済み**
- ヒーロー刷新（ゲームへの主導線・実数の統計・日替わりのおすすめ＋「別の作品」）
- スクロールで縮むヘッダー、スマホのメニュー（Esc で閉じる・フォーカスの閉じ込めと戻し・リンクで閉じる）
- サイト内検索（`/` または Ctrl+K。ゲーム・ツール・セクション横断、ひらがな/カタカナ/全角半角を同一視、↑↓/Enter）
- カテゴリー移動の帯、ページトップへ戻るボタン
- 作品カタログ: タイトル・説明検索（案内エージェントの別名辞書も使う）、ジャンル、並べ替え（おすすめ/新着/名前・選択を記憶）、
  件数表示、該当なし表示と「条件をクリア」、NEW 印・公開日、説明の「詳しく」展開
- 新着（git 履歴）・おすすめ（運営者の「気分で選ぶ」表が正本）の棚
- 「スマホ対応」印は**作者自身の説明に書いてある作品だけ**（推測で付けない）
- ZERO-1 紹介（公開中の ZERO-1 Mobile と構想を色分け・2030 ロードマップは「構想・予定は変わる」と明記）
- 訪問数カードの誤表示の是正（端末内の回数と明記・終了済み countapi 削除）
- SEO 文言の実数化・CSP 再生成、表示速度改善、コントラスト修正、日英切替（既存の `site-lang` を使用）

**未実装（理由）**
- 人気作品・アクセスランキング — 元データが無い（解析未導入）。捏造しない
- アクセス解析の導入・管理者ダッシュボード — 深澤のアカウント操作とプライバシーポリシー更新が先。手順は `03-analytics.md`
- 全作品の PC/スマホ対応表 — 実機で確かめたデータが無い（作者の記載がある作品のみ表示）
- `dashboard.html`（旧詳細ダッシュボード）の countapi・表記 — 今回の範囲外（改善候補）
- 既存カードの日英混在（英語のみ/日本語のみの見出し） — 既存翻訳辞書の範囲。改善候補

## 4. テスト結果（すべてローカルの静的サーバ＋ヘッドレス Chromium）

| 検査 | 結果 |
|---|---|
| `node scripts/verify-portal.mjs` | ✅ 32 / 32（内部リンク・アンカー・ジャンル・公開日・サムネ・件数・背景・カタログ・検索・日英・保存データ・メニュー・はみ出し 390/768/1440） |
| `node scripts/verify-portal.mjs --inject` | ✅ 故障注入 4 / 4 を検出 |
| `bash .claude/skills/release-check/release-check.sh`（main との差分全体） | ✅ 問題なし（12項目） |
| `bash .claude/skills/dynamic-test/run.sh index.html` | ✅ PASS |
| `node scripts/playtest-fuzz.mjs index.html --seconds 10 --seed 7` | ✅ 4 / 4 |
| `node scripts/verify-responsive.mjs index.html` | ✅ 3 / 3 |
| `node scripts/seo-tags.mjs` | ✅ 103 ページ＋構造化データ |
| `node scripts/security-baseline.mjs` / `security-csp.mjs` | ✅ 119 ページ / CSP 5 ページ一致 |
| `node scripts/verify-service-worker.mjs` | ✅ 21 / 21 |
| `node scripts/verify-asset-format.mjs` | ✅ |
| `bash .claude/skills/a11y-audit/a11y-audit.sh index.html` | ✅ 必須項目の問題なし |
| 文字コントラスト走査（表示中の全テキスト・実ブラウザ） | ✅ 4.5:1 未満 0 件（修正前は 3:1 未満だけで 27 件） |
| `harness-lint.sh` | ✅ |

**確認できていないこと**: 実機（iPhone/Android）・Safari/Firefox での表示（ヘッドレス Chromium のみ）、本番 URL での動作（未デプロイ）。

## 5. Lighthouse（v12.8.2・ローカル配信・同一マシンで変更前後を計測）

| | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | 転送量 |
|---|---|---|---|---|---|---|---|---|
| 変更前 モバイル | 44 | 90 | 100 | 100 | 25.8 s | 0.065 | 790 ms | 5.4 MB |
| **変更後 モバイル** | **65** | **94** | 100 | 100 | **7.7 s** | **0** | **200 ms** | **1.8 MB** |
| 変更前 デスクトップ | 70 | 90 | 100 | 100 | 5.0 s | 0.042 | 90 ms | 6.9 MB |
| **変更後 デスクトップ** | **89** | **94** | 100 | 100 | **2.0 s** | **0.011** | **10 ms** | **2.3 MB** |

外部（Google Fonts・GSI・各種API）への通信を含むローカル計測のため、本番の値とは一致しない。傾向の比較として扱うこと。
モバイル LCP 7.7 秒の残りは主に「描画の遅れ」（render-blocking のフォントCSS・app.js 465KB の解析）。改善候補 #2〜#4。

## 6. GitHub Pages 公開手順（承認後）

1. 本ブランチの差分を確認（PR を作る場合はご指示ください。現時点では作成していません）
2. `main` へマージ（GitHub Pages は `main` のルートから配信している現行の運用を前提）
3. 反映確認: `bash .claude/skills/deploy-verify/deploy-verify.sh`（公開URLの HTTP 200・本番スモーク）→ 本番URLで `/` キー検索・メニュー・ジャンル絞り込みを手で1回ずつ
4. キャッシュ: HTML は SW の network-first なので即時反映。CSS/JS は `?v=20261114` / `?v=portal-20261114` で新しいキーになる
5. Search Console で URL 検査→インデックス登録をリクエスト（`04-seo-search-console.md`）
6. 戻す場合: `index.html` の `portal.css` の `<link>` を外せば見た目は旧に戻る（機能ごと戻すならマージコミットを revert）

## 7. 今後の改善候補 TOP10

1. **アクセス解析の導入**（Cloudflare Web Analytics・`03-analytics.md`）→ 実データで「人気」棚を作る
2. **app.js（465KB）の分割**: ダッシュボード群をダッシュボード欄が近づいてから読み込む（モバイル TBT/LCP の最大要因）
3. Google Identity Services（約100KB）を「Googleから同期」を押したときだけ読み込む
4. ロゴ用 Web フォント（Orbitron/Fira Code）の削減・サブセット化（render-blocking 約0.9秒）
5. 案内エージェントの作品データとトップのカードの不一致解消（トップのみ5件／データのみ3件）
6. `dashboard.html` の終了済み countapi 呼び出しと「サイト訪問数」表記の是正
7. カード内のボタン（シェア・詳しく）が `<a>` の中にある構造を `<article>`＋リンクへ（HTML の妥当性・読み上げ）
8. 作品ごとのスマホ対応を実機/検査で確かめたデータにし、対応表と絞り込みを出す
9. OGP 画像を新デザインで作り直す（`node scripts/gen-site-og.mjs`）
10. スマホで縦に長いページ（約6万px）の整理: スポーツ・ダッシュボードを別ページかタブへ
