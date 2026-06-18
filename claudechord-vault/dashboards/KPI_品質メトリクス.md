---
type: ダッシュボード
agent: pmo
updated: 2026-06-18
tags: [claudechord, pmo, kpi]
---

# 📊 KPI 品質メトリクス

> CLAUDE.md の PMO KPI（**evaluator 合格率・平均修正回数・ベロシティ**）を自動集計。
> Dataview の「Enable JavaScript Queries」を ON にしてください。

## サマリー（合格率・平均修正回数・平均点）

```dataviewjs
const pages = dv.pages('"claudechord-vault/deliverables"')
  .where(p => p.type === "評価レポート");
const total = pages.length;
const passed = pages.where(p => p.verdict === "合格").length;
const passRate = total ? Math.round((passed / total) * 1000) / 10 : 0;
const avgRev = total ? Math.round((dv.array(pages.revision_count).reduce((a,b)=>a+(b||0),0) / total) * 10) / 10 : 0;
const avgScore = total ? Math.round((dv.array(pages.eval_score).reduce((a,b)=>a+(b||0),0) / total) * 10) / 10 : 0;
dv.table(["指標", "値"], [
  ["評価レポート件数", total],
  ["合格件数", passed],
  ["合格率", passRate + " %"],
  ["平均修正回数", avgRev + " 回"],
  ["平均総合点", avgScore + " 点"],
]);
```

## プロジェクト別 合格率・平均点

```dataviewjs
const pages = dv.pages('"claudechord-vault/deliverables"')
  .where(p => p.type === "評価レポート")
  .groupBy(p => p.project);
const rows = pages.map(g => {
  const n = g.rows.length;
  const pass = g.rows.where(p => p.verdict === "合格").length;
  const avg = Math.round((dv.array(g.rows.eval_score).reduce((a,b)=>a+(b||0),0)/n)*10)/10;
  return [g.key, n, pass, (Math.round((pass/n)*1000)/10) + " %", avg];
});
dv.table(["プロジェクト", "件数", "合格", "合格率", "平均点"], rows);
```

## 評価レポート明細（修正回数の推移）

```dataview
TABLE project AS "PJ", revision_count AS "回", eval_score AS "総合", spec_score AS "仕様適合", verdict AS "判定", updated AS "更新"
FROM "claudechord-vault/deliverables"
WHERE type = "評価レポート"
SORT project ASC, revision_count ASC
```

## ベロシティ（完了プロジェクト数 / 月）

```dataviewjs
const done = dv.pages('"claudechord-vault/projects"')
  .where(p => p.type === "プロジェクト" && p.status === "完了");
const byMonth = {};
for (const p of done) {
  const d = p.updated ?? p.start;
  if (!d) continue;
  const key = d.toFormat ? d.toFormat("yyyy-MM") : String(d).slice(0,7);
  byMonth[key] = (byMonth[key] || 0) + 1;
}
const rows = Object.keys(byMonth).sort().map(k => [k, byMonth[k]]);
dv.table(["月", "完了プロジェクト数"], rows.length ? rows : [["—", 0]]);
```
