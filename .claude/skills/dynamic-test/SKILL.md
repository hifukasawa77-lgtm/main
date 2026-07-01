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

- `hasDrawing: null`（getImageData失敗）はCORS等の環境要因。FAILにはしないがスクショで目視確認する。
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
- `file://` で開くため、`fetch()` 依存の外部API部分はエラーになり得る（本番のみ動く箇所は jsErrors の内容で判断する）
- スクリーンショットは `test-screenshots/` に溜まる。コミットに含めない
