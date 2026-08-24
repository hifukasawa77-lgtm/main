---
type: decision
tags: [decision, marketing, ci, automation]
date: 2026-08-24
status: accepted
related: [0029-dynamic-test-false-failures, 0028-agent-consolidation-and-pipeline-placement]
---

# 0030: マーケターの成果をSNS投稿まで到達させる（X / Instagram 自動投稿）

## 背景
深澤から「マーケターの成果が見えない」。原因は2つとも**成果物が投稿に到達していない**ことだった。

1. `Auto Social Post`（毎週月曜）は Bluesky/Reddit 用に存在したが、**Secrets 未設定で毎回失敗**。
   一度も投稿できていなかった（GitHub Actions のログで確認）
2. X と Instagram は**対象に入っていなかった**
3. `marketing/` のコンテンツは2026-06-03作成で、主力の歴史SLG4本が未掲載

## 決定

### 成果物（マーケターの出力）
- `marketing/social_2026-08_x_instagram.md` — X日英4本／Instagramキャプション3本／
  投稿スケジュール／KPI。**これが投稿文の正本**
- `assets/marketing/ig-0N-*.jpg` — 1080×1080 の投稿画像4枚。
  `scripts/gen-instagram-images.mjs` で再生成できる（サイトのデザイン規約に準拠）

### 自動化
- `scripts/post-social.js` に `x` / `instagram` を追加
  - X: API v2 `POST /2/tweets`。OAuth 1.0a 署名を `crypto` で自前実装（依存追加なし・無料枠 月500投稿）
  - Instagram: Graph API の2段/3段公開（カルーセルは `is_carousel_item` → 親コンテナ → `media_publish`）。
    画像はGitHub Pages上の公開URLをMetaが取得する
- `--dry-run` を追加（認証情報なしで文面と文字数を確認できる）
- **認証情報が未設定のプラットフォームはスキップして正常終了**（従来は失敗）
- スケジュールを水曜21:00 JSTへ変更（深夜帯より反応が取れる時間帯）

### 検証（認証情報なしで確かめられることは全部検査する）
`scripts/verify-social-posts.mjs`:
1. OAuth 1.0a 署名が **X公式ドキュメントのテストベクタ**と一致するか
2. X 280文字（URLは23文字換算）／Instagram 2200文字の上限
3. Instagram画像がJPEGで実在するか（Metaが取得できないと投稿が落ちる）
4. 投稿文のゲーム本数が実データ（`agent-data.js` の `GAMES.length`）と一致するか

故障を3種仕込んで、すべて✗が出ることを確認済み。

### 役割分担
**代理投稿はしない。** 認証情報の登録と最終的な投稿の実行は深澤（PM）。
手順は `docs/social-setup.md`。マーケターは「すぐ投稿できる状態」までを担う。

## 学び
- **「戦略ドキュメントを書いて終わり」がマーケターの失敗モード**。投稿されて初めて成果になる。
  エージェント定義に成果物→自動化→実行の経路を表で書き、どこで止まっているか分かるようにした
- **実行できないコードこそ、実行せずに検証できる部分を切り出して検査する**。
  OAuth署名は公開テストベクタで検証でき、本番投稿を待たずに正しさを担保できた
- **雑な正規表現は偽陽性で検査を殺す**。件数チェックの初版が「ボードゲーム20本」を総数と誤検出した。
  総数を名乗る表現だけに限定して解決
- **未設定で毎週赤くなるCIは、赤の意味を失わせる**。ADR 0029（検査の偽FAIL）と同じ構図が定期ジョブでも起きていた
