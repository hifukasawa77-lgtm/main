---
name: site-proposal
description: ホームページ（ポートフォリオサイト全体）の週次ブラッシュアップ提案。SEO/a11y/perf/i18nの機械監査・ゲームカタログの穴・案内エージェントの/stats（訪問者ニーズ）・トレンドを分析し、トップ3の改善提案書を作ってGitHub Issue（ラベルproposal）として起票する。提案のみでコード変更は行わない。週次Routineから起動されるほか、「サイトの改善案を出して」「ブラッシュアップ案が欲しい」という依頼で使用する。
---

# /site-proposal — ホームページ週次ブラッシュアップ提案

サイト全体を多角的にレビューし、**実装せずに提案だけ**をまとめて深澤（PM）へ届ける。
実装は深澤が Issue を承認した後、planner → 制作パイプラインで別途行う。

## 大原則

1. **コードの変更・コミット・プッシュは一切しない**（読み取り専用＋Issue起票＋Vault記録のみ）。
2. 提案は**トップ3に絞る**。各提案に「期待効果（impact）／工数感（effort）／受け入れ条件」を必ず付ける。
3. 過去の提案Issueと重複させない（起票前に既存の `proposal` ラベルIssueを確認）。
4. 追加課金ゼロ厳守。

## 手順

### 1. 機械監査（レポートモード）
```bash
bash .claude/skills/seo-audit/seo-audit.sh      # OGP/meta欠落
bash .claude/skills/a11y-audit/a11y-audit.sh    # alt/lang/aria/reduced-motion
bash .claude/skills/perf-audit/perf-audit.sh    # ページ重量・大容量ファイル
bash .claude/skills/i18n-check/i18n-check.sh    # 日英表記の一貫性
```
（是正はしない。結果は提案の根拠として引用する）

### 2. コンテンツ・カタログ分析
- `assets/js/agent-data.js` の GAMES: thumb欠落・desc の薄いタイトル・ジャンル偏り（例: ボード偏重）
- index.html: 古い情報・導線の弱いセクション・新ゲームの露出
- ブログ/スライド等の更新停滞

### 3. 訪問者ニーズ分析
```bash
curl -s -m 30 https://ai-proxy.hi-fukasawa77.workers.dev/stats
```
- `negatives`/`topHits` から「訪問者が求めているのに答えられていない話題」を抽出
  → コンテンツ追加・新機能の提案根拠にする（エージェント辞書の改善自体は /agent-evolve の担当）。

### 4. トレンド調査（1件だけ）
researcher エージェント（Agent tool, subagent_type: researcher）に「ブラウザゲーム/個人開発ポートフォリオ界隈で今週注目のトレンドを1つ、根拠つきで」と依頼する。失敗しても提案は続行。

### 5. 提案書の作成
分析結果からトップ3を選び、以下の構成でmarkdownにまとめる:

```markdown
# 🎨 サイトブラッシュアップ提案（YYYY-MM-DD）
## 提案1: <タイトル>
- 背景/根拠: （監査結果・/stats・トレンドの引用）
- 内容: （何をどう変えるか）
- 期待効果: ／ 工数感: 小|中|大 ／ 受け入れ条件: （完成の定義）
## 提案2 …／## 提案3 …
## 参考: 今回の監査サマリー
```

### 6. 届ける
1. `mcp__github__search_issues` で既存 `label:proposal` の open Issue を確認し、重複提案を除外
2. `mcp__github__issue_write` で Issue 起票（タイトル「🎨 サイトブラッシュアップ提案 YYYY-MM-DD」、ラベル `proposal`。ラベルが無ければ `mcp__github__get_label`→なしでも起票は続行しラベルなしで作成）
3. 写しを `obsidian-vault/02-Projects/site-proposals/YYYY-MM-DD.md` に保存
4. `obsidian-vault/01-Daily/YYYY-MM-DD.md` に1行記録
5. Vault写し（3・4）の永続化のため、**obsidian-vault/ 配下のファイルのみ**をブランチ
   `claude/site-proposal-vault` にコミット・プッシュしてよい（サイト本体のコード変更禁止は変わらず）
6. **GitHub MCPツールが使えないセッションの場合**: Issue起票をスキップし、提案書全文を
   Vault写し（上記5で永続化）と最終報告メッセージに残す。次回セッションや深澤が手動起票できる形にする（Issue番号つき）
7. **無痕跡で終了しない（必須）**: 提案が1件も出せなかった・監査が途中で失敗した・ツールが足りず何もできなかった——
   どの結末でも、**最低限その旨1行と実行痕跡マーカー `<!-- routine:site-proposal -->` を
   `obsidian-vault/01-Daily/YYYY-MM-DD.md` へ書いてコミット・プッシュしてから終わる**こと
   （harness-lint 検査#13 がこのマーカーの鮮度を見張る。**本文の散文で `site-proposal` と書くだけでは
   痕跡と認められない**——他セッションの言及と区別できないため、マーカー行が唯一の判定基準）。
   Routineの実行結果はチャットに残るだけでリポジトリからは追えないため、痕跡が無いと「起動しなかった」のか
   「起動して何も出さなかった」のか誰にも判別できず、故障が何週間も気づかれない
   （実例: 2026-07-19・07-26 の firing はIssueもVault写しもDailyも残さず、2週間気づかれなかった）

## 役割分担

- **site-proposal（本スキル）**: 発見と提案（読み取り専用）
- **researcher**: トレンド・市場調査の下請け
- **planner 以降のパイプライン**: 深澤が Issue を承認した後の要件定義・実装（本スキルからは起動しない）
