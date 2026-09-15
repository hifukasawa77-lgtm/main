# セキュリティー改善・適用前レポート

対象: https://hifukasawa77-lgtm.github.io/main/  
確認日: 2026-09-14  
基準コミット: `678c797d9c18e0449fbaedd1b1dde697d44001d0`  
作業ブランチ: `kai_001`（ローカルのみ）

## 状態

修正と下記のローカル検証を完了。本番サイト・GitHub・Cloudflareにはまだ反映していません。
リポジトリの [AGENTS.md](https://github.com/hifukasawa77-lgtm/main/blob/main/AGENTS.md) に「コミットや push は、ユーザーが明示的に依頼した場合のみ行う」とあるため、公開操作の承認待ちです。

## 今回実装した改善

| 対象 | 修正前の問題 | 修正内容 |
|---|---|---|
| トップ・ブログ一覧・記事・ダッシュボード・Worker管理画面 | インラインJavaScriptが広く許可、またはCSP未設定 | 実際のコードのSHA-256ハッシュのみ許可。イベント属性を禁止し、通常操作はaddEventListenerへ移行 |
| 同5ページ | 基底URL・埋め込みオブジェクト・フォーム送信の制限不足 | base-uri / object-src / form-action をnoneに設定 |
| トップの外部JavaScript | CDNドメイン全体を許可 | Google Identity Servicesとバージョン固定Leafletの必要なスクリプトURLに限定。既存LeafletのSRI検証を維持 |
| ブログ | IDの属性挿入、SVGをinnerHTMLに挿入 | IDをURLエンコード。SVGスタンプを画像として描画し、ページDOMへの実行可能な要素挿入を防止 |
| 管理画面 | 管理トークンをlocalStorageへ永続保存 | 永続保存を廃止し、画面を開いた際に旧保存値を削除 |
| 管理API | URLクエリでも管理トークンを受付 | X-Admin-Tokenヘッダーのみに限定。認証を維持し、管理レスポンスをno-storeに設定 |
| AIプロキシ2種 | Originの前方一致、または不許可Originでも処理続行 | 本番Originの完全一致。不許可の実リクエストを403で拒否。ローカル開発は明示設定時のみ許可 |
| AIプロキシ2種 | JSON読み込み前の容量制限・回数制限がない | ストリーム受信バイト上限、JSONオブジェクト検証、Cloudflare Rate Limitingを追加。制限機能が使えない場合は503で停止 |
| 公開チャット・統計 | 訪問者の会話由来の回答を他人へ再利用、統計に質問の一部を掲載 | 会話の自動共有保存と匿名の共有メモリ更新を停止。統計は数値のみ。通常のAIチャットは維持 |
| Service Worker | 他アプリのキャッシュも削除、広範なレスポンスを保存、古いJSが残る | 削除・照会・URL範囲を限定。認証付き・クエリ付き・private/no-store・エラー応答を保存しない。JSはネットワーク優先 |
| 開発・デプロイ | 今回の防御に対する回帰検査がない | CSPハッシュ確認・API検査・ブラウザ操作をCIへ追加。Workerデプロイ前にも基本検査。変更したActionsはコミットSHA固定、contents:read、認証情報保持なし |

## 検証結果

- `node --test tests/security.test.mjs`: 25件合格。
- `node scripts/verify-service-worker.mjs`: 21件合格。
- `node scripts/security-browser.cjs`: Microsoft Edgeのヘッドレスブラウザで合格。トップのタイマー、TODO追加・完了・絞り込み・削除、メモ追加・削除、ブログ閲覧、旧管理トークン削除を確認。挿入したインラインスクリプトとイベント属性の実行をCSPが拒否。ブラウザ実行時エラーなし。
- `node scripts/security-csp.mjs`: 5ページのハッシュ整合性を確認。
- 差分の空白検査: 既存app.jsのCRLFを許容するGit設定で合格。不要な全行改行変更は回避。
- Wrangler 4.131.2のドライランは実行を試みましたが、ビルドツールが親ディレクトリを読み取る際の環境のアクセス制限で完了できませんでした。実際のWorkerバンドル生成・Cloudflareへの反映は、公開前に運用環境で確認が必要です。

APIの単体検査はAI・KV・レート制限を模擬したローカル検査です。ブラウザ検査は外部通信を遮断し、ブログのテストデータを使用しています。本番のGoogle OAuth同意操作、全外部APIの応答、Cloudflare上の実際の回数制限、全ゲームの動作を確認したものではありません。

変更差分に対する自己評価: 86/100（仕様適合18/20、防御実装27/30、互換性17/20、検証16/20、運用8/10）。リポジトリのEvaluator基準に対する評価であり、サイト全体の安全性を点数化したものではありません。

## 公開時の手順と動作変更

1. 最新のmainとの差分を再確認して、作業ブランチの修正をレビュー・反映する。このレポートの基準コミット以降の変更を上書きしない。
2. HTMLとJavaScript、sw.jsを同時に反映する。HTML内のスクリプトを編集した場合は `node scripts/security-csp.mjs --write` を実行してハッシュを更新する。
3. ai-proxyは既存のdeploy-worker.ymlで反映される。新しいRATE_LIMITERを含むwrangler.tomlを必ず同時に適用する。
4. notebook-proxyは別Worker。承認済みの運用環境で `npx wrangler deploy --config cloudflare-worker/wrangler-notebook.toml` を実行する必要がある。既存のai-proxy用ワークフローではこちらは反映されない。
5. 公開後、サイト表示、Googleカレンダー同期、地図・外部データ表示、AIチャットを確認する。

AIはIPごとに30回/60秒、ノートブックは10回/60秒を設定。Cloudflare拠点ごとの近似的な制限であり、課金額の厳密な上限ではありません。共有IPでは複数ユーザーに制限が及びます。namespace_idはアカウント内の他設定と重複させないでください。

旧共有学習データは本番KVに残したままです。管理者が確認・削除できます。共有キャッシュの停止により、同じ質問にもAIを呼ぶため、従来よりAI利用量が増える可能性があります。管理トークンは利用のたびに入力が必要です。過去に他の端末へ保存した値も考慮して、トークンのローテーションを推奨します。

## 今回の範囲外・残る制限

- 強化対象は主要5ページとAIプロキシ2種、共通Service Workerです。リンク先ゲーム・ツール全ページの完全監査ではありません。
- トップ・ダッシュボードの外部データ取得は互換性のためHTTPS接続を引き続き許可しています。公開CORSプロキシへの依存も残ります。機密情報をこれらへ送信しないことが必要です。
- GitHub PagesではこのHTML修正だけでHTTPレスポンスヘッダーを自由に設定できません。metaで機能しないframe-ancestors / X-Frame-Optionsを追加して「対応済み」とはしていません。強制的な埋め込み防止には配信基盤側の対応が別途必要です。
- スタイルのunsafe-inlineは既存画面・動的描画との互換性のため残しています。JavaScriptのunsafe-inlineは対象5ページから除去済みです。
- CORSは認証ではなく、ブラウザ外のクライアントはOriginを偽装できます。公開AIの不正利用を完全に防ぐには、必要に応じて利用者認証・Turnstile・課金上限管理など追加設計が必要です。
- 管理画面のCORSはローカルファイル利用との互換性のため全Originを許可しますが、操作は管理トークンで認可します。管理画面を隠すことを認証とは扱いません。

## 実装根拠

- [MDN: script-srcとハッシュによる実行許可](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)
- [MDN: SVGを画像として使う場合の制限](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image)
- [Cloudflare: Rate Limitingの設定と制限](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Google: Identity Servicesに必要なCSP設定](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
