---
name: a11y-audit
description: アクセシビリティ監査。img alt・lang属性・aria・prefers-reduced-motion・キーボード操作性を静的検査し、Canvasゲーム固有のa11y指針（キーボード必須・一時停止・コントラスト）で是正する。「アクセシビリティ対応して」「a11yチェックして」という依頼や、新規ページ/ゲームの公開前に使用する。
---

# /a11y-audit — アクセシビリティ監査

## 使い方

```bash
bash .claude/skills/a11y-audit/a11y-audit.sh            # 全HTML
bash .claude/skills/a11y-audit/a11y-audit.sh zelda_like.html  # 指定ファイル
```

終了コード: 問題なし=0 / 問題あり=1。検査項目（静的）:
- `<html lang="...">` の有無
- `alt` 属性のない `<img>`
- `<canvas>` に `role` / `aria-label` / フォールバックテキストが無い
- `prefers-reduced-motion` への言及が無い（アニメーション/パーティクル持ちページで推奨）
- `<title>` の有無

## Canvasゲーム固有の指針（機械検査できない部分・実装時に守る）

1. **キーボードだけで一通り遊べること**（矢印/WASD＋Enter/Space。マウス専用にしない）
2. **一時停止を必ず提供**（Escキー推奨）。点滅・高速フラッシュ演出は避ける（光感受性）
3. **コントラスト**: ダーク背景上のテキストは4.5:1以上。シアン `#00e5ff` / パープル系アクセントは黒背景で十分だが、**グレー文字（#666以下）を本文に使わない**
4. `<canvas>` には `role="img"` と `aria-label="ゲーム名（遊び方の一言）"`、タグ内にフォールバック文を書く:
   ```html
   <canvas role="img" aria-label="ZELDA QUEST — 矢印キーで移動するトップビューRPG">
     このゲームはCanvas対応ブラウザが必要です。
   </canvas>
   ```
5. スコア等の動的な重要情報は canvas 外の DOM（`aria-live="polite"`）にも反映すると読み上げ対応になる
6. `prefers-reduced-motion: reduce` ではパーティクル背景を停止または大幅減速する（design スキルのパーティクル実装に追加する）:
   ```js
   const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
   ```

## 運用
- index.html には「本文へスキップ」リンク実装済み（2026-06-28）。新規ポータル系ページにも同パターンを踏襲する
- 是正は既存ビジュアルを壊さない範囲で行う（design スキル準拠）
