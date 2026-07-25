---
type: decision
date: 2026-07-25
status: accepted
tags: [decision, self-improve, routine, lint, drift]
related: ["[[recursive-self-improvement]]", "[[guide-agent-evolution]]", "[[0008-value-drift-lint]]", "[[harness-maintenance-patterns]]"]
---

# 0021 Routineスケジュールの正をCLAUDE.mdへ単一ソース化＋検査#11・週次/self-improve化

## 背景・問題

`/self-improve` 16th の続きとして、lintでは拾えない領域（`04-Knowledge/` と `02-Projects/`）を点検した際に、**実態と文書の1週間放置ドリフト**が見つかった。

2026-07-18 に深澤の要望で `/agent-evolve` の Routine を**日次→週次（毎週木曜 05:00 JST, cron `0 20 * * 3`）**へ変更したが、変更されたのは Routine の実態と当日の Daily だけで、以下がすべて「毎日 05:00 JST」のまま残っていた。

- `CLAUDE.md` — 「**日々自己進化**: Routine（毎日 05:00 JST）」
- `.claude/skills/agent-evolve/SKILL.md` — description・見出し・「毎日少しずつ改善」・PRタイトル「日次改善」・運用メモの起動時刻（計6箇所）
- `obsidian-vault/02-Projects/guide-agent-evolution.md` — 「日次進化: Routine（毎日05:00 JST）」

これは 07-01 に昇格済みの「仕組みを増やしたら説明文書まで更新対象」という教訓が**適用されなかった**ケースであり、かつ harness-lint 検査#5（具体値ドリフト）が予算・閾値・ブランチ名しか見ておらず**スケジュールという具体値が無防備**だったために1週間検知されなかった。

## 決定

1. **CLAUDE.md に「定期実行（Routine）一覧」表を新設し、スケジュールの正の単一ソースとする**。`/agent-evolve`（毎週木曜05:00）・`/site-proposal`（毎週月曜07:00）・`/self-improve`（毎週日曜21:00）の3本を、スケジュール／成果物／mainへの直接push可否とあわせて1箇所に集約した。表の直上に「Routineを新設・変更・停止したら表と該当スキルを同時に更新する」という運用ルールを明記。
2. **上記ドリフトを全箇所是正**（CLAUDE.md 1箇所／agent-evolve SKILL.md 8箇所／プロジェクトノート1箇所）。あわせて週次化に伴い「1日の改善は最大3件」→「1回の改善は最大3件」等の頻度前提の表現も揃えた。
3. **harness-lint 検査#11 を追加** — CLAUDE.md の表を正とし、各スキル `SKILL.md` の曜日・時刻が一致するかを機械照合する（スキル側に記載が無い場合は「表が単一ソース」として ✓）。
4. **`/self-improve` を週次 Routine 化**（毎週日曜 21:00 JST, `0 12 * * 0`, trigger `trig_01DuSy2rzQfPUcizikGGYJJg`）。固定ブランチ `claude/self-improve` のローリングPR方式・main直接push禁止・既存ルールの変更は提案止まり、という制約を prompt に明記した。

## 理由

- **Routineの実態はAPI側にあり、CI/lintからは読めない**。したがって「実態 vs 文書」の完全な機械検証は不可能で、現実的に防げるのは「片方だけ更新した」内部ドリフトである。表を単一ソース化しておけば、次回以降は**表を直せば検査#11が残りの不整合を指摘する**構図になり、更新漏れの被害が1箇所で止まる。
- 週次 `/self-improve` は、16th で見つけた「7営業日の記録空白」への構造的な回答でもある。lint 検査#9 は直近14日しか遡らないため、**2週間に1回以上 `/self-improve` が回らないと作業日の記録漏れが恒久的に取りこぼされる**。週次なら常に検知圏内に入る。
- 検査#11 の初回実装は `[月火水木金土日]` という多バイトブラケット表現を使い、C locale（`LANG` 未設定）で全行が空振りした。ロケール非依存の `毎週[^ ]*曜` へ修正し、この罠を [[harness-maintenance-patterns]] の「bash 検査スクリプトの罠」へ追記した。

## 影響・トレードオフ

- CLAUDE.md に表が1つ増えるが、既存2行の説明を置き換える形なので実質的な肥大化は小さく、スケジュールの参照先が一意になる利点が上回る。
- 週次 `/self-improve` Routine は自動でPRを積むため、深澤のレビュー負荷が週1件増える。ただし「昇格すべき学びが無い週は変更しない」と prompt で明示しており、空回りのPRは出ない設計。追加課金は発生しない。
- Routine作成時のツール警告により、fired session に MCP コネクタが引き継がれない可能性がある。PR作成が不可の場合はブランチpushまでで正常終了する fallback を prompt に入れたため、成果が失われることはない（**初回firing 2026-07-26 21:00 JST の結果で要確認**）。
- 検査#11 が防げるのは内部ドリフトのみ。Routine の実態変更そのものを検知する手段は無く、「変更したら表を直す」という運用ルールに依存する点は残課題。

## 追記（2026-07-25 続き2）: 罠の横串展開とCI監視パスの是正

- C locale罠を `.claude/` `scripts/` `.github/` の27ファイルへ横串展開して走査 → シェル側の潜在インスタンスはゼロを確認（JSはRegExpがUTF-16認識のため対象外）。再発防止として **harness-lint 検査#12**（シェル検査の多バイトブラケット表現を✗検出）を追加し、負のテストで検出可能なことを確認した。
- **CI監視パスの穴を是正**: `harness-lint.yml` は `.claude/**` のみを監視していたため、検査#4/#5/#11の正である `CLAUDE.md`、検査#5の正である `accounting/budget.md`、検査#10の対象である `assets/js/agent-data.js` を単独変更してもCIが起動しなかった。**本ADRでRoutine表をCLAUDE.mdへ単一ソース化したことで、この穴が実害に直結する状態になっていた**ため同時に是正。`obsidian-vault/**` は検査#8/#9が非ブロッキング（警告のみ）のため意図的に除外した。
- 派生した一般則2件: ①「正の単一ソース化」とCIの監視パスはセットで設計する（正を移したら監視パスを追随させる）②検査ロジックのバグは✗ではなく**偽の✓**として現れるため、新しい検査には必ず負のテストを行う。
