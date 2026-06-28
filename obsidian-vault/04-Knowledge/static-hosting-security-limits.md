---
type: knowledge
tags: [knowledge, security, github-pages, frontend]
related: ["[[0002-admin-client-auth-unpublish]]"]
---

# 静的ホスティング（GitHub Pages）のセキュリティ制約と実務メモ

GitHub Pages は HTTP レスポンスヘッダを自由に付与できないため、ヘッダ前提のセキュリティ機構は使えない。代替手段を覚えておく。

## ヘッダが使えないことによる制約
- **`X-Frame-Options`** は `<meta http-equiv>` では**無効**（ブラウザが警告を出す。HTTPヘッダ専用）。
  - 代替: JSフレームバスター。`<head>` 冒頭で
    ```html
    <style id="anti-clickjack">html{display:none}</style>
    <script>if (self === top) { /* unhide */ } else { top.location = self.location; }</script>
    ```
    で、フレーム内なら表示せずトップへ遷移させる。
- **CSP の `frame-ancestors`** も meta 配信では無視される（クリックジャッキング対策は上記JSで代替）。
- それ以外の CSP ディレクティブ（`script-src` 等）は meta でも有効。本サイトは index/admin に CSP meta を設定済み。
- **クライアントサイド認証は実現不可**。`sessionStorage`/`localStorage` チェックは DevTools で自明にバイパス可能。ソース内のパスワードハッシュも丸見え。→ 守れないものは公開しない（[[0002-admin-client-auth-unpublish]]）。

## XSS ハードニングのハマりどころ（このリポジトリ固有）
- `assets/js/app.js` の `escHtml`（around L346）は**深くネストしたスコープ**にあり、スポーツ描画など別スコープの関数からは**参照できない**。そのためスポーツ系の `innerHTML` 描画はエスケープが抜けていた。
  - 対処: 該当関数内にローカルな `esc` を定義し、外部API由来文字列（チーム名・球場名・スコア・ロゴURL）をすべて通す。URLは `^https?://` のみ許可してフォールバック。
- 順位表・天気・電車遅延・ブログは `createElement`+`textContent` か `escHtml` で既に安全だった。新規描画コードを足す時は「そのスコープから escHtml が見えるか」を必ず確認する。

## 既に良くできている点（再発明しない）
- `app.js` は `defer` + `IntersectionObserver` + `requestIdleCallback` でセクションを遅延初期化済み。
- 画像は lazy + width/height 指定、フォントは `media=print`→`onload` の非同期swap。
- ナビは横スクロール + 両端 `mask-image` フェードでモバイル手がかり済み。
