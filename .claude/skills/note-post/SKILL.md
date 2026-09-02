---
name: note-post
description: noteの記事を1本書いて、貼り付け可能な状態までPRに積む。ネタ帳（note/topics.json）から次の題材を選び、リポジトリの一次情報だけで有料/無料記事を執筆し、機械検査を通してローリングPRへ積む。毎週のRoutineから起動されるほか、「note記事を書いて」「noteに投稿するネタを形にして」という依頼で使用する。
---

# /note-post — note記事を1本書く

`agent-evolve` / `marketer-evolve` と同じ設計思想。**変更は必ずPR経由**（深澤の承認でマージ）。

## 大原則

1. **1回の実行で書くのは1本だけ**。noteはスパム的な大量投稿を規約で禁じている。
   まとめて量産しない（検査#12が公開間隔5日未満で落ちる）
2. **一次情報しか書かない**。題材はこのリポジトリで実際に起きたこと
   （`obsidian-vault/03-Decisions/`・`04-Knowledge/`・`CLAUDE.md` の各知見節）。
   他所の記事の要約・一般論には金を払われないし、書く価値も無い
3. **失敗を書く**。「3コミット費やして誤診した」「自分の環境だけ動いていた」が記事の中心。
   成功談だけの記事は無料で足りてしまう
4. **mainへ直接pushしない**。固定ブランチ `claude/note-post` のローリングPRに積む
5. **投稿はしない**。noteに公式の投稿APIは無く、非公式APIでの自動投稿は採らない方針
   （理由: `docs/note-monetization.md`）。貼るのは深澤
6. **追加課金ゼロ厳守**。記事はClaude Code自身が書く（画像生成APIも使わない）

## 手順

### 0. 準備
```bash
git fetch origin main
git checkout claude/note-post 2>/dev/null && git merge --ff-only origin/main || git checkout -B claude/note-post origin/main
```
open PR の有無は `mcp__github__list_pull_requests`（head: `claude/note-post`, state: open）で確認する。

### 1. 題材を選ぶ
`note/topics.json` の `topics` を上から見て、**最初の `status: "backlog"` を取る**。

- `kind` は **free と paid が交互**に並ぶよう配置してある。順番を勝手に入れ替えない
  （無料が集客、有料が回収。有料だけ並べると誰も来ない）
- backlog が尽きたら、**書かずにネタを補充する**。補充元は
  `obsidian-vault/03-Decisions/`（ADR）と `04-Knowledge/`、直近の Daily Note。
  「例外もエラーも出ないのに壊れた」系の学びが最も売れる
- 既存記事と題材が被っていないか `note/articles/` のタイトルを見て確認する

### 2. 素材を集める
題材の `source` に挙がったファイルを読む。**記事に書く事実は必ず実物で裏を取る**
（数字・パス・コード片）。記憶や推測で書かない。

- 数字（ゲーム本数・エージェント数・検査本数・ADR数）は `<!--fact:キー-->` を付ける。
  キーは `games` / `agents` / `verifiers` / `adrs`。検査#9が実データと突き合わせる
- コード片は**スニペット（20〜40行）**まで。ファイル全文を貼らない
- **紹介するリポジトリ内パスは実在するものだけ**（検査#11が実在を確かめる）

### 3. 書く
出力先は `note/articles/YYYY-MM-DD-<slug>.md`。日付は**次に空いている水曜**。
書式（frontmatter・有料ライン）は `note/README.md` を参照。

構成の型:

```
（つかみ 3〜5行）……何が起きたか。読者の「それ自分も踏んだ」を突く
## この記事で分かること   ……箇条書き4〜5点
## 先に結論              ……ここで出し惜しみしない
（無料部分ここまで。最低800字）
<!-- 有料ライン -->
## 1〜6. 個別の事例       ……「何が起きたか」「なぜ既存の検査を素通りしたか」「どう止めたか」
## まとめ                ……明日から効く3〜5点
（ポートフォリオへのリンク＋コメントの呼びかけ）
```

**無料部分に結論まで置くこと。**「続きが有料」だけの記事は返金申請の対象になるし、
実際に売れない。有料部分の価値は「結論に至った過程と、そのまま使えるコード」にある。

### 4. topics.json を更新
書いたトピックを `status: "written"` にする（`backlog` のままだと検査#10で落ちる）。

### 5. 検証（必須）
```bash
node scripts/verify-note-articles.mjs
node scripts/note-export.mjs <slug> --stdout | head -40
```
FAIL がある状態でコミット・プッシュしてはならない。
△（警告）は内容を見て判断する — 別文脈の数字なら無視してよい。

### 6. コミットとPR
```bash
git add note/ && git commit && git push -u origin claude/note-post
```
PR本文には次を書く:
- 今回の題材と、なぜそれを選んだか
- 無料部分/有料部分の文字数と価格
- **深澤がやること**: `node scripts/note-export.mjs` → noteへ貼る → 予約投稿

## やってはいけないこと

- **収益実績の誇張・捏造**（「月◯万円」「不労所得」等）。検査#7が禁止語で落とす
- **1回の実行で複数本を書く**（規約リスク。1本ずつ積む）
- **note/publish-log.json を勝手に埋める**。実際に公開した記録だけが入る
- **`scripts/note-export.mjs` に投稿機能を足す**。自動投稿は採らない方針
  （必要だと判断したらPR本文の「提案」欄に書くだけにする）
