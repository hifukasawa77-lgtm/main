---
type: decision
date: 2026-11-22
tags: [adr, self-improve]
related: [[recursive-self-improvement]]
---

# 0044. /self-improve 9回目（2026-11-22）の昇格

## 背景
週次`/self-improve`の9回目。`origin/main`との差分が149コミットと過去最大で、Dailyノート10件が
同日衝突（add/add・内容衝突）した。解消の過程で以下を発見・対応した。

## 決定1: git一時パックファイルの肥大化をharness-lint検査#16として機械化
`.git/objects/pack/tmp_pack_*`の肥大化（git fetchの中断で残るgarbage）が、2026-11-01（27GB）・
2026-11-22（15.5GB）と3週間を空けて**2回再発**した。1回目はCLAUDE.mdへ手順を書くだけで対応したが、
文書化だけでは気づかれず再発した。self-improveの判断基準（再発・反復しているテーマは最優先の
昇格候補）に従い、`.claude/skills/self-improve/harness-lint.sh`へ検査#16（500MB以上で△警告）を追加。
故障注入（600MBのダミーファイルを作成→△確認→削除→✓復帰）で確認済み。

## 決定2: CLAUDE.mdの事実ドリフト2件を修正
- 「定期実行（Routine）一覧」表の`/agent-evolve`成果物欄が`claude/agent-evolve-2026-10-14`・PR #411
  を指していたが、PR #411は2026-11-18にマージ済みで、新しい書き込み先`claude/agent-evolve-2026-11-18`・
  PR #439へ切り替わっていた（表の更新忘れ＝検査#15/#11の対象パターンそのもの）
- トップページ節の「訪問数カードはこの端末の回数のみ」の記載が、2026-11-18〜19の実装変更
  （PR #440・Cloudflare WorkerのDurable Objectによるサイト全体集計化）で事実として古くなっていた

いずれも深澤の判断を変える「ルール変更」ではなく、実装に追随していなかった**事実の記載**の訂正のため、
AskUserQuestionでの確認は不要と判断し直接修正した。

## 検討したが見送り
- `/agent-evolve`の3週連続の申し送り（`agent-evolve-check.mjs`へのリンク切れチェック恒久組み込み）は
  `/agent-evolve`自身のツール整備バックログであり、self-improveが昇格すべき「ハーネス横断の一般則」
  ではないと判断し見送った（担当スキル側の判断に委ねる）

## 関連
- [[0040-self-improve-2026-10-25-promotions]] — tmp_pack_*の1回目の発生と対応
- `obsidian-vault/01-Daily/2026-11-22.md`
