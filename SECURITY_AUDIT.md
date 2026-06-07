# セキュリティ監査レポート — hide_0001 Portfolio（ホームページ全体）

監査日: 2026-06-07
対象: `index.html`（メインポートフォリオページ）と、そこからリンクされる関連ページ
（`shogi.html`, `shogi_rpg.html`, `shogi_rpg_enhanced.jsx`, footer 経由の `admin-login.html` / `admin.html`）

凡例: 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW・INFO / ✅ GOOD（問題なし・評価点）

---

## 🔴 CRITICAL

### 1. 管理画面の認証がクライアントサイドのみで完結しており、ブラウザ操作だけで完全にバイパス可能
- 該当箇所: `admin-login.html:74-144`, `admin.html:875-893`
- `API_BASE = 'http://localhost:3001'` は GitHub Pages 上の本番環境では到達不能なバックエンドを指している。実質的に常に「localStorage フォールバック認証」（`admin-login.html:125-144`）のみが機能する。
- このフォールバック認証は **すべてクライアント側JavaScriptで完結**しているため、訪問者がブラウザの開発者ツールを開き、コンソールで
  ```js
  sessionStorage.setItem('admin_session', '1');
  location.href = 'admin.html';
  ```
  を実行するだけで、ID/パスワード入力もハッシュ照合も一切行わずに `admin.html` へ到達できる（`admin.html:878-880` のチェックは `sessionStorage` の値の有無しか見ていない）。
- さらに `DEFAULT_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'`（`admin.html:891`, `admin-login.html:75`）は文字列 `"password"` のSHA-256値であり、デフォルト認証情報がソースコードに平文同等の形で埋め込まれている。
- 加えて `admin-login.html:79-82` の「パスワードリセット（一度だけ実行）」ロジックは、`pwd_reset_ver` の値が変わるたびに localStorage 上のカスタムパスワードハッシュを削除してデフォルトへ戻してしまう。バージョン更新の度に独自設定が失われ、デフォルトパスワードへ静かに先祖返りするリスクがある。
- **推奨対応**: 本質的にはクライアントサイドJSのみで「認証」を行うアーキテクチャ自体が静的サイト（GitHub Pages）では真の認証たり得ない。サーバーサイド認証基盤（実際に動くバックエンドAPI、またはCloudflare AccessやGitHub Pagesの外部認証プロキシ等）を導入しない限り、admin機能の裏に本当に機密性の高いデータ・操作を置くべきではない。
- ※ユーザーの判断: 本サイトは個人用ホビーサイトであり admin 機能の裏に重大な機密データはない前提のため、**今回はコード変更を行わずレポート記載のみ**とする。

### 2. 一般訪問者にも見える場所に管理画面への入口リンクが存在する
- 該当箇所: `index.html:4818`
  ```html
  <p style="margin-top:8px;"><a href="admin-login.html" ... style="...opacity:0.35;...">管理者</a></p>
  ```
- footer に `opacity:0.35` で視覚的に目立たなくしているが、HTMLソース上は誰でも参照でき、リンク先パスも明示されている。これは「難読化」であって対策にはならない（ページソース閲覧やクローラーで容易に発見される）。
- 上記 CRITICAL #1 と組み合わさることで、誰でも数クリック＋コンソール1行でadmin画面に到達できる構造になっている。

### 3. GitHub Personal Access Token（PAT）をブラウザの sessionStorage に保存し、フロントエンドから直接GitHub APIへ書き込みを行う設計
- 該当箇所: `admin.html:691, 1614-1628`
  ```html
  <input type="password" id="ghPatInput" placeholder="github_pat_..." autocomplete="off" />
  ```
  ```js
  function getGhPat() { return sessionStorage.getItem('gh_pat') || ''; }
  ...
  sessionStorage.setItem('gh_pat', val);
  ```
- 強力な書き込み権限を持ちうるPATをブラウザストレージに常駐させる設計は、XSSが一度でも発生した場合に致命的な被害（リポジトリの改ざん等）につながる。`sessionStorage`であり`localStorage`より影響範囲は狭いが、同一オリジンで動作するスクリプトからは引き続き読み取り可能。
- **推奨対応**: PATのスコープを必要最小限（特定リポジトリの contents:write のみ等）に絞り、有効期限を短く設定する運用を徹底する。可能であれば、PATをブラウザに渡さずサーバーサイド（GitHub Actionsのworkflow_dispatch等）で公開操作を完結させる方式への移行を検討する。

---

## 🟠 HIGH

### 4. CSP（Content-Security-Policy）が `'unsafe-inline'` を許可しており、XSS発生時の被害緩和が機能しない
- 該当箇所: `index.html:5`
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com ...; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ...">
  ```
- `script-src` / `style-src` に `'unsafe-inline'` が含まれているため、CSP本来の「インラインスクリプト実行をブロックしてXSSの実害を抑える」という最大の利点が失われている。万一どこかでHTMLインジェクションが成立した場合、CSPはそれを止められない。
- 同様の設定は `admin.html`, `admin-login.html`, `agents.html`, `blog.html`, `dashboard.html`, `kage_shura_den.html`, `shogi.html` でも確認された。
- **理由・補足**: サイト全体が大量のインライン `<script>` ブロックや `onclick="..."` / `onmouseover="..."` 形式のインラインイベントハンドラ（例: `index.html:3892, 4109, 4163-4222, 4818, 10681` 等）に依存しているため、`'unsafe-inline'` を外すには相当規模のリファクタ（外部スクリプト化、`addEventListener`への置き換え、nonce/hash方式CSPへの移行）が必要。**今回のスコープ外としてリスクのみ記録する。**

---

## 🟡 MEDIUM

### 5. 複数のサードパーティ製・公開CORSプロキシを経由した外部データ取得
- 該当箇所: `index.html:6307-6309`（為替）, `7966-7968`（天気）, `9157-9159`（カレンダー/RSS）, `10467-10471, 10538-10542`（ニュースRSS）, `13733-13734`
- `corsproxy.io`, `api.allorigins.win`, `rss2json.com` などの無料公開CORSプロキシを複数フォールバックとして利用している。これらのプロキシ事業者は、訪問者のブラウザが発するリクエスト内容を技術的に閲覧・改ざんできる立場にある（中間者となり得る）。
- バックエンドを持たない静的サイトの構造上やむを得ない妥協点ではあるが、利用先プロキシが増えるほど「信頼の連鎖」に組み込まれる第三者が増え、露出面が拡大する。
- **推奨対応**: 可能であれば信頼できる単一のプロキシ（自前のCloudflare Workers等の軽量プロキシ）に集約する、または各データソースがCORS対応のAPIを提供していないか定期的に再確認する。

### 6. Google Calendar OAuth アクセストークンのクライアント側保持
- 該当箇所: `index.html:9001-9009`
- Google Identity Services (GIS) の標準的なトークンクライアントフローに準拠しており実装自体は妥当だが、取得したアクセストークンはブラウザのストレージ／メモリで扱われるため、CRITICAL #1〜3 と同様にXSSの影響範囲に含まれる点は留意が必要（CSPの `'unsafe-inline'` と合わせて評価）。

### 7. `target="_blank"` リンクで `rel="noopener"` のみ・`noreferrer` 欠落（修正済み）
- 該当箇所: `index.html:4195`（気象庁 地震情報リンク）, `index.html:7571`（kabutan.jp 株主優待リンク、テンプレートリテラル生成）
- 遷移先へリファラ情報（自サイトのURL）が送信されてしまう状態だった。
- **対応**: 本監査と合わせて `rel="noopener"` → `rel="noopener noreferrer"` に修正済み（下記「実施した修正」参照）。他の `target="_blank"` リンクは全て `rel="noreferrer"` または `rel="noopener noreferrer"` が設定されており問題なし。

---

## 🟢 LOW / INFO

### 8. Google系スクリプト・フォントにSRI（Subresource Integrity）が無い → 対応不要（意図的に正しい）
- 該当箇所: `index.html:16-18`（Google Fonts）, `3208`（`accounts.google.com/gsi/client`）, `3212`（`googletagmanager.com/gtag/js`）
- 一見するとSRI未設定はリスクに見えるが、これらはGoogle側の更新に応じて配信内容が動的に変わるスクリプト/CSSであり、SRIの`integrity`属性を付けるとハッシュ不一致により読み込み自体が失敗する。Google公式もこれらにSRIを付けないことを推奨している。**現状のまま（SRI無し）が正しい運用であり、対応不要。**

### 9. Unsplash外部画像（SRI機構なし）
- 該当箇所: `index.html:3375, 3388, 3401, 3414, 3427, 4627, 4640, 4664`
- `<img>` タグにはそもそもSRI機構が存在しないため該当なし。参考情報として記録のみ。

### 10. Google Analytics 計測IDがプレースホルダのまま
- 該当箇所: `index.html:3212, 3217`（`G-XXXXXXXXXX`）
- セキュリティ上の実害はないが、計測設定が未完了の可能性がある旨を参考記載。

### 11. 空のmailtoリンク
- 該当箇所: `index.html:4796`（`<a href="mailto:">`）
- セキュリティ上の問題ではなく機能上の不備（クリックしても宛先未指定でメーラーが開く）。参考記載のみ。

---

## ✅ GOOD（適切に実装されている点）

- `index.html:6`: `<meta http-equiv="X-Frame-Options" content="DENY">` — クリックジャッキング対策が適切に設定されている。
- `index.html:7`: `<meta name="referrer" content="strict-origin-when-cross-origin">` — リファラポリシーが適切に設定されている。
- `index.html:3209-3210`: Leaflet（地図ライブラリ）のCDN読み込みに `integrity` + `crossorigin` 属性（SRI）が正しく設定されている。
- `index.html` 内の `innerHTML` 代入（約30箇所、`5234`〜`10680` 付近）は、ほぼ全て自前の HTMLエスケープ関数 `escHtml()`（`index.html:5149` で定義、`&` `<` `>` `"` `'` をエンコード）または `escH()`（`index.html:10665, 10696` で定義、`&` `<` `>` `"` をエンコード）を通した上で組み立てられており、動的データをそのまま挿入していない。XSS対策として機能していることをサンプル箇所で確認した（`5234, 5290, 6151, 7511, 8280, 10680` 等）。
- `index.html` 内に `eval`, `Function(`, `document.write`, `javascript:` URIは検出されなかった。
- `shogi.html` の `innerHTML` 代入（`720, 763, 839, 1045, 1119`）は全て `el.innerHTML = ''` という空文字代入（要素クリア用途）のみで、XSSリスクは無い。
- `window.open()` の呼び出し（`index.html:8296, 9083, 11878, 13888`）は全て `'noopener'`/`'noreferrer'` オプション付きで、URLも `encodeURIComponent` 等で適切にエンコードされている。
- 主要な外部リンク（GitHub, X, Instagram, ニュース, イベント情報など）は `rel="noreferrer"` または `rel="noopener noreferrer"` が設定されている。

---

## 実施した修正
本監査と合わせ、機械的かつ低リスクな以下の2箇所を修正した（`rel="noopener"` → `rel="noopener noreferrer"`）:

| ファイル:行 | 内容 |
|---|---|
| `index.html:4195` | 気象庁 地震情報リンク |
| `index.html:7571` | kabutan.jp 株主優待リンク（テンプレートリテラル生成） |

それ以外の所見（admin認証アーキテクチャ、CSPの`unsafe-inline`、CORSプロキシ利用等）は、アーキテクチャ変更を伴う・個人用サイトとしての許容範囲内とユーザーが判断したため、本レポートへの記載のみとし、コード変更は行っていない。

## 総評
全体として、XSS対策（HTMLエスケープの徹底、`eval`/`document.write`不使用）、クリックジャッキング対策（X-Frame-Options）、外部リンクの`rel`属性、CDN読み込みのSRIなど、静的なポートフォリオサイトとして抑えるべき基本的なセキュリティ対策は概ね実装されている。

唯一、明確に是正が望ましいのは **管理画面（admin）の認証アーキテクチャ**（CRITICAL #1〜3）であり、現状は「鍵をかけているように見えるが鍵が機能していない」状態に近い。個人用ホビーサイトとして実害が出にくい設計（admin裏に機密情報を置かない）であれば直ちに致命的ではないが、将来的にadmin機能の重要度が増す場合は、サーバーサイド認証への移行を検討することを推奨する。
