# セキュリティポリシー / Security Policy

## 脆弱性の報告 / Reporting a vulnerability

公開の Issue には書かず、GitHub の非公開報告を使ってください。
Please do **not** open a public issue. Use GitHub's private reporting instead:

<https://github.com/hifukasawa77-lgtm/main/security/advisories/new>

- 再現手順・影響を受けるページのURL・ブラウザを添えてください / Include steps to reproduce, the affected page URL and browser.
- 個人の趣味サイトのため、返答には数日かかることがあります / This is a personal site; replies may take a few days.
- 報奨金制度はありません / There is no bug bounty.

## 対象 / Scope

- `https://hifukasawa77-lgtm.github.io/main/` 配下のページ / Pages under the URL above
- このリポジトリの Cloudflare Worker（`cloudflare-worker/`）/ The Cloudflare Workers in this repository

対象外 / Out of scope: リンク先の外部サイト、DoS・大量アクセス、ソーシャルエンジニアリング /
third-party sites we link to, denial of service or load testing, social engineering.

## サイト側の防御 / Defenses in place

| 層 / Layer | 内容 / What | 検査 / Check |
|---|---|---|
| 全ページ / All pages | CSP（`object-src 'none'`・`base-uri`・`form-action`）、Referrer-Policy、クリックジャッキング対策 `assets/js/frame-guard.js` | `node scripts/security-baseline.mjs` |
| 主要5ページ / 5 key pages | ハッシュ固定の厳格CSP（インラインJS・イベント属性を禁止）/ hash-pinned strict CSP | `node scripts/security-csp.mjs` |
| CDN スクリプト / CDN scripts | 版固定＋SRI / pinned versions with SRI | `release-check` 検査#3 |
| Worker | Origin 完全一致・容量/回数制限・全応答に nosniff / CSP / X-Frame-Options / HSTS | `node --test tests/security.test.mjs` |
| 攻撃の遮断・記録・通知 / Block, log, alert | 攻撃パターンの遮断、繰り返す送信元IPの15分遮断、RFC 5424 シスログ、運営者への通知、ページからの通報（枠への埋め込み・CSP遮断） | `node --test tests/security.test.mjs` / `node scripts/verify-frame-guard.mjs` |
| Service Worker | 別オリジンに触らない・認証付き/エラー応答を保存しない | `node scripts/verify-service-worker.mjs` |

GitHub Pages は HTTP レスポンスヘッダを設定できないため、`frame-ancestors`・`X-Frame-Options`・
`Permissions-Policy` はページ側では効きません（`<meta>` では無視される）。クリックジャッキング対策は
スクリプトで代替しています。/ GitHub Pages cannot set response headers, so header-only protections are
replaced by a script-based frame guard on the static pages.

## 限界 / Limits

「すべての攻撃を必ず防ぐ」ことはどんな仕組みでも保証できません。/ No setup can guarantee that every attack is stopped.

- 静的ページは GitHub Pages が配信しており、ページへの大量アクセス（DoS）やGitHub側の障害はこのリポジトリでは防げません。
- Worker の遮断は Cloudflare の拠点ごとに数えるため、多数の拠点・多数のIPからの分散攻撃は1つずつ遮断が掛かるまで通ります。
- CSPで遮断・通報できるのは「ブラウザが読み込もうとしたもの」までです。利用者の端末が既に乗っ取られている場合は対象外です。
