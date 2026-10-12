---
type: knowledge
tags: [knowledge, verification, reporting]
related: ["[[false-red-checks-are-worse-than-none]]", "[[verification-counts-the-wrong-thing]]"]
---

# 報告・コメントに書く「事実」は、書く前に確かめる

2026-10-09 に同じ型の誤りを3回やった。どれも**もっともらしい文**で、例外もエラーも出ない。

| 書いたこと | 実際 | 確かめ方 |
|---|---|---|
| 「PR #14・#15 の中身は main に入っているように見える」 | #14 は未反映、#15 は別実装で置き換え済み | 変更ファイルごとに `git cat-file -e` ＋ `git diff --quiet` |
| 「この枝は先頭でないと他の枝に横取りされる」（コメント） | 末尾へ動かしても検査が通った | 書いた通りに壊して ✗ が出るか見る |
| `pkill -f "vinext start"` で止める | 自分のシェルのコマンド行にも同じ語があり、シェルごと死んだ | `fuser -k <port>/tcp` |

## 原則
- 「〜に見える」「〜はず」を成果物・コメント・報告に書かない。**確かめられないなら確かめられないと書く**
- 理由を書くコメントは、**その理由が成り立たなくなる操作**（動かす・外す・壊す）を一度やってから書く。成り立たなければ「保険」と書く
- 他のリポジトリ・他人のPRについての断定は、名前や見た目の類似で済ませず、ファイル・値の単位で突き合わせる

→ `.claude/skills/pr-backlog/SKILL.md`（死蔵の判定）、`.claude/agents/verifier.md`（手順10）、`CLAUDE.md`（PC版ZERO-1の扱い）に昇格済み（2026-10-11）
