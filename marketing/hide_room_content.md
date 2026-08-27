# hide の部屋 — 拡散コンテンツ一式
作成日: 2026-06-17

> **⚠️ この文書はアーカイブです（運用終了）。**
> 現行の投稿文の正本は `marketing/social_2026-08_x_instagram.md`。
> 本ファイルの数値・ゲーム一覧は作成当時のもので**現状と一致しません**。参照・転記しないこと。


---

## 1. X (Twitter) 投稿文（日本語）

### パターンA — ゲーム紹介メイン（ゲーマー向け）

将棋・麻雀・バックギャモン・ベルトスクロールアクション・シューティング…
ブラウザだけで遊べる本格ゲームを35本以上無料公開中。
インストール不要、スマホ・PCどちらでも即プレイ。
ぜひ遊んでみてください！
https://hifukasawa77-lgtm.github.io/main/
#ブラウザゲーム #無料ゲーム #個人開発 #ゲーム好きと繋がりたい

---

### パターンB — Claude AI共同開発メイン（エンジニア向け）

Claude AIとのペアプログラミングだけで、ブラウザゲームを35本以上作りました。
使ったのは素のHTML / CSS / JavaScript（Canvas API）のみ。
フレームワーク・ビルドツール一切なし。
コードと向き合う楽しさを再発見した1年間でした。
https://hifukasawa77-lgtm.github.io/main/
#Claude #AI駆動開発 #個人開発 #JavaScript #CanvasAPI

---

### パターンC — 無料・インストール不要メイン（一般向け）

アプリのインストール不要！
ブラウザを開くだけで将棋・麻雀・ポーカー・アクションゲームが全部タダで遊べます。
一人でも対AI対戦で遊べるので、暇つぶしに最高です。
35本以上収録、随時追加中。
https://hifukasawa77-lgtm.github.io/main/
#暇つぶし #無料ゲーム #ブラウザゲーム #将棋 #麻雀

---

## 2. Zenn 記事アウトライン

### タイトル案

1. **「Claude AIとペアプロして35本のブラウザゲームを作った話——フレームワークなし・ビルドなし・それでも動く」**
2. **「素のJavaScriptとClaudeだけでゲームを量産する技術——Canvas APIを武器にした個人開発1年間の知見」**
3. **「AIペアプロは"写経"を超えた——Claude Codeと作った将棋・麻雀・ベルトスクロールアクション開発の舞台裏」**

---

### 詳細アウトライン（タイトル案1）

**タイトル:**
「Claude AIとペアプロして35本のブラウザゲームを作った話——フレームワークなし・ビルドなし・それでも動く」

#### はじめに
- 自己紹介：埼玉県三郷市在住、個人開発者のhide
- 「フレームワークなし・ビルドツールなし」という縛りを設けた理由
- この記事で伝えること：Claude AIとのペアプロで何が変わったか

#### H2: なぜ「素のHTML/JavaScript」にこだわるのか
- ##### H3: 依存関係ゼロのメリット——10年後も動くコード
- ##### H3: Canvas APIだけでできることの広さ（描画・物理・衝突・エフェクト）
- ##### H3: GitHub Pagesでそのまま公開できるシンプルさ

#### H2: Claude AIをペアプロ相手にする実際のワークフロー
- ##### H3: 仕様書を渡してコードを生成——プロンプト設計の工夫
- ##### H3: エラーのフィードバックループ——「動かない」を伝えるコツ
- ##### H3: AIに任せる部分と自分で判断する部分の切り分け方

#### H2: ゲームジャンル別の実装ポイント
- ##### H3: ボードゲーム（将棋・麻雀・バックギャモン）——AI対戦ロジックの組み方
- ##### H3: アクションゲーム（ベルトスクロール・シューティング）——Canvas上の当たり判定と描画ループ
- ##### H3: カードゲーム（百人一首・トランプ）——状態管理とアニメーション

#### H2: 35本作って気づいたClaudeペアプロの限界と向き合い方
- ##### H3: コンテキスト窓の問題——大規模ファイルをどう分割するか
- ##### H3: AIが苦手な「ゲームバランス調整」——最後は人間の感覚が必要
- ##### H3: 同じバグを繰り返させないプロンプトの書き方

#### H2: 実際に公開して反響はあったか
- ##### H3: GitHub Pagesでの公開手順——ゼロコストで世界に届ける方法
- ##### H3: SNSでの反応——エンジニアとゲーマー、どちらに刺さったか

#### H2: まとめ——AIペアプロで個人開発の「量」が変わった
- 1年間で学んだこと
- 次に作りたいもの
- リポジトリ・サイトへのリンク

---

## 3. GitHub README（英語）

```markdown
# hide no heya — Browser Game Collection

![Games](https://img.shields.io/badge/Games-35%2B-blue?style=flat-square)
![Tech](https://img.shields.io/badge/Tech-Vanilla%20JS-yellow?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![No Install](https://img.shields.io/badge/Install-Not%20Required-lightgrey?style=flat-square)

> **35+ browser games built with Claude AI pair programming — no frameworks, no build tools, just HTML/CSS/JavaScript.**

## About

Hide no Heya is a personal portfolio of browser games created by hide, an independent developer based in Misato, Saitama, Japan.
Every game runs entirely in the browser with zero installation required, built using only vanilla JavaScript and the Canvas API.
All titles were developed through pair programming sessions with Claude AI, exploring how far raw web technologies can go.

## Featured Games

| Title | Genre | Highlights |
|-------|-------|------------|
| BLACK FANG | Belt-scroll action | Multi-stage beat-em-up with boss fights |
| AI Shogi | Board game | Full shogi with AI opponent |
| AI Mahjong | Board game | Japanese mahjong vs AI |
| Backgammon | Board game | Classic board game with AI |
| VECTOR VANGUARD | Shooting | Canvas-based shoot-em-up |

## Tech Stack

- **Language**: HTML5 / CSS3 / Vanilla JavaScript (ES6+)
- **Rendering**: Canvas API
- **Hosting**: GitHub Pages
- **AI Co-pilot**: Claude (Anthropic) — pair programming for all 35+ titles
- **No frameworks. No bundlers. No dependencies.**

## How to Play

1. Open the site: **https://hifukasawa77-lgtm.github.io/main/**
2. Click any game card — it launches instantly in your browser.

No account, no download, no plugin needed.

## Live Demo

**https://hifukasawa77-lgtm.github.io/main/**
```
