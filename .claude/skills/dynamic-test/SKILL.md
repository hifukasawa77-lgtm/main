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
| `jsErrors` | 1件以上 | console.error / pageerror（ランタイム例外・ローカル資産の読込失敗） |
| `notFound` | 1件以上 | 404になったアセット参照 |
| `canvasResult.hasDrawing` | `false` | canvasが**全枚数・全面走査して1pxも描かれていない**（初期化失敗の典型） |
| `bodyEmpty` | `true` | bodyが空（ロード失敗） |
| `externalLoadErrors` | — | **FAILにしない**。外部オリジン（CDN・Webフォント等）の読込失敗＝実行環境のネットワーク事情 |
| `screenshotPath` | — | `test-screenshots/` に保存。目視確認に使う |

- `hasDrawing: null`（全canvasでgetImageData失敗）はFAILにしない。スクショで目視確認する。
- canvasが無いページ（ツール系HTML）は `hasCanvas: false` でスキップ扱い（FAILではない）。

### 偽のFAILを出さないための設計（2026-08-23に是正）
検査が理由なく赤いままだと、本物の不具合まで無視されるようになる。以下は**検査側の欠陥**として直した:

| 症状 | 原因 | 対処 |
|---|---|---|
| `fetch()` が必ずCORSで落ちる | `file://` で開いていた | **リポジトリ直下を一時HTTPサーバで配信**し `http://127.0.0.1:<port>/…` で開く（ポートは毎回自動割当・`favicon.ico` は204） |
| Webフォント/CDNの読込失敗でFAIL | 外部オリジンの失敗を `jsErrors` に混ぜていた | `externalLoadErrors` に分離。**ローカル資産（テストサーバのオリジン）の失敗は今までどおりFAIL** |
| パーティクル背景が「描画なし」 | 左上100×100pxしか見ていなかった | 全canvasを**全面走査**し、1枚でも描けていればPASS |
| 対象ファイルが無いのに404でFAIL | 存在確認をしていなかった | 実行前に存在チェックして明示的に落とす |

**検査を変えたら必ず故障を仕込んで✗が出ることを確かめる**（JSエラー・ローカル404・未描画canvasの3種）。
検査が緑になったこと自体を成果にしない。

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
- ローカルHTTP配信で開くため同一オリジンの `fetch()` は通る。**外部API依存の箇所**はネットワーク環境次第で落ちるが `externalLoadErrors` 側に出る（判定には使わない）
- スクリーンショットは `test-screenshots/` に溜まる。コミットに含めない
- ヘッドレスでは `confirm()`/`alert()` が**自動キャンセル**される。確認ダイアログを通る正常系（保存/削除等）を検証するときは `page.on('dialog', d => d.accept())` を入れないと正常系がFAILに見える（誤検知の実例あり）
- スクリーンショットは直前のタブ操作の**スクロール位置を引き継ぐ**。撮影前に `window.scrollTo(0,0)` を挟むこと
- ヘッドレスでは **requestAnimationFrame が絞られる**ことがあり、シーン切替後もスクショが古いフレームのままになる。撮影前に描画メソッド（例: `sc.draw(game.ctx, game)`）を明示呼びする。シーン制ゲームは page.evaluate から状態ファクトリ＋シーン遷移を直接叩けばUI操作なしで任意シーンを検証できる（詳細: dynamic-tester エージェント定義の注意事項）
