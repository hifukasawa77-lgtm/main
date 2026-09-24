# note/ — note記事の正本

noteでの発信と収益化の作業場。**戦略と判断の記録は `docs/note-monetization.md`**、
ここは日々の運用手順を置く。

## 構成

| パス | 役割 |
|---|---|
| `note/topics.json` | ネタ帳（正本）。`/note-post` が上から `status:backlog` を1件取り出す |
| `note/articles/*.md` | 記事本体。`YYYY-MM-DD-<slug>.md` |
| `note/publish-log.json` | 実際にnoteへ公開した記録（URL・日付・売上） |
| `note/export/` | 貼り付け用テキスト（自動生成・gitignore） |

## 自動化の境界（重要）

**noteには公式の投稿APIが無い。** だから自動化するのは「書く」までで、
「貼る」は人が行う。判断の理由は `docs/note-monetization.md`。

```
毎週水 06:00 JST  Routine → /note-post → PR claude/note-post   ← 自動
     ↓ 深澤がPRを承認・マージ
                  node scripts/note-export.mjs で貼り付け用テキストを出す
     ↓
  ┌ 無料会員 ──── 毎週1回、1本貼って公開      （週3分）   ← 人
  └ プレミアム ── 月1回、4本貼って予約日時を入れる（月15分） ← 人
     ↓
毎週               記事が公開される
```

**noteプレミアム（月500円）は前提ではない。** 無料会員は「月1回まとめて」の代わりに
**毎週1回、1本貼って公開する**（1本3分ほど）。総作業時間はほぼ同じで、
違うのは公開日に手を動かす必要があるかどうかだけ。販売手数料は会員種別で変わらない。
予約投稿（プレミアムのWebブラウザ限定機能）を使う場合だけ、上の「月1回」の形になる。

## 記事の書式

```markdown
---
title: "記事タイトル"
slug: article-slug          # ファイル名の -<slug>.md と一致させる
kind: paid                  # free | paid
price: 500                  # 0（無料）または 100〜50,000（100円単位）
topic_id: t001              # topics.json のID
hashtags: [AI, ClaudeCode, 個人開発]   # 3〜5個
status: ready               # draft（執筆中）| ready（貼れる）| published（公開済み）
published_at: null          # 公開日 YYYY-MM-DD
note_url: null              # 公開後のURL
---

（無料部分。最低800字。結論の要約までここに置く）

<!-- 有料ライン -->

（有料部分。無料部分の0.8倍以上）
```

- **`<!-- 有料ライン -->` は有料記事にちょうど1つ**（noteは記事に1本しか引けない）
- **リポジトリの総数を書くときは `<!--fact:キー-->` を数字の直後に付ける**
  （`games` / `agents` / `verifiers` / `adrs`）。実データとずれたら検査が落ちる。
  export時にHTMLコメントは剥がされるので読者には見えない。
  **`status: published` の記事は突き合わせ対象外**——note側で数字が凍結され直せないため、
  FAILさせ続けると「常に赤い検査」になって必ず無視されるようになる。
  検査が効くのは貼る前だけなので、そこへ絞ってある
- 相対リンクはexport時に本番URLへ絶対化される。`](zelda_like.html)` のように書いてよい

## コマンド

```bash
node scripts/verify-note-articles.mjs     # 必須。貼る前に必ず通す（12項目）
node scripts/note-export.mjs              # ready/written を全部 note/export/ へ
node scripts/note-export.mjs <slug>       # 1本だけ
node scripts/note-export.mjs <slug> --stdout   # 標準出力（そのままコピー）
```

## 公開したあとにやること

1. 記事mdの frontmatter に `status: published` / `published_at` / `note_url` を入れる
2. `note/publish-log.json` の `posts` へ追記する
3. `note/topics.json` の該当トピックを `status: published` にする
4. `node scripts/verify-note-articles.mjs` で整合を確認する（3箇所のずれを検出する）

## やらないこと

- **非公式APIやスクレイピングでの自動投稿**（規約リスク＞収益。判断は `docs/note-monetization.md`）
- **週2本以上の投稿**（noteはスパム的な大量投稿を禁じている。検査#12が5日未満の間隔で落ちる）
- **誇大な収益表現**（検査#7が禁止語を機械検出する）
- **一次情報以外を書く**（他所の記事の要約に金は取らない）
