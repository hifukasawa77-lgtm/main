---
type: decision
date: 2026-07-17
status: accepted
tags: [decision, self-improve, lint, second-brain]
related: ["[[0015-unpromoted-learning-lint]]", "[[harness-maintenance-patterns]]", "[[recursive-self-improvement]]"]
---

# 0016: Dailyなしの作業日を harness-lint 検査#9 で機械検出

## 背景・問題
検査#8は「**存在するDaily**の昇格漏れ」しか見えず、**Dailyごと書かれなかった作業日**は蓄積ループから完全に漏れる。実際、2026-07-15 は大型実装5件（朝廷・幕府外交システム／未実装4画面／深部AI 4件など）がコミットされたのに Daily が1本も無く、2026-07-11 も同様だった。別ブランチで走るパイプラインセッションは Daily を書かずに終わることがあり、手動の `git log` 日付×Dailyファイル名の突き合わせでしか気づけなかった。

## 決定
1. `harness-lint.sh` に**検査#9**を追加: 直近14日の非マージコミットのうち `obsidian-vault/` 以外を変更したものを「作業」とみなし、その日付に対応する `01-Daily/YYYY-MM-DD.md` が無ければ警告する。
2. 重大度は**△（非ブロッキング）**: 記録要否の判断はLLM作業のため（[[0015-unpromoted-learning-lint]] の2段重大度原則）。古い作業日を延々警告しないよう窓を直近14日に限定。
3. 現存する警告3日分はベースライン整備: 07-11/07-15 は遡及Daily（コミットメッセージからの要約）、07-17 は当日Dailyで解消。

## 理由
- 蓄積（Daily）→想起→反映のループは**蓄積が抜けると以降すべてが動かない**。検査#8とペアで「書いたが未昇格」「そもそも書かれていない」の両側を面出しできる。
- 当日の警告は「セッション末にDailyを書く」リマインドとしてそのまま機能する。

## 影響・トレードオフ
- 実装中に新しいbash罠を発見: pipefail 下の `git show | grep -q` は grep の早期exitで左辺がSIGPIPE(141)死し、**変更ファイル数の多いコミットだけ**判定漏れする確率的バグになる。左辺を変数に受けてから grep する形で回避（[[harness-maintenance-patterns]] へ追記済み）。
- 別ブランチのパイプラインセッションが Daily を書かない構造自体は残る（メインセッションが lint 警告を見て遡及記録する運用でカバー）。
