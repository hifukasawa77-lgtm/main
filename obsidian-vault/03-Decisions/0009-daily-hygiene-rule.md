---
type: decision
date: 2026-07-01
status: accepted
tags: [decision, second-brain, self-improve]
related: ["[[harness-maintenance-patterns]]", "[[0003-recursive-self-improvement-loop]]"]
---

# 0009 Daily圧縮ルールを second-brain スキルの書式ルールへ昇格

## 背景・問題
recall hook（`second-brain-recall.sh`）は直近のDaily Noteを**全文**コンテキストへ投入する。2026-06-30は同日9セッション分の追記でDailyが肥大化し、7thセッションで手作業の圧縮（1行サマリー＋リンク化）を行った。この教訓は [[harness-maintenance-patterns]] に蓄積済みだが、蓄積側の運用ルール（`second-brain/SKILL.md`）には未反映で、次に同日複数セッションが発生すれば再発する状態だった。

## 決定
`second-brain/SKILL.md` の「書式ルール」に追記:
- Dailyは肥大化させない。再利用可能な学びは `04-Knowledge/` へ昇格し、同日の過去セッション分は「1行サマリー＋ADR/知見ノートへのwikilink」に圧縮する。

あわせて同セッションで以下も反映:
- `/self-improve` 手順0にbash罠（サブシェルフラグ非伝播・自己誤検出）の追記注意を1行追加
- `/self-improve` 手順0の検査一覧に、9thで実装済みだが文書未更新だった検査#5（具体値ドリフト）を追記（ドキュメントドリフト是正）
- [[harness-maintenance-patterns]] に昇格済みフッターを追加（二重昇格防止）

## 理由
- 「同種の手作業（Daily圧縮）が再発する＝ルール化されていない証拠」であり、/self-improve の最優先昇格基準に該当。
- 宛先は最も狭く効く場所＝蓄積を担う second-brain スキル。CLAUDE.md には書かない（肥大化防止）。
- hookでの機械強制（行数チェック等）は、圧縮は文脈判断を要するため見送り。運用ルールとしての昇格が適切。

## 影響・トレードオフ
- 追加型・振る舞いは「同日複数セッション時のDaily追記の仕方」のみ変わる（全文追記→圧縮追記）。
- 過去ログの詳細はADR/知見ノート側へ退避されるため、Dailyだけ読んでも当日の詳細は追えない（リンクを辿る前提）。
