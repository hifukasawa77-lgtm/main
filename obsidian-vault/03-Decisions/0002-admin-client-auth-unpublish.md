---
type: decision
date: 2026-06-28
status: accepted
tags: [decision, security, github-pages]
related: ["[[claude-md-project-rules]]", "[[static-hosting-security-limits]]"]
---

# admin画面（admin.html / admin-login.html）を公開から除外

## 背景・問題
- `admin-login.html` の認証は静的ホスティング（GitHub Pages）上では原理的に防御にならない。
  - アクセスガードは `admin.html` の `sessionStorage` チェックのみ → DevToolsで `sessionStorage.setItem('admin_session','1')` を実行すれば誰でも素通り。
  - フォールバックの `DEFAULT_HASH` は `"password"` の SHA-256（ソルト無し・ソースに丸見え）。
- サーバーが存在しないため、コード修正だけでは「本当の認証」を実現できない。

## 決定
- `admin.html` / `admin-login.html` をリポジトリから削除し、Pages公開から除外する。
- 併せて `index.html` フッターの隠し管理者リンクと `robots.txt` の admin 向け Disallow を整理。
- 削除前の中間対応として noindex メタ・JSフレームバスター・robots Disallow を入れたが、これらは「露出と付随リスクの低減」であって認証強化ではないと明記。

## 理由
- 静的サイトでクライアントサイド認証は飾りにしかならず、放置すると「守られている」という誤認を生む。
- ファイルは git 履歴に残るため、将来バックエンド認証（JWT等）を導入する際に復元可能。`admin-login.html` には既に `API_BASE`(localhost:3001) 経由のJWTログイン分岐が実装済みで、バックエンド前提に切り替える土台はある。

## 影響・トレードオフ
- ブログ管理UI（localStorage `admin_blogs` 編集・GitHub PATでのpush）が公開上は使えなくなる。ローカル運用かバックエンド導入が必要。
- セキュリティ姿勢は明確化（守れないものを公開しない）。
