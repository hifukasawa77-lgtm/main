# Obsidianのローカル保管庫とこのリポジトリを git で双方向同期する

## 前提・制約

Claude Code（クラウド版）は隔離されたLinuxコンテナで動いており、深澤のWindows PC
（`C:\Users\hifuk\...`）のファイルシステムには一切触れられない。そのため、
セッション側からローカルの保管庫へ直接書き込むことはできない。

**gitを介せば双方向にできる**：正本は常に `obsidian-vault/`（このリポジトリ、
`hifukasawa77-lgtm/main`）。ローカルの Obsidian 保管庫はそのcloneのサブフォルダとして開き、
Obsidian Git プラグインで自動 pull/push させる。

## なぜ「保管庫１」フォルダそのものを clone のルートにしないか

ふつうに `git clone` するとゲームアセット込みで **1.3GB**（`docs/クローンを軽くする.md` 参照）。
Obsidianの保管庫にサイト本体（`index.html`・`assets/`等）を丸ごと持ち込む理由が無い。
`--sparse` + `sparse-checkout set obsidian-vault` で **`obsidian-vault/` 配下（72ファイル・約280KB）だけ**
を展開する。

## セットアップ手順（Windows / PowerShell）

### 0. 前提

- Git for Windows インストール済み（`git --version` で確認）
- GitHubに `hifukasawa77-lgtm` でログインでき、このリポジトリへの書き込み権限がある
  （自分のリポジトリなので、初回pushでブラウザ認証すればGit Credential Managerが以後は自動で使う）
- Obsidian インストール済み

### 1. 軽量クローンを保管庫１の中に作る

```powershell
cd "C:\Users\hifuk\OneDrive\ドキュメント\オブシディアン\保管庫１"
git clone --depth 1 --filter=blob:none --sparse https://github.com/hifukasawa77-lgtm/main.git hide_0001-second-brain
cd hide_0001-second-brain
git sparse-checkout set obsidian-vault docs
```

これで `保管庫１\hide_0001-second-brain\obsidian-vault\` 配下に
MOC.md・`01-Daily/`・`02-Projects/`・`03-Decisions/`・`04-Knowledge/`・`Templates/` が展開される。
`docs`（本手順書を含む・288KB）も併せて展開しているので、`obsidian-vault/README.md` からの
リンクがローカルでも解決する。

### 2. Obsidianでフォルダを開く

既に「保管庫１」をObsidianの保管庫として開いている場合、上記の
`hide_0001-second-brain\obsidian-vault\` は**自動的にサブフォルダとして見える**
（保管庫を作り直す必要はない）。`[[ウィキリンク]]`はファイル名で解決されるため、
フォルダの深さが違っても既存ノートとの相互リンクは問題なく機能する。

### 3. Obsidian Git プラグインで自動同期

1. 設定 → コミュニティプラグイン → 「Obsidian Git」を検索してインストール・有効化
2. Obsidian Git の設定で以下を設定する:
   - `Vault backup interval (minutes)`: 例）10
   - `Auto pull interval (minutes)`: 例）10
   - `Push on backup`: オン
3. 初回のみ `hide_0001-second-brain` フォルダ内でGit認証を通す（コマンドパレットから
   `Obsidian Git: Commit and push` を1回手動実行するとブラウザ認証が走る）

### 4. 手元で書いた内容が反映されるタイミング

- 次のClaude Codeセッション開始時、`.claude/hooks/second-brain-recall.sh` は
  **リポジトリにpush済みの内容**しか読めない。ローカルで書いてpushしていない分は見えない
- 運用：ローカルで書いたらObsidian Gitの自動push（上記設定）に任せるか、
  コマンドパレットから `Obsidian Git: Commit and push` を手動実行する

### 5. コンフリクトについて

Claude Code側も同じ `obsidian-vault/` へコミット・pushすることがある。ほぼ全てMarkdownの
追記なので自動マージで解決することが多いが、同じファイルの同じ行を双方が編集した場合は
コンフリクトマーカー（`<<<<<<<` 等）が入る。該当ファイルを開いて手で解消し、
再度コミット・pushする。

### 6. OneDriveとの相性についての注意

保管庫１がOneDrive配下にあるため、gitが `.git` 内部ファイルを書き換えている最中に
OneDriveが同時にアップロードしようとして、まれに `ファイルが使用中です` 等のエラーが出ることがある。
発生したら数秒待って同じ操作をやり直せば通ることが多い。頻発する場合は、
clone自体をOneDrive配下から外し（例: `C:\Users\hifuk\git\hide_0001-second-brain`）、
Obsidianの「もう一つの保管庫を開く」で追加の保管庫として開く方法に切り替えるとよい
（この場合、保管庫１本体とは別のObsidianウィンドウ／保管庫になる）。

## 確認・トラブル時のコマンド

```powershell
git status              # 未コミットの変更を確認
git pull                # リモートの最新を取り込む
git add -A
git commit -m "メモ更新"
git push
git sparse-checkout list   # いま展開しているフォルダの確認
```

## 禁止事項（再掲）

- APIキー・パスワード等の機微情報は書かない（このリポジトリは公開リポジトリ）
