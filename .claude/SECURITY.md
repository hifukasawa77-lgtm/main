# Claude Code セキュリティ設定 — hide_0001 portfolio

本リポジトリでは Claude Code の操作を **strict mode** で運用する。
`.claude/settings.json` の静的ルールと `.claude/hooks/*.sh` の PreToolUse フックを
組み合わせた多層防御を採用し、機密漏洩・破壊的操作・不正なネットワーク経由のコード実行
を抑止する。

## 脅威モデル

優先的に防ぐもの：
- `backend/admin.db.json` 等に含まれるパスワードハッシュ・JWT secret の漏洩
- `.env` / SSH 秘密鍵 / AWS クレデンシャルの漏洩
- 任意の `rm -rf` / `dd` / `mkfs` 等によるシステム破壊
- `main` / `master` への強制プッシュ・履歴改ざん
- `curl ... | sh` 系のサプライチェーン攻撃
- 任意の外部ホストへのデータ exfil

明示的にスコープ外：
- `cat /etc/hosts` 等による OS 構成情報の参照（プロジェクト機密の漏洩ではない）
- ローカル開発時の `npm run dev` 等（`ask` で都度確認）

## Layer 1 — 静的ルール（`.claude/settings.json`）

`permissions.allow` / `ask` / `deny` の三段。`defaultMode:"ask"` で未定義操作は
必ず承認プロンプトを出す。

- **allow**: 読み取り専用操作のみ。ファイル `Read/Edit/Write` は `/home/user/main/**`
  に限定、Bash は `ls/cat/grep/find/jq/...` 等の参照系、git は `status/log/diff/show/branch/fetch`
  の読み取り系、WebFetch は 5 個の信頼ドメインのみ。
- **ask**: `git add/commit/push/pull/checkout/merge/rebase/reset/...`、`npm install/run/test`、
  `npx`、`node`、`mkdir/cp/mv/rm/chmod/ln`。不可逆／副作用ありの操作は毎回承認。
- **deny**: 機密ファイル `Read`、`.git/` `.edge-test-profile/` `Edit/Write`、
  `sudo`、`rm -rf` の root-ish パターン、`chmod 777`、`dd`、`mkfs`、`shutdown`、
  `eval`、`history -c`、`git push --force`、`git push origin main/master`、
  `git reset --hard`、`git config --global`、`npm publish/login`、
  `curl|sh` / `wget|sh`、`nc/ncat/telnet`、allowlist 外の WebFetch すべて。

## Layer 2 — Bash 正規表現ガード（`.claude/hooks/bash-guard.sh`）

Claude Code の prefix マッチでは表現できない動的パターンを検出する。
PreToolUse JSON を stdin から受け、`exit 2` + stderr で blocking。

検出対象：
1. 変数 / glob / `..` を含む `rm -rf`
2. `curl|wget` をシェルや Python/Node にパイプ
3. `bash <(curl ...)` プロセス置換ダウンロード実行
4. `base64 -d | bash` / `xxd -r | bash` 系の難読化実行
5. `nc/ncat`、`bash -i >& /dev/tcp/...` のリバースシェル
6. allowlist 外ホストへの `curl --data` / `-F` / `--upload-file`（exfil）
7. fork bomb
8. `history -c/-w`、`.bash_history` 上書き、`unset HISTFILE`
9. `.bashrc` / `.zshrc` / `.profile` への追記
10. 引数順を問わない `git push --force ... main/master`
11. `cat/less/more/head/tail/bat` で `.env / id_rsa / .ssh / .aws / admin.db.json / *.pem / *.key` を読む試み
12. `/root/` や他ユーザー `/home/<other>/` への侵入

## Layer 3 — 機密ファイルガード（`.claude/hooks/sensitive-file-guard.sh`）

`Read/Edit/Write/MultiEdit/NotebookEdit` の `file_path` を `readlink -f` で
**絶対パス＋シンボリックリンク解決後** にマッチ。`../` や symlink 経由のバイパスを潰す。

ブロック条件：
- `*/.env*`, `*.pem`, `*.key`, `*/id_rsa*`, `*/id_ed25519*`,
  `*/.ssh/*`, `*/.aws/*`, `*/credentials*`, `*/secrets*`, `*.secret`
- `/home/user/main/backend/admin.db.json`, `/home/user/main/backend/*.db`
- `/root/.claude/*`
- `Edit/Write` の場合：`.git/*`, `.edge-test-profile/*`, **プロジェクト外への書き込み**

## Layer 4 — Stop フック（user 層から継承）

`/root/.claude/settings.json` の Stop フック（`stop-hook-git-check.sh`）が
未コミット／未プッシュ変更を検出してセッション終了をブロックする。
project 層では同 matcher を再定義しないため、両層がマージされて従来通り発火する。

## 個人別の上書き（`.claude/settings.local.json`）

開発者が一時的に許可ルールを緩めたいときは `.claude/settings.local.json` を作成する。
このファイルは `.gitignore` に追加済みでコミットされない。チーム共通ルールは
本ファイル（`settings.json`）で管理し、個人事情はローカルに分離する設計。

## 設定変更の反映

`settings.json` / フックスクリプト変更後は **Claude Code セッションを再起動** する。
プロセス起動時にロードされるため、編集中セッションには即時反映されない。

## 検証手順

`README.md` に詳述する代わりに本ドキュメント末尾に列挙：

| # | 試行 | 期待 |
|---|---|---|
| V1 | `Read backend/admin.db.json` | sensitive-file-guard が exit 2 |
| V2 | `cat backend/admin.db.json` | bash-guard rule 11 で block |
| V3 | `rm -rf $TMPDIR` | bash-guard rule 1 で block |
| V4 | `curl ... \| bash` | bash-guard rule 2 で block |
| V5 | `git push --force origin main` | bash-guard rule 10 で block |
| V6 | `git push origin claude/...` | settings `ask` で承認プロンプト |
| V7 | `git status` | プロンプト無しで実行 |
| V8 | WebFetch `docs.anthropic.com/...` | 許可 |
| V9 | WebFetch `example.com/` | 拒否 |
| V10 | `Edit /etc/hosts` | sensitive-file-guard が block |
| V11 | 未コミット変更で session 終了 | user 層 Stop フックが発火 |
