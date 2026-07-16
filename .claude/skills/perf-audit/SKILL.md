---
name: perf-audit
description: パフォーマンスの実測。ページ重量（HTML＋参照ローカルアセット合計）の計測・大容量ファイル検出をスクリプトで行い、FPS計測スニペットとPlaywrightメトリクス取得手順を提供する。「重い」「遅い」「パフォーマンス測って」「FPSを確認して」という依頼に使用する。最適化の"手法"は coding スキル、"実測"は本スキルが担当。
---

# /perf-audit — パフォーマンス実測

## 使い方

```bash
bash .claude/skills/perf-audit/perf-audit.sh            # 全HTMLのページ重量レポート
bash .claude/skills/perf-audit/perf-audit.sh zelda_like.html  # 指定ファイル
```

終了コード: 閾値内=0 / 超過あり=1。閾値: ページ重量合計 **1MB**（警告 500KB）。
ページ重量 = HTML自身 + `src`/`href` で参照しているローカルアセット（画像/JS/CSS/JSON/音声）の合計。

## FPS計測スニペット（ゲームに一時挿入して実測）

```js
// ゲームループの近くに挿入 → コンソールに5秒ごとの平均FPSを出す。計測後は削除する
(() => {
  let frames = 0, last = performance.now();
  const tick = () => {
    frames++;
    const now = performance.now();
    if (now - last >= 5000) {
      console.log(`FPS: ${(frames / ((now - last) / 1000)).toFixed(1)}`);
      frames = 0; last = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
```

- 60fps を維持できない場合の対処は coding スキル（オブジェクトプール・ダーティレクト・オフスクリーンCanvas・静的レイヤーキャッシュ）を参照

## 描画コストの切り分け（attribution）— どこが重いかを当てずっぽうにしない

FPSが低いと分かったら、最適化の前に**どの描画が支配的か**を計測で特定する（戦国の野望で実証済みの手法）:

1. **シーン単位の実測**: Playwright の `page.evaluate` で `scene.draw` をラップして呼び出し回数/時間を数え、シーンごとのFPSを取る（Title/Map/Battle等で大きく異なる）。
2. **サブ描画のスタブ切り分け**: 疑わしいサブ描画メソッド（`_drawCastleLayer` 等）を一時的に空関数へ差し替えてFPS差分を取り、フレームコストへの寄与度を1つずつ確定する。除外時に最も改善する層が主犯。
3. 主犯確定後に coding スキルの手法（メモ化/オフスクリーン合成）を適用し、**同条件で再計測**して倍率を記録する。ズーム倍率など描画条件でボトルネックが変わるため、複数条件（低倍/高倍・疎/密）でスイープする。
4. **主犯を1つ除去するたびにattributionを取り直す**こと。各サブ描画の寄与は非加算的で、支配的な主犯の陰に隠れて過小評価されていた第2・第3のコストが、除去後に主犯として浮上する（戦国の野望Cycle8で実証: 家紋キャッシュ後にアイコン・ラベルが各+5fps級で浮上）。初回計測の寄与度リストを最後まで信用しない。

**計測のぶれ**: ヘッドレス（ソフトウェアレンダリング）のFPSは±数fpsぶれる。1回の計測値で改善/回帰を判定せず、**複数回実行の傾向**で判定すること。

## Playwright でのメトリクス取得（ロード性能）

```js
// node で実行（node_modules/playwright 前提）。DOMContentLoaded/Load時刻とJSヒープを取る
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + process.cwd() + '/zelda_like.html');
  const t = await p.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return { domContentLoaded: n.domContentLoadedEventEnd, load: n.loadEventEnd,
             jsHeapMB: performance.memory ? (performance.memory.usedJSHeapSize/1048576).toFixed(1) : null };
  });
  console.log(t); await b.close();
})();
```

## 判断基準
- ページ重量 1MB 超 → /asset-optimize で削減（画像圧縮・分割ロード）
- FPS 55 未満 → coding スキルの最適化手法を適用し、再計測して差分を確認
- `blogs.json`（2.7MB）のような大容量データは初期ロードで読まない（遅延fetch・ページング）
