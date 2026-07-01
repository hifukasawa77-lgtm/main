---
name: vault-gc
description: セカンドブレイン（obsidian-vault/）の健全性チェックと整理。wikilink切れ・孤立ノート・Inbox滞留をスクリプトで検出し、仕分け基準に従って整理する。「Vaultを整理して」「ノートを掃除して」「リンク切れを確認して」という依頼、weekly-review でInbox滞留が見つかったときに使用する。
---

# /vault-gc — Vault健全性チェック・整理

## 使い方

```bash
bash .claude/skills/vault-gc/vault-gc.sh
```

終了コード: 問題なし=0 / 問題あり=1。検査項目:
- **wikilink切れ**: `[[ノート名]]` の参照先 `.md` がVault内に存在しない
- **孤立ノート**: どのノートからも `[[...]]` で参照されていない（MOC・Templates・Daily は対象外。Dailyは日付で辿れるため）
- **Inbox滞留**: `00-Inbox/` に残っているメモ

## 是正の仕方

| 検出 | 対応 |
|---|---|
| wikilink切れ | タイポなら修正。ノート未作成なら作成するか、リンクを外す |
| 孤立ノート | `MOC.md` または親ノート（該当プロジェクト/知見）からリンクを張る。不要なら削除（意思決定ログは削除せず `status: superseded` にする） |
| Inbox滞留 | 下の仕分け基準で移動する |

## Inbox仕分け基準（00-Inbox/ → 各フォルダ）

- 再利用可能な知見・ハマりどころ → `04-Knowledge/`（既存ノートに追記できるなら追記優先）
- 意思決定（方針・選定・ルール変更） → `03-Decisions/NNNN-スラッグ.md`（ADR形式・連番は最大+1）
- 特定プロジェクトの状態・TODO → `02-Projects/<プロジェクト>.md`
- その日の作業記録 → `01-Daily/YYYY-MM-DD.md`
- どれでもない一時メモで2週間以上経過 → 破棄してよい（判断に迷えば深澤に確認）

移動後は wikilink・frontmatter を整え、`MOC.md` から辿れることを確認する（second-brain スキルの書式ルール準拠）。
