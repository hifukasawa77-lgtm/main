---
type: decision
tags: [decision, self-improve, bash, pr-backlog]
date: 2026-10-11
status: accepted
related: [0037-self-improve-2026-10-04-promotions, harness-maintenance-patterns]
---

# 0038: /self-improve 3回目の実運用（Routine継続確認・grep行アンカーの罠を昇格）

## 背景
前回（ADR 0036）のPR #369が、本セッション開始時点でまだ未マージのまま7日経過していた。
`claude/self-improve` ブランチは既存の未マージ内容を保ったまま、`git rebase origin/main` で
最新mainへ積み直した（main側に新しいコミットは無数にあったが、こちらは1コミットのみで衝突なし）。

## 確認したこと

### 1. Routine修正の継続確認（3週連続で検査#15が全5本✓）
前回・前々回の修正が今回も保持されていることを確認した。`claude/agent-evolve-2026-09-30`
（PR #363）・`claude/marketer-evolve`（PR #359）・`claude/note-post`（PR #360）は
いずれも新しいコミットが積まれ続けており、ローリングPR運用が正常に機能している。

### 2. 新しい学び: `grep -Eq '^pattern$'` の行アンカーは文字列全体には効かない
Worker デプロイの堅牢化作業（2026-10-11、別セッション）で、`CLOUDFLARE_ACCOUNT_ID` の
32桁16進チェックが `grep -Eq '^[0-9a-f]{32}$'` で実装されていたが、grepの `^`/`$` は
**行ごとに**当たるため、値が複数行（シークレットのコピー時に余分な改行が付く等）だと
「正しいID＋余分な行」を素通ししていた（Codexレビューで発覚・修正済み）。
文字列全体を検証したいなら bash の `[[ "$var" =~ ^pattern$ ]]` を使う必要がある。
既存の `harness-maintenance-patterns.md`「bash検査スクリプトの罠」に同系統の罠
（BRE `\+`・pipefail下のSIGPIPE・Cロケールの多バイトブラケット）が既に並んでいたため、
その並びへ追記する形で昇格した。

### 3. PRバックログの状況（再点検・新規変化なし）
PR #271/#332/#316/#347 は先週から完全に無変化（スター数・更新日時とも変わらず）。
新たにPR #401（local-agent）・#370（ZERO-1 Desktop設計ドキュメント）が積まれ、open PRは
計10本に増えた。**PR #369（本Routine自身の前回分）が7日間レビュー待ちのまま**であることも含め、
レビュー容量がボトルネックになりつつある可能性を報告する（対処は深澤の判断）。

## 決定
1. 学び1件を昇格: `harness-maintenance-patterns.md`「bash検査スクリプトの罠」へ
   grep行アンカーの罠を追記
2. PRバックログの滞留状況（変化なし＋新規2本＋自分のPRも7日待ち）を深澤へ報告

## 影響・トレードオフ
- 今回は振る舞い変更・既存ルール変更を伴わないため、AskUserQuestionでの承認は不要と判断した
  （追加型の注意書き追記のみ）
