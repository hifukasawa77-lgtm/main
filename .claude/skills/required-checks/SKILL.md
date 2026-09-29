---
name: required-checks
description: 変更したファイルから「通すべき機械検査」を自動で割り出し、必要なら一括実行する。正本は .claude/agent-conventions.md §4 の対応表（写しを持たないので表を直せば追随する）。「どの検査を回せばいい？」「必須検査を通して」「完了報告の前に検査して」という依頼、sengoku/sanguo/zero1/sw.js/アセット等に触った後、コミット・PR前に使用する。
---

# /required-checks — 触ったファイルから必須検査を割り出す

このリポジトリの不具合は「例外もエラーも出ない」形で出るため、完了の定義は
**「対応する機械検査が緑」**（agent-conventions §4）。だが検査は24本以上あり、
どれを回すかを記憶に頼ると**飛ばす**。このスキルは変更差分から機械的に選ぶ。

## 使い方

```bash
bash .claude/skills/required-checks/required-checks.sh              # 未コミット＋未追跡から一覧
bash .claude/skills/required-checks/required-checks.sh --run        # 一覧を順に実行し集計
bash .claude/skills/required-checks/required-checks.sh --base main  # コミット済み分（main との差分）も含める
bash .claude/skills/required-checks/required-checks.sh a.html b.js  # ファイル直接指定
```

- 未追跡ファイルも見る（新規アセットは git add 前）
- 専用検査の無い HTML は `dynamic-test`、最後に必ず `release-check` を足す
- 表に無いファイルは「CLAUDE.md に検査の記載が無いか」を促すだけ（**CLAUDE.md が優先、表は索引**）
- 終了コード: 一覧のみ=0 / `--run` 全緑=0・赤あり=1 / 表が読めない=2

## 運用ルール
- 完了報告の前に **`--run` を通す**。赤が出たら「検査が偽の赤ではないか」を先に疑う前に、まず実際の不具合として読む
  （偽の赤の判断は `obsidian-vault/04-Knowledge/false-red-checks-are-worse-than-none.md`）
- 検査を新設したら **`agent-conventions.md` §4 の表に1行足す**（このスキルはそこを読む。harness-lint 検査#14 が実在確認）
- 重い検査（`verify-sengoku-balance` 等）は数分かかる。ファイルを絞って一覧だけ先に見せ、深澤に伝えてから `--run` する
- ブラウザ系の検査は環境に Playwright が要る。無い環境では「実行できなかった」と正直に報告する（緑扱いにしない）
