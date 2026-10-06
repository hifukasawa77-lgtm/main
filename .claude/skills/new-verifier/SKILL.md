---
name: new-verifier
description: 「例外もエラーも出ない不具合」を二度踏んだとき、機械検査 scripts/verify-<名前>.mjs をひな形から起こす。静的サーバ・favicon 204・engine.errors 合算・外部オリジン分離・故障注入（--inject）の枠が入っており、登録漏れ（対応表・CLAUDE.md）のチェックリストも出す。「検査を作って」「再発防止を機械化して」「verify スクリプトを足して」という依頼、verifier/triage エージェントの作業時に使用する。
---

# /new-verifier — 機械検査のひな形を起こす

`verifier` エージェント（何を検査にするかの判断）の**手を動かす部分**を定型化する。
判断（一度踏んだら記録、二度踏んだら検査）は verifier、枠組みの用意はこのスキル。

## 使い方

```bash
bash .claude/skills/new-verifier/new-verifier.sh shogi shogi.html   # scripts/verify-shogi.mjs を生成
node scripts/verify-shogi.mjs --inject                              # 故障注入で ❌ が出るか確認
```

ひな形（`verify-template.mjs`）に入っている、このリポジトリで実証済みの枠:
- 自前の静的サーバ＋`/favicon.ico` は204（本物の404だけ拾う）
- `pageerror` + `console.error` + **`engine.errors` を合算**（GameKit は例外を捕まえて継続するので pageerror だけでは素通りする）
- **別オリジンの読込失敗は FAIL にしない**（`△ 外部` 表示のみ。環境由来の赤が本物を埋もれさせる）
- `--inject`: 意図的に壊して ✗ が出ることを確かめる欄（**偽の緑は検査が無いより悪い**）
- テスト用ブリッジ（`window.__TEST`）を `addInitScript` で開ける

## 納品の3点セット（1つでも欠けると次のセッションが気づかない）
1. `scripts/verify-<名前>.mjs`（中身まで見る検査＋故障注入の実行ログ）
2. `.claude/agent-conventions.md` §4 の対応表に1行（`/required-checks` はここを読む）
3. CLAUDE.md の該当節に「何を守る検査か・なぜ必要か」

登録後は `bash .claude/skills/self-improve/harness-lint.sh`（検査#14が実在を確認）を通す。

## 書き方の急所
- 「件数が出た」ではなく**中身**を見る（`0件の品目を抽出` が緑になった実例。receipt-ocr）
- 実時間で待たない。時間切れは検査から短くできる差し替え口を用意する
- 純粋関数だけを叩く検査にしない（画面がそれを使っていなければ意味がない）
- 検査自身の遷移中断（`ERR_ABORTED`）は、実体が在るときだけ除外する
- Playwright が無い環境では検査を「実行できなかった」と報告する（緑扱いにしない）。
  ESM は `NODE_PATH` を見ないので、グローバル導入なら一時的に `node_modules` へリンクして走らせる
