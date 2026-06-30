---
type: decision
date: 2026-06-30
status: accepted
tags: [decision, agents, design]
related: ["[[claude-md-project-rules]]", "[[recursive-self-improvement]]"]
---

# 0004: code-generator のカラースキーム指定を CLAUDE.md に整合させる

## 背景・問題
`/self-improve` の振り返りで、`.claude/agents/code-generator.md:47` のカラースキーム指定が CLAUDE.md と矛盾していることを発見した。
- code-generator.md: 「黒背景 + **ネオン**シアン(#00ffff) / **マゼンタ(#ff00ff)** / パープル(#9d00ff)」
- CLAUDE.md: 「黒背景 + シアン/パープル系アクセント」「**サイバーパンク的演出（ネオングロウ過多・SF都市風）は禁止**」

エージェント定義が中核ルール（CLAUDE.md）と矛盾しており、このままだと code-generator がCLAUDE.md違反（マゼンタ/原色ネオン）の出力を生む恐れがあった。

## 決定
code-generator.md:47 を CLAUDE.md 準拠に修正：「黒背景 + シアン/パープル系アクセント。サイバーパンク的演出（ネオングロウ過多・マゼンタ等の原色ネオン・SF都市風）は禁止」。具体カラーコードは CLAUDE.md を唯一の正とし、エージェント定義側に重複記述しない（ドリフト再発防止）。

## 理由
- CLAUDE.md はプロジェクトの最上位ルールであり、エージェント定義はそれに従属する。矛盾は定義側の誤り。
- 同じカラーコードを2箇所に書くと再びドリフトする。正は1箇所（CLAUDE.md）に集約する。

## 影響・トレードオフ
- code-generator は今後マゼンタ/原色ネオンを提案しなくなる。ゲーム系で意図的に原色ネオンを使いたい場合は、その都度CLAUDE.mdのデザインルール側で例外を定義する運用とする。
- 他のエージェント定義にも同種のドリフトがないか点検する。

## 追記（2026-06-30 ハーネス整合性監査）
- 全16エージェント定義 × CLAUDE.md を横断点検した結果、**`planner.md:47` に同一の色ドリフト**（「ネオンシアン / マゼンタ / パープル」）を発見し、本ADRの方針に従ってCLAUDE.md準拠へ是正した。
- その他は矛盾なし: `pmo.md`/`evaluator.md` の `kai_001` はCLAUDE.mdの作業ブランチ記載と一致、`evaluator.md` の合格基準（80点/仕様適合性16点）も一致、`achievement-agent.md` の色はバッジ生成テンプレ内のシアン/パープル系で範囲内。
