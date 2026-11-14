# アクセス解析ダッシュボード — 方式比較と導入手順（Phase 6）

作成: 2026-11-14 ／ **状態: 設計のみ・未導入**（導入には深澤のアカウント作成とプライバシーポリシー更新が必要なため）

## 0. いま分かっていること（現状）

- 本番には**アクセス解析が一切入っていない**。`privacy.html` 5章も「第三者によるアクセス解析タグを設置していません」と明記している
- トップのダッシュボードの訪問数カードは、**このブラウザで開いた回数（localStorage）** しか数えていなかった。
  旧版はこれを「サイト訪問数」と表示し、終了済みサービス `api.countapi.xyz` を毎回叩いていた
  → 今回、表記を「この端末での訪問回数（サイト全体のアクセス数ではありません）」に改め、終了済みAPIの呼び出しを削除した
- `dashboard.html`（旧版の詳細ダッシュボード）にも countapi の呼び出しが残っている（今回は未修正・改善候補に記載）
- **したがって、今日時点でサイト全体のページビュー・訪問者数・人気ページを出す元データは存在しない**。
  トップの「人気作品」欄を作らず「おすすめ（運営者の選定）」「新着（git 履歴）」にしたのはこのため

## 1. 方式の比較

GitHub Pages は静的配信のみ（サーバ側でログを取れない）。計測はブラウザから外部へ送る方式になる。

| 観点 | Cloudflare Web Analytics | GoatCounter（goatcounter.com） | GA4 | 自作（既存 Worker＋D1） |
|---|---|---|---|---|
| 費用 | 無料 | 無料（非商用。要・最新規約確認） | 無料 | 無料枠内（要見積り） |
| Cookie | 使わない | 使わない | 使う（_ga 等） | 設計次第（使わない設計にできる） |
| スクリプト | 小さい beacon | 小さい | 大きめ（gtag） | 自前（数百バイト） |
| 日別PV・訪問数 | ○ | ○ | ○ | ○（作る） |
| 人気ページ | ○ | ○ | ○ | ○（作る） |
| デバイス傾向 | ○ | ○（画面サイズ・ブラウザ） | ○ | △（UA を集計するなら作る） |
| 参照元 | ○ | ○ | ○ | ○（作る） |
| 自分のアクセス除外 | **管理画面の機能では無い**（読込を自分で止める必要） | 「Ignore IPs」設定 | 内部トラフィック（IP）フィルタ | 自由 |
| 管理画面の非公開 | アカウントのログイン（○） | ログイン（○） | ログイン（○） | **自前で認証が必要**（静的ページでは隠せない） |
| 開発・保守 | ほぼ不要 | ほぼ不要 | 設定が多い | 大きい |

出典（2026-11-14 確認）: Cloudflare「Web Analytics FAQ / データの取得元」<https://developers.cloudflare.com/web-analytics/faq/index.md> ・
<https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/> ／ GoatCounter「Prevent tracking my own pageviews」
<https://www.goatcounter.com/code/skip-dev>。Cloudflare で自分の訪問を除外する公式機能は見つからなかった（未確認扱い）。

## 2. 推奨: Cloudflare Web Analytics ＋「自分の端末では読み込まない」スイッチ

理由: 無料・Cookie不使用・GitHub Pages のまま（DNS変更不要）・既存の Cloudflare アカウント（Worker を運用中）でそのまま使える・
管理画面がログイン必須なので**管理者データが一般公開されない**。

自分のアクセス除外は、計測スクリプトを**読み込む前に**端末のフラグを見て止める（下記コード）。
ページに `?no-analytics=1` を付けて一度開くと、その端末では以後計測しない（`?no-analytics=0` で解除）。
**端末・ブラウザごと**の設定なので、スマホとPCそれぞれで1回ずつ行う。

### 計測の限界（画面とポリシーに書くこと）
- 広告ブロッカー・トラッキング防止を使う訪問者は数えられない（実数より少なく出る）
- 「訪問者数」は推定値（Cookie を使わないため、同じ人の別端末・別日は別に数えられることがある）
- 自分の除外は端末ごと。設定し忘れた端末・シークレットウィンドウの自分の訪問は数えられる
- Bot はサービス側で除外されるが完全ではない

## 3. 導入手順（深澤が行う操作）

1. Cloudflare ダッシュボード → **Analytics & Logs → Web Analytics → Add a site** → ホスト名 `hifukasawa77-lgtm.github.io` を登録
2. 表示される JS スニペットの `token`（公開して問題ない識別子。APIキーではない）を控える
3. **プライバシーポリシー（`privacy.html` 5章）を先に更新**する。記載例:
   「本サイトは Cloudflare, Inc. の Cloudflare Web Analytics を利用し、閲覧ページ・参照元・ブラウザやOSの種類・おおよその地域などの
   情報を同社へ送信します。Cookie は使用しません。送信を止めたい場合はブラウザの拡張機能等で cloudflareinsights.com への通信を遮断してください。」
   （電気通信事業法の外部送信規律〔27条の12〕の対象事業者に当たるかに関わらず、送信先・内容を公表しておく。`legal-scan --only external-send` で整合を確認）
4. 下のコードを `assets/js/portal.js` の末尾（`init()` の中）に追加し、`TOKEN` を2の値にする
5. 計測を入れるページの CSP に追加（`index.html` は厳格CSP）:
   `script-src` に `https://static.cloudflareinsights.com`、`connect-src` に `https://cloudflareinsights.com`
6. `node scripts/security-csp.mjs --write` → `node scripts/verify-portal.mjs` → `node scripts/legal-scan.mjs --only external-send`
7. 自分の各端末で `https://hifukasawa77-lgtm.github.io/main/?no-analytics=1` を1回開く
8. 翌日以降、Cloudflare の Web Analytics 画面で日別PV・訪問数・人気ページ・参照元・デバイスを確認する

```js
// アクセス解析（Cloudflare Web Analytics）。自分の端末では読み込まない
(function loadAnalytics() {
  const TOKEN = ''; // ← Cloudflare の Web Analytics で発行された token（空なら何もしない）
  const KEY = 'portal-no-analytics';
  try {
    const q = new URLSearchParams(location.search).get('no-analytics');
    if (q === '1') localStorage.setItem(KEY, '1');
    if (q === '0') localStorage.removeItem(KEY);
    if (!TOKEN || localStorage.getItem(KEY) === '1') return;
  } catch (e) { if (!TOKEN) return; }
  if (navigator.doNotTrack === '1' || window.globalPrivacyControl) return; // 送らない意思表示を尊重
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
  document.head.appendChild(s);
})();
```

## 4. 「管理者向けダッシュボード」をサイト内に作る場合（任意・後回し推奨）

GitHub Pages は静的なので、**ページ内に数字を置くと誰でも見られる**（URLを隠しても、リポジトリが公開なので中身は読める）。
サイト内に置くなら次の構成が必要:

```
管理画面（静的HTML・データは持たない）
   → Worker の /admin/analytics（既存 cloudflare-worker。管理トークン or Cloudflare Access で保護）
       → Cloudflare GraphQL Analytics API（API トークンは Worker の Secret。リポジトリに書かない）
```

- 既存 Worker には `/admin/` の 401 を総当たりとして通知する仕組みがある（`security-monitor.js`）ので、そこに乗せられる
- 棒グラフ（日別PV）・訪問数・人気ページTOP10・デバイス・参照元は GraphQL の集計で取れる見込み。**実データで確認するまで完成扱いにしない**
- 手間に対し得られるものは Cloudflare の画面とほぼ同じなので、まず §2 で運用し、不足が見えてから作るのが妥当

## 5. 公開サイトに出してよい数字

- 出してよい: 作品数・ツール数（実数の自動計数）、公開日（git 履歴）
- 出さない: アクセス数・人気ランキング（計測を入れるまでは元データが無い。入れた後も、出すなら「Cloudflare Web Analytics による推定・
  ○月○日時点」と出典と限界を添える）
