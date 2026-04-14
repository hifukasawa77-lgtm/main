# コーディングスキル集

素のHTML / CSS / JavaScript（フレームワーク不使用）環境でのコーディングガイドライン。

---

## Skill: デバッグ手順 (Debug Workflow)
- **概要**: ブラウザ開発者ツールを最大限活用し、効率よくバグを特定・修正する。
- **実装要件**:
  - `console.log` の乱用を避け、`console.table` / `console.group` / `console.time` を用途別に使い分けること。
  - Canvas / アニメーション系のバグは `requestAnimationFrame` を一時停止（フラグ制御）して静止状態で検証すること。
  - イベントリスナーのデバッグは `getEventListeners(element)` (DevTools コンソール) で登録済みリスナーを確認すること。
  - エラーは必ず `try/catch` で捕捉し、ユーザーに見えないサイレントエラーを作らないこと。

## Skill: リファクタリングパターン (Refactoring Patterns)
- **概要**: 読みやすく保守しやすいコードへ改善するための指針。
- **実装要件**:
  - 同じロジックが3箇所以上出現したら関数化する（DRY原則）。ただし1〜2箇所の重複は無理に抽象化しない。
  - グローバル変数は最小限にとどめ、関連する状態は1つのオブジェクト（例: `const state = {}`）にまとめること。
  - 副作用のない純粋関数（同じ入力→同じ出力）を優先し、DOM操作や状態変更は呼び出し元に委ねること。
  - マジックナンバーは `const CANVAS_WIDTH = 800` のように名前付き定数に置き換えること。

## Skill: パフォーマンス最適化 (Performance Optimization)
- **概要**: ゲームループや重いCanvas描画でも60fps を維持するための手法。
- **実装要件**:
  - アニメーションループは必ず `requestAnimationFrame` を使い、`setInterval` / `setTimeout` による描画ループを禁止する。
  - オブジェクト生成（`new`, 配列リテラル等）をループ内で繰り返さず、オブジェクトプールパターンを採用すること。
  - Canvas の `clearRect` は全画面クリアではなく、変化した領域のみをダーティレクト（Dirty Rect）でクリアすることを検討する。
  - 変化しない背景レイヤーはオフスクリーンCanvas（`document.createElement('canvas')`）に事前描画してキャッシュすること。
  - `ctx.save()` / `ctx.restore()` のネストは最小限にし、状態変更はまとめて行うこと。
