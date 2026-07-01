---
name: deploy-verify
description: GitHub Pages デプロイ後の本番検証。公開URLのHTTPステータス・キャッシュ状態をcurlで確認し、Playwrightで本番スモークテスト（pageerror検知）を行う。「デプロイされたか確認して」「本番で動くか見て」「公開ページをチェックして」という依頼、push後の反映確認に使用する。
---

# /deploy-verify — デプロイ後の本番検証

本番URL: `https://hifukasawa77-lgtm.github.io/main/`

## 使い方

```bash
# ステータス確認のみ（デフォルト: index.html zelda_like.html shogi.html）
bash .claude/skills/deploy-verify/deploy-verify.sh

# ページ指定＋Playwrightスモーク（実ブラウザでpageerror検知）
bash .claude/skills/deploy-verify/deploy-verify.sh --smoke zelda_like.html shogi.html
```

終了コード: 全OK=0 / NG（非200・pageerror）あり=1。

## GitHub Pages の反映タイミング

- push → Pages反映は通常 **1〜3分**（最大10分）。404や旧内容が返る場合はまず時間を置く
- 反映確認は `curl -sI <URL>` の応答ヘッダを見る（このスクリプトが表示）。ブラウザ確認時は**強制リロード**（Ctrl+Shift+R）でキャッシュを飛ばす
- `sw.js`（Service Worker, network-first）がキャッシュを持つため、SW配下のページはSW更新（`sw.js` のバージョン文字列変更）も必要になることがある
- それでも旧内容の場合: GitHub リポジトリの Actions/Pages のビルド状況を確認する

## 運用
- push後の定型フロー: 2〜3分待つ → `deploy-verify.sh --smoke <変更ページ>` → OKなら深澤へ報告
- 新規ページはURLエンコード注意（日本語ディレクトリ名は `%E6%B5%AE...` のようにエンコードされる。index.html内の既存リンクの書式に合わせる）
