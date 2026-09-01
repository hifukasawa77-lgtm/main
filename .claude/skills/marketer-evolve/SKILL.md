---
name: marketer-evolve
description: マーケティング活動（SNS自動投稿）の週次自己進化。過去の投稿ログ（marketing/post-log.json）から反応（いいね/リポスト/返信等）を計測し、ゲームカタログとの同期（新作の継続告知）とコア文面の改善を行い、テスト合格後にローリングPRへ積んで深澤の承認を待つ。毎週のRoutineから起動されるほか、「マーケターを進化させて」「投稿の反応を見て改善して」という依頼で使用する。
---

# /marketer-evolve — マーケティング活動の週次自己進化

`agent-evolve`（案内エージェントの自己進化）と同じ設計思想を、SNSマーケティングへ適用する。
「戦略書を書いて終わり」ではなく、**実際に投稿された文面の反応を見て、次の文面を改善する**。
**変更は必ずPR経由**（深澤の承認でマージ・公開）。

## 大原則

1. **編集対象は `marketing/` 配下のコンテンツと `scripts/post-social.js` のコア文面のみ**。
   `post-social.js` の投稿ロジック・API呼び出し部分や `.github/workflows/social-post.yml` の
   変更が必要だと判断した場合は、**編集せず**PR本文の「提案」欄に書くだけにする。
2. **コア文面（X_POSTS_CORE / BLUESKY_POSTS_CORE）の書き換えは1回最大2件**。小さく・確実に。
3. **mainへ直接pushしない**。固定ブランチ `claude/marketer-evolve` のローリングPRに積む。
4. 追加課金ゼロ厳守（有料API・有料サービスの使用禁止）。反応取得は各SNSの無料枠の
   読み取りAPIのみ使う（`scripts/fetch-social-engagement.mjs` が既にそう実装している）。
5. **反応データが取れない回でも、ゲームカタログとの同期だけは毎回行う**（下記Step 1）。
   これが「個別ゲームの継続告知」を機械的に維持する仕組みなので、反応が無くても意味がある。

## 手順

### 0. 準備
```bash
git fetch origin main
git checkout claude/marketer-evolve 2>/dev/null && git merge --ff-only origin/main || git checkout -B claude/marketer-evolve origin/main
```
open PR の有無は `mcp__github__list_pull_requests`（head: `claude/marketer-evolve`, state: open）で確認する。

### 1. ゲームカタログとの同期（個別ゲームの継続告知・毎回必須）
```bash
node scripts/gen-game-spotlight-posts.mjs
git diff --stat marketing/game-spotlight-posts.generated.js marketing/social_game_spotlight.md
```
`assets/js/agent-data.js` の GAMES に新作が追加/変更されていれば、ここで自動的にスポットライト
投稿（X日英・Bluesky日本語、各ゲーム1本ずつ）が更新される。**手でゲームを選んで書く必要はない**
（キュレーション済みの `title`/`desc` から機械生成するため）。差分が無ければそのままStep 2へ。

### 2. 反応の取得
```bash
node scripts/fetch-social-engagement.mjs --since=$(date -d '-90 days' +%Y-%m-%d 2>/dev/null || date -v-90d +%Y-%m-%d)
```
- X: 投稿時の認証情報（`X_API_*`）で `public_metrics` を取得。Bluesky/Reddit は公開読み取りAPI
  （認証不要）。Instagram はビジネスアカウントのトークンで `like_count`/`comments_count`。
- 認証情報が無いプラットフォームは黙ってスキップする（`post-social.js` と同じ方針）。
- **`marketing/post-log.json` が空、または対象が0件でも中断しない**（Step 1だけで終えてよい）。
  投稿を始めたばかりの期間はデータが薄いのが当然で、無理に「反応が悪かった」と判断しない。
- スクリプトの標準出力に反応スコア上位/下位5件が出る。上位＝伸ばす方向、下位＝見直し候補。

### 3. 分析と改善（最大2件）
優先順位:
1. **スコアが低いコア投稿（X_POSTS_CORE / BLUESKY_POSTS_CORE）の言い回しを、
   スコアが高いパターン（フック・訴求軸）に寄せて書き直す**。全文を変えず、フック部分
   （最初の1〜2行）を中心に調整する。
2. スコアが高いゲームスポットライトのパターン（例: 特定のジャンルタグの反応が良い）が
   見えたら、次回リリースするゲームの `agent-data.js` の `desc` を書く際の申し送りとして
   PR本文の「提案」欄に残す（`desc` 自体の変更はPlannerの管轄なのでここでは書き換えない）。
3. データが薄くて判断できない回は、**無理に書き換えない**（Step 1のカタログ同期だけで終えてよい）。

**やってはいけないこと**:
- 反応データを1件も見ずに「良さそう」という主観だけでコア文面を書き換えない
- 誇大な数字（フォロワー数・反応数）を文面に書き足さない（誇大広告の禁止は marketer.md の方針）
- REDDIT_POSTS / INSTAGRAM_POSTS の画像を要する投稿は、新しい画像を生成できないので
  タイトル文言の軽微な調整のみに留める（画像差し替えが必要な提案は提案欄へ）

### 4. 正本の同期
コア文面（X_POSTS_CORE / BLUESKY_POSTS_CORE）を書き換えた場合は、
`marketing/social_2026-08_x_instagram.md`（正本）と `scripts/post-social.js`（実行用の写し）の
**両方**を直す。片方だけ直すと検査#6でFAILする。

### 5. 検証
```bash
node scripts/verify-social-posts.mjs
node scripts/post-social.js x --dry-run
node scripts/post-social.js bluesky --dry-run
```
FAILがある状態でコミット・プッシュしてはならない。

### 6. コミット・PR
```bash
git add marketing/ scripts/post-social.js scripts/gen-game-spotlight-posts.mjs
git commit -m "marketer-evolve: <改善の要約>"
git push -u origin claude/marketer-evolve
```
- open PR がなければ `mcp__github__create_pull_request` で作成（base: main、タイトル
  「🤖 marketer-evolve: マーケティング活動の週次改善」）。
- PR本文には毎回追記する: 日付・反応スコア上位/下位の要約・実施した改善・**提案欄**
  （ロジック変更や画像差し替えが必要と判断した事項、`desc` 改善の申し送り）。
- あればそのPRに追加コミットするだけでよい（ローリングPR方式・PR乱立防止）。
- **GitHub MCPツールが使えないセッションの場合**: ブランチのプッシュまでで終了してよい
  （変更はブランチに永続化される。PR起票は翌回または深澤が手動で行う。その旨をDailyに記す）。

### 7. 記録
`obsidian-vault/01-Daily/YYYY-MM-DD.md` に実施内容と学びを1〜3行で記録する
（second-brain スキルの書式に従う）。**実行痕跡マーカー `<!-- routine:marketer-evolve -->` の
行を必ず1つ含めること**（harness-lint 検査#13の判定基準）。改善ネタが無くカタログ同期だけの回
でも、その旨1行＋マーカーを記録してコミット・プッシュする（無言で終了しない）。

## 運用メモ

- この仕組みは Claude Code Remote の Routine（毎週火曜 20:00 JST、`Auto Social Post` の
  水曜21:00投稿より前）から新セッションで起動される。深澤がPRを承認・マージすれば、
  同じ週の自動投稿に間に合う。
- SNS投稿の実体・自動化の全体像: `.claude/agents/marketer.md` の「成果物の所在と、
  実際に投稿されるまでの経路」節を参照。
- 2週間〜1ヶ月分のデータが溜まったら、「反応スコアが恒常的に低いコア投稿の入れ替え
  （新パターンで置き換え）」への拡張を深澤へ提案してよい（勝手に拡張しない）。
