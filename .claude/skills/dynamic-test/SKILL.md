---
name: dynamic-test
description: HTMLファイルをPlaywright（ヘッドレスChromium）で実際に起動し、JSランタイムエラー・404アセット・Canvas描画・スクリーンショットを検証する動的テスト。「動作確認して」「テストして」「動くか見て」という依頼、コミット前の変更HTML検証、dynamic-testerエージェントの手動実行に使用する。
---

# /dynamic-test — HTML動的テスト実行

既存の `dynamic-test-auto.cjs`（リポジトリ直下）をラップし、単一/複数HTMLの動作検証を1コマンドで行う。dynamic-tester エージェントの検証実体と同じ仕組み。

## 使い方

```bash
# 指定ファイルをテスト
bash .claude/skills/dynamic-test/run.sh zelda_like.html shogi.html

# git diff HEAD から変更されたHTMLを自動検出してテスト
bash .claude/skills/dynamic-test/run.sh --changed
```

前提: `npm install`（playwright、初回のみ）。終了コード: 全PASS=0 / いずれかFAIL=1。

## 結果の読み方

| フィールド | FAIL条件 | 意味 |
|---|---|---|
| `jsErrors` | 1件以上 | console.error / pageerror（ランタイム例外） |
| `notFound` | 1件以上 | 404になったアセット参照 |
| `canvasResult.hasDrawing` | `false` | canvasは存在するが**何も描画されていない**（初期化失敗の典型） |
| `bodyEmpty` | `true` | bodyが空（ロード失敗） |
| `screenshotPath` | — | `test-screenshots/` に保存。目視確認に使う |

- `hasDrawing: null`（getImageData失敗）はCORS等の環境要因。FAILにはしないがスクショで目視確認する。典型原因は **`file://` 配信で画像を描画したcanvasのtaint**（オリジン不一致扱いで `getImageData` が例外）。ピクセル検証が必要な場合は `python3 -m http.server` 等のHTTP配信で開くか、スクリーンショット比較で代替する。
- canvasが無いページ（ツール系HTML）は `hasCanvas: false` でスキップ扱い（FAILではない）。

## FAIL時の差し戻しフォーマット（→ code-generator）

```
[dynamic-test FAIL] <ファイル名>
- jsErrors: <エラーメッセージ（先頭1〜3件）>
- notFound: <404 URL>
- 再現: bash .claude/skills/dynamic-test/run.sh <ファイル名>
- スクショ: <screenshotPath>
修正後、同コマンドでPASSを確認してから再提出すること。
```

## 注意
- **FAILが出たら「変更前も同じか」を先に確認する（回帰判定はベースライン比較で行う）**: このテストは絶対評価なので、既存の環境要因（`file://` のcanvas taint・`ERR_CONNECTION_RESET`・canvas未描画）を変更由来のFAILと取り違えやすい。手戻りを避けるため、FAILを差し戻す前に `git worktree add /tmp/base HEAD` でベースラインを立て、**HTTP配信**（両方を別ポートで `http.server` 相当に載せる）で before/after の jsErrors・404・canvas状態を突き合わせること。2026-07-28 のアセット軽量化では、`file://` で3ページがFAILしたがHTTP比較では前後とも0エラーで、**すべて環境要因の偽FAIL**だった。
- 画質・見た目の回帰は before/after のスクリーンショットを画素差分（RMSE・差分>30の画素割合）で数値化して判定する。ただしパーティクル等のアニメーション背景があるページは無変更でも差分が出るため、数値だけで判断せず該当領域を等倍で目視確認すること。
- `file://` で開くため、`fetch()` 依存の外部API部分はエラーになり得る（本番のみ動く箇所は jsErrors の内容で判断する）
- スクリーンショットは `test-screenshots/` に溜まる。コミットに含めない
- ヘッドレスでは `confirm()`/`alert()` が**自動キャンセル**される。確認ダイアログを通る正常系（保存/削除等）を検証するときは `page.on('dialog', d => d.accept())` を入れないと正常系がFAILに見える（誤検知の実例あり）
- スクリーンショットは直前のタブ操作の**スクロール位置を引き継ぐ**。撮影前に `window.scrollTo(0,0)` を挟むこと
- ヘッドレスでは **requestAnimationFrame が絞られる**ことがあり、シーン切替後もスクショが古いフレームのままになる。撮影前に描画メソッド（例: `sc.draw(game.ctx, game)`）を明示呼びする。シーン制ゲームは page.evaluate から状態ファクトリ＋シーン遷移を直接叩けばUI操作なしで任意シーンを検証できる（詳細: dynamic-tester エージェント定義の注意事項）
