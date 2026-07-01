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

- 60fps を維持できない場合の対処は coding スキル（オブジェクトプール・ダーティレクト・オフスクリーンCanvas）を参照

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
