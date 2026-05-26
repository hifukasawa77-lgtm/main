# Anti-Tracker Chrome拡張

Webトラッキングプログラム（Google Analytics、Facebookピクセル、Hotjar等）を遮断するChrome拡張機能。

## 機能
- 100種のトラッカードメインへのリクエストを自動遮断
- サイト別ホワイトリスト（特定サイトのみ遮断を解除）

## インストール手順

### 1. アイコンを生成する
`tools/generate-icons.html` をブラウザで開き、「3サイズを一括ダウンロード」をクリック。
ダウンロードした `icon16.png`, `icon48.png`, `icon128.png` を `icons/` フォルダに配置。

### 2. Chromeに読み込む
1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. この `tracker-blocker/` フォルダを選択

## 使い方

拡張機能アイコンをクリックするとポップアップが開く。

- **保護中**: 現在のサイトのトラッカーを遮断している
- **「このサイトを許可リストに追加」**: そのサイトでの遮断を解除する
- **「このサイトの遮断を再開」**: 許可を取り消す
- 許可リストの `×` ボタン: リストからそのサイトを削除

## ブロックリストに含まれる主なトラッカー

| カテゴリ | ドメイン例 |
|---------|-----------|
| 行動分析 | google-analytics.com, mixpanel.com, amplitude.com |
| タグマネージャ | googletagmanager.com, adobedtm.com, tealiumiq.com |
| セッション録画 | hotjar.com, fullstory.com, logrocket.com, mouseflow.com |
| リターゲティング | doubleclick.net, criteo.com, adnxs.com |
| SNSピクセル | connect.facebook.net, analytics.twitter.com, analytics.tiktok.com |
| DMPデータ | demdex.net, bluekai.com, liveramp.com |

## 技術仕様

- Manifest V3 / `declarativeNetRequest` API
- 静的ルール100件（`rules/tracker_rules.json`）
- ホワイトリストは動的ルール（優先度2）で実装、ブラウザ再起動後も復元
