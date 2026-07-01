---
name: release-check
description: コミット/デプロイ前の機械チェック。.edge-test-profile等の一時プロファイル混入・console.log残り・CDNスクリプトのSRI欠落・1MB超の新規ファイル・APIキー混入を git diff ベースで検査する。「コミットして」「リリースして」「プッシュして」の前、および workflow スキルのコミット前チェックリストの機械実行に使用する。
---

# /release-check — コミット前の機械チェック

workflow スキルの「コミット前チェックリスト」のうち機械検査できる項目を1コマンド化したもの。目視項目（スタイル破壊・モバイル崩れ）は workflow スキル、動作確認は /dynamic-test が担当。

## 使い方

```bash
bash .claude/skills/release-check/release-check.sh
```

終了コード: 問題なし=0 / 問題あり=1。検査項目:

| # | 検査 | 対象 |
|---|---|---|
| 1 | ブラウザプロファイル混入（`.edge-test-profile/` `tmp-edge-profile-*` 等） | 追跡ファイル＋ステージ済み |
| 2 | `console.log` の追加行（デバッグ残り） | `git diff HEAD` の追加行 |
| 3 | CDN `<script src="https://...">` の `integrity`（SRI）欠落 | 変更されたHTML |
| 4 | 1MB超の新規/変更ファイル | `git diff HEAD` |
| 5 | APIキー・シークレットらしき文字列の混入 | `git diff HEAD` の追加行 |
| 6 | `test-screenshots/` の混入 | ステージ済み |

## 運用
- コミット直前に必ず実行する。✗が出たら是正してから再実行 → コミット
- #2 は意図的な `console.log`（ユーザー向けコンソール演出等）なら該当行を確認のうえ無視してよい（その旨をコミットメッセージに書く）
- #5 が出た場合はコミット絶対禁止。CLAUDE.md「APIキーに関する禁止事項」に従い、書いた設定ごと即時削除する
- チェック通過後の流れ: /dynamic-test（変更HTML）→ コミット → push → /deploy-verify
