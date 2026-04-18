# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

hideの個人ポートフォリオサイト。GitHub Pages でホスティング（静的フロントエンド）。ダークサイバーパンク系のビジュアルデザイン。

管理機能（ブログ・ダッシュボード）はローカル専用の Node.js バックエンド（`backend/`）で動作し、GitHub Pages には含まれない。

## コンポーネント別の起動方法

### 静的フロントエンド
ビルド不要。HTML ファイルをブラウザで直接開く。
```
index.html, game.html, shogi.html, shogi_rpg.html, gradius/gradius.html 等
```

### バックエンド（管理機能）
```bash
cd backend
npm install
npm run dev   # node --watch server.js、ポート 3001
```
初回起動時に `admin.db.json` が自動生成され、`admin` / `password` で初期ログイン可能。

### SakuraLikeEditor（WPF テキストエディター）
```bash
dotnet run --project SakuraLikeEditor/SakuraLikeEditor.csproj
# リリースビルド
./SakuraLikeEditor/publish.ps1
```
.NET 8 + WPF（Windows のみ）。

## アーキテクチャ概要

### フロントエンド構成
- **GitHub Pages 静的サイト**: 素の HTML / CSS / JavaScript のみ。フレームワーク・ビルドツール不使用。
- **ゲーム系ページ**（`game.html`, `shogi.html`, `gradius/`）: Canvas API で完結。外部ライブラリ不使用。
- **将棋 RPG**（`shogi_rpg.html`, `shogi_rpg_local.html`）: React + Babel を CDN 経由で読み込む単一 HTML ファイル構成。3000 行超の大型ファイル。`shogi_rpg_enhanced.jsx` はビルド環境なし（参照用・ローカル確認用）。
- **学習ページ**（`learn*.html`）: 各言語（COBOL / SQL / REGEX 等）のインタラクティブ練習。独立ファイル。
- **管理画面**（`admin.html`, `admin-login.html`, `dashboard.html`）: バックエンド API（`http://localhost:3001`）と連携。JWT 認証。

### バックエンド構成（`backend/`）
- `server.js` — Express サーバー。REST API のみ提供。
- `database.js` — sql.js ベースだが、実際の永続化は `admin.db.json`（JSON ファイル）に書き出し。
- 主要 API エンドポイント: 認証 (`/api/auth/*`)、ブログ CRUD (`/api/blogs`)、画像アップロード (`/api/upload`)、ダッシュボード設定 (`/api/settings/*`)、ネットワーク ARP スキャン (`/api/network/arp`)。
- 全 API は JWT 認証必須（`/api/health`, `GET /api/settings/dashboard` を除く）。

### SakuraLikeEditor（`SakuraLikeEditor/`）
- WPF MVVM ライク構成。`MainWindow.xaml.cs` + `MainWindowCommands.cs` でコマンド定義。
- `Models/` — ドキュメント・設定のデータクラス。
- `Services/` — ファイル読み書き (`TextFileService`)、バックアップ (`BackupService`)、Grep 検索 (`GrepService`)、CSV (`CsvService`)、設定永続化 (`SettingsService`)。
- `Views/` — サブウィンドウ（検索置換、行移動、CSV、Grep）。

### エージェントパイプライン（`.claude/agents/`）
新機能開発は以下の 4 エージェントを順に使う:
```
Planner → Designer → Generator → Evaluator
```
- **Planner**: 要件定義・基本設計・詳細設計書を作成し、深澤の承認後に Generator へ引き渡す。
- **Designer**: グラフィック素材の制作・取得（フリー素材利用）。
- **Generator**: 仕様書通りに実装。不合格時は修正して再提出。同じ理由で 2 回不合格になったら深澤に報告。
- **Evaluator**: 100 点満点で採点。合格基準は 80 点以上かつ仕様適合性 16 点以上。XSS 発見時は即不合格。合格時は `kai_001` ブランチへコミット＆プッシュ。

## デザイン・スタイルのルール
- カラースキーム: 黒背景 + ネオンシアン / マゼンタ / パープル
- スタイル: Glassmorphism カード、アニメーションパーティクル背景（Canvas API）
- UI は日英バイリンガル表記
- ライブラリを追加する場合は CDN 経由のみ。ビルドツール不使用

## Git
- メインブランチ: `main`
- 作業ブランチ: `kai_001`
- コミット前に `.edge-test-profile/` が含まれていないか確認すること（.gitignore に未記載のため注意）
- コミットメッセージは日本語でも可

## 注意事項
- `.edge-test-profile/` は Microsoft Edge のブラウザデータ。絶対にコミットしないこと。
- `shogi_rpg_enhanced.jsx` / `shogi_rpg_enhanced .jsx`（スペース入りファイルも存在）は JSX 形式だがビルド環境なし。直接ブラウザでは動かない。
- `backend/admin.db.json` と `backend/*.db` は .gitignore 対象。コミット不要。
- `assets/art/` 以下の画像素材は `manifest.json` で管理。
