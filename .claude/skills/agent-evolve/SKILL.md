---
name: agent-evolve
description: hideの案内エージェント（サイト内チャットウィジェット）の週次自己進化。worker の /stats から訪問者の質問傾向・👎の多い質問を収集し、agent-data.js（intent辞書/KB/GAMES）と data/agent-news.json への小さな改善を積み、テスト合格後にローリングPRへ積んで深澤の承認を待つ。毎週のRoutineから起動されるほか、「エージェントを進化させて」「エージェントを賢くして」という依頼で使用する。
---

# /agent-evolve — 案内エージェントの週次自己進化

サイト訪問者との対話データ（共有学習メモリの集計）から弱点を発見し、案内エージェントの
知識・辞書を毎週少しずつ改善する。**変更は必ずPR経由**（深澤の承認でマージ・公開）。

## 大原則

1. **編集対象はデータのみ**: `assets/js/agent-data.js`・`data/agent-news.json` に限定する。
   `assets/js/agent.js`（ロジック）や worker の変更が必要だと判断した場合は、**編集せず**
   PR本文の「提案」欄に書くだけにする。
2. **1回の改善は最大3件**。小さく・確実に。迷ったら見送って提案欄へ。
3. **mainへ直接pushしない**。固定ブランチ `claude/agent-evolve` のローリングPRに積む。
4. 追加課金ゼロ厳守（有料API・有料サービスの使用禁止）。

## 手順

### 0. 準備
```bash
git fetch origin main
# 既存の claude/agent-evolve ブランチ（open PR）があればそれに積む。なければ main から作る
git checkout claude/agent-evolve 2>/dev/null && git merge --ff-only origin/main || git checkout -B claude/agent-evolve origin/main
```
open PR の有無は `mcp__github__list_pull_requests`（head: `claude/agent-evolve`, state: open）で確認する。

### 1. 弱点収集
```bash
curl -s -m 30 https://ai-proxy.hi-fukasawa77.workers.dev/stats
```
- `negatives`（👎が積み重なった質問）＝ intent辞書・KBの穴の候補。
- `topHits` ＝ よく聞かれる話題。KB化するとAI消費ゼロで即答できる。
- `/stats` が落ちていても中断しない（後続の整合チェックと鮮度改善だけで続行）。
- **「到達不可」と「worker停止」を切り分ける**: `curl` の終了コード非ゼロ／`http_code=000` は worker の障害ではなく**実行環境から外向き通信が許可されていない**サイン。この場合はいくら待っても入力が空のままなので、PR本文の提案欄に「Routine実行環境の外向き許可（worker ドメイン）が必要」と明記して深澤へ上げる（自己進化の入力が恒久的にゼロになるため、鮮度改善だけの空回りを繰り返さない）。切り分けは `curl -s -o /dev/null -w '%{http_code}' -m 30 <url>/stats` で行う。

### 2. 整合チェック
```bash
node scripts/agent-evolve-check.mjs
```
✗ が出たらその修正を最優先の改善とする（期限切れnewsの削除など△も対応してよい）。

### 3. 改善の実施（最大3件）
優先順位:
1. 整合チェックの ✗/△ 修正
2. `negatives` に対応する intent キーワード追加 or KB 追記（日英両方を必ず更新）
3. `topHits` の頻出話題の KB 化・チップ改善
4. サイトの変化（新ゲーム追加等）を `data/agent-news.json` へ告知として追加
   - 形式: `{ "id": "YYYY-MM-DD-slug", "date": "YYYY-MM-DD", "ja": "...", "en": "...", "href": "任意", "expires": "任意ISO日付" }`
   - 古い告知（30日超 or 期限切れ）は削除する

改善のネタが本当に無い回は**無理に変更しない**（コミットなしで終了してよい。その場合も4は実行）。

**intent キーワードを足すときの必須注意**（実際に「おすすめのカツ丼ありますか？」へゲーム3枚を返した事故あり）:
- `detectIntent` はキーワードの重み合計だけで intent を決める。**「おすすめ」「無料」「やり方」「もっと」のように
  それ自体が話題を持たない語**は、どんな話題の文にも出てくるため、重みだけで閾値を超える設計だと
  サイトと無関係な質問で確実に暴発する。この種の汎用語には**高い重みを与えない**こと
  （`TOPIC_GENERIC_INTENTS` の話題ガードが `agent.js` にあり、サイト語彙に無い内容語が1つでもあれば
  AI自由回答へ回す。ガードを迂回するほどの重みを新規キーワードに与えない）
- 逆に「三郷」「株価」「将棋」のように**語そのものが話題を名指しする**intentは裏付け不要。強い重みでよい
- サイトが扱う**話題そのものを増やした**ときだけ `SITE_TOPIC_WORDS` への追加を検討する
  （ゲーム語彙は `agent-data.js` から自動構築されるのでゲーム追加時のメンテは不要）
- 検査は**「弾く例」と「弾かない例」を両建て**で足す。ガードを強くしすぎると正常な質問までAIに流れて
  カードUIが消えるが、これは例外もFAILも出さずに機能低下する（初版は実フレーズ22件中6件を過剰ブロックしていた）

### 4. 検証
```bash
node scripts/agent-evolve-check.mjs        # 整合
node scripts/gen-agent-knowledge.mjs       # worker知識の再生成（agent-data.jsを触った場合）
node scripts/agent-dynamic-test.cjs        # 動的テスト全6シナリオ
bash .claude/skills/release-check/release-check.sh
```
FAILがある状態でコミット・プッシュしてはならない。

### 5. コミット・PR
```bash
git add assets/js/agent-data.js data/agent-news.json cloudflare-worker/site-knowledge.js
git commit -m "agent-evolve: <改善の要約>"
git push -u origin claude/agent-evolve
```
- open PR がなければ `mcp__github__create_pull_request` で作成（base: main、タイトル「🤖 agent-evolve: 案内エージェントの週次改善」）。
- PR本文には毎回追記する: 日付・/statsの要約（total/avgScore/negatives件数）・実施した改善・**提案欄**（ロジック変更が必要と判断した事項）。
- あればそのPRに追加コミットするだけでよい（ローリングPR方式・PR乱立防止）。
- **GitHub MCPツールが使えないセッションの場合**: ブランチのプッシュまでで終了してよい
  （変更はブランチに永続化される。PR起票は翌回または深澤が手動で行う。その旨をDailyに記す）。

### 6. 記録
`obsidian-vault/01-Daily/YYYY-MM-DD.md` に実施内容と学びを1〜3行で記録する
（second-brain スキルの書式に従う。プロジェクトノートは `02-Projects/guide-agent-evolution.md`）。

## 運用メモ

- この仕組みは Claude Code Remote の Routine（毎週木曜 05:00 JST）から新セッションで起動される。
- 2週間安定運用できたら「データファイルのみ・全テスト合格時の auto-merge」への移行を深澤へ提案してよい（勝手に移行しない）。
- 案内エージェントの実装全体像: データ=`assets/js/agent-data.js` / ロジック=`assets/js/agent.js` /
  AI=`cloudflare-worker/gemini-proxy.js`（SYSTEM_PROMPTは `site-knowledge.js` 自動生成）。
