---
type: decision
date: 2026-09-10
status: accepted
tags: [decision, verification, harness, zero-1]
related: ["[[checks-that-break-when-code-improves]]", "[[false-red-checks-are-worse-than-none]]", "[[0035-zero1-claude-md-and-behaviour-only-checks]]"]
---

# 0036 — 検査の免除は1行ずつ理由つきで。照合の線は「import して呼べるか」

## 背景

前日（[[0035-zero1-claude-md-and-behaviour-only-checks]]）に
「検査は実装の置き場所・書き方を照合しない」を一般則へ昇格した。
それでも 2026-09-10 に**同じ形で2回落ちた**（`document-text` の切り詰め／設定の保存）。

調べたところ、**その検査自体は既に存在していた**——
`tests/rendered-html.test.mjs` の「検査は app/page.tsx を名指しで読まない」。
効いていなかった理由は、免除の与え方だった:

```js
const ALLOWED = new Set(["rendered-html.test.mjs"]);   // ← ファイル単位
```

免除の理由（「行数を数える検査だけは page.tsx 自身を見る必要がある」）は正しい。
だが免除がファイル単位だったため、**違反11件がまるごとその中に在り、一度も咎められなかった**。

## 決定

1. **免除はファイル単位で与えない。1行ずつ、理由つきで与える。**
   上の検査を行単位へ作り直し（行末に `// page-self` と理由）、違反11件を
   `clientSource()` へ直した。本当に page.tsx 自身が要る1件だけ理由を書いて残した
2. **照合してよいかの線を「import して呼べるか」で引く。**
   > import して呼べるものは、必ず呼んで確かめる。
   > ソースを文字列として読んでよいのは、呼べないもの（配線・置き場所が要件のもの）だけ。
3. 還元先: `zero-1-local-ai/docs/開発の注意.md` §6 ／ `.claude/agents/verifier.md` 原則#2

## 根拠

- **偽陽性を避けようとして逃がし口を広く取ると、偽の緑になる。**
  [[false-red-checks-are-worse-than-none]] の裏返しで、検査が無いより悪い
- 「書き方を照合するな」は**どこまでが書き方か**の判断が要り、その場では守ったつもりになれる。
  落ちた6件を並べ直すと全部「ソースを文字列として読んでいた」で、
  import して呼んでいる検査は切り出しても lazy 化しても1件も落ちていない。
  **判断の要らない線**に引き直した
- 負のテストで両方向を確認した: 違反を1件足すと咎める／免除をファイル単位に戻すと素通りする

## 影響

- ZERO-1 で page.tsx を切り出しても、検査が巻き添えで落ちなくなった（14件→1件）
- ポートフォリオ側の verifier が、免除の広さを設計時に考えるようになる
- **残り**: ソースを文字列として読んでいる検査は他にも多数ある（376箇所が式を照合）。
  一度に直すと誤って壊すので、**触ったときに直す**方針とする
