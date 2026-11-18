# ZERO-1（PC版）実機検証 手順書・記録票

対象リポジトリ: `hifukasawa77-lgtm/zero-1-local-ai`
実施場所: **Windows 実機**（Ollama が動く PC）
状態: **未実施**（下の「記録欄」はすべて空欄。実測するまで埋めない）

> この手順書は、実リポジトリを取り込めないクラウドセッションで作った。
> コマンド名は依頼文に書かれていたものを写しただけで、`package.json` で存在を確認していない。
> 実行前に `npm run` で一覧を見て、名前が違えばその場で直し、記録欄に実際に使ったコマンドを書くこと。

## 0. 共通ルール（全作業）

- main へ直接 push しない・force push しない・マージしない・既存PRを閉じない。
- **`ollama pull` をしない**。入っているモデルだけで測る。足りない物は「未測定」と書き、取得が必要なら理由と容量を添えて深澤さんの承認を待つ。
- 有料API・鍵は使わない。結果にモデル出力の全文・個人情報・鍵を貼らない（成功/失敗の分類と短い抜粋だけ）。
- モック結果を実モデルの結果として書かない。測れない物は BLOCKED/SKIP＋理由。
- **FAIL/BLOCKED が出たら、その先の危険な操作（5のバックアップ復元など）へ進まない**。
- 評価対象ファイル・今のデータは無断で変更しない。
- セルフホストランナーは登録しない（承認待ち）。

### 判定の語
PASS＝期待どおり／FAIL＝動いたが期待と違う／SKIP＝やらないと決めた（理由必須）／BLOCKED＝前提が足りず実行できない（理由必須）

## 1. 作業ブランチと枝の取り込み

```bash
git fetch origin
git switch -c claude/pc-real-model-eval-20261118 origin/main
```

未マージPRの枝は**マージせず**、参照用 worktree で取る（ブランチを汚さない）:

```bash
git fetch origin claude/dev-bench-more-tasks claude/rag-eval-selfcontained claude/memory-retrieval-eval claude/zero-1-ci-pr-integration-l95lnw claude/ci-local-kill-process-tree-20261118
git worktree add ../z1-wt-bench   origin/claude/dev-bench-more-tasks            # #213 Operator 20課題
git worktree add ../z1-wt-memory  origin/claude/memory-retrieval-eval          # #227+#228 検索評価
git worktree add ../z1-wt-ci      origin/claude/ci-local-kill-process-tree-20261118  # #235+#236 ローカルCI
```

- 各枝を作業ブランチへ試しに載せる場合も `git merge --no-commit` までで、コミットはドキュメント更新だけにする。
- 各 worktree で `npm ci --ignore-scripts` を実行する（要 Node。バージョンを記録）。
- 読む文書: 各枝の `docs/operator-20task-real-model-benchmark.md` / `docs/knowledge-hub-search-benchmark.md` / `docs/long-term-memory-search-benchmark.md` / `docs/実機検証-記録票.md`、および main の `CLAUDE.md`・`docs/開発の注意.md`。

## 2. 作業 1: 診断（読み取りのみ）

```bash
npm run install:check
ollama list
```
追加で記録: OS（`winver`）、`node -v`、`ollama --version`、搭載メモリ、GPU名とVRAM、書き込み先ドライブの空き容量。

止める条件: `install:check` が FAIL → 原因を記録し、2以降は「診断FAIL」を明記してから続行可否を深澤さんに確認。

## 3. 作業 2: Operator 20課題の実モデル評価（#213 の worktree で）

```bash
npm run bench:dev:preflight
npm run bench:dev:validate
npm run bench:dev            # 入っているモデルを1つ選ぶ
npm run bench:dev:compare    # 複数モデルがあるときだけ
```
- 評価対象ファイルを変更しない。`git status` が実行前後で同じことを確認。
- 記録: 成功数/20、課題ごとの応答時間（中央値・最大）、失敗原因の分類（例: 形式違反／誤答／タイムアウト／ツール失敗）、実行中のピーク RAM / VRAM（タスクマネージャーかテレメトリ）。
- 止める条件: preflight/validate が FAIL なら `bench:dev` へ進まない。

## 4. 作業 3: 検索評価の意味検索比較（#227/#228 の worktree で）

埋め込みモデルが `ollama list` に**あるか先に確認**。無ければ **BLOCKED** と書き、取得が必要な旨（モデル名・容量・理由）を深澤さんへ出して止める（pull しない）。

```bash
node scripts/eval-knowledge-retrieval.mjs --embed <入っている埋め込みモデル名>
node scripts/eval-memory-retrieval.mjs   --embed <同上>     # --embed の有無は枝の文書で確認
```
- 比較基準（クラウド側・自己完結評価の再現値）: Knowledge Hub 1位 **17/32（53%）**、長期記憶 1位 **12/25（48%）**。
- **この題を見て検索ルールを調整しない**。調整したくなったら「新しい題を作る」と記録して別作業にする。
- 記録: 1位正解数／全体、上位N件内、実行時間、埋め込みモデル名。

## 5. 作業 4: Windows 実機で `npm run ci:local`（#235/#236 の worktree で）

```bash
npm run ci:local     # 1回目
npm run ci:local     # 2回目（再現確認）
```
確認項目:
1. 全工程の PASS/FAIL（Linux クラウドでは 9 工程 PASS だった）。
2. パスの区切り・スペース/日本語を含むパスで動くか。
3. python の切替（`python` / `py` どちらが使われたか、無い場合の挙動）。
4. **タイムアウト時に孫プロセスが残らない**（#236 の taskkill 経路）: 短いタイムアウトを設定して強制的に発火させ、前後で `tasklist | findstr node` 等のプロセス数を比べる。
5. **Ctrl+C で停止**し、残プロセスが無いこと。
6. 2回の結果が一致するか（工程ごと）。
- 止める条件: 残プロセスが出た場合は手動で終了し、FAIL として記録。以降の作業へ進む前に深澤さんへ報告。

## 6. 作業 5: バックアップ・復元（Windows。今のデータには書かない）

```bash
npm run backup
mkdir <空の検証用フォルダ>          # 例: %TEMP%\z1-restore-check
npm run backup:restore -- <zipのパス> --to <空の検証用フォルダ>
```
- 復元先は**必ず新規の空フォルダ**。既存データのフォルダを指定しない。
- 復元後、ファイル数・サイズ・ハッシュ（`Get-FileHash`）を元と比較。
- 未達項目（docs/backup-restore-final-verification.md）を**検証用フォルダだけで**確認:
  - 権限不足: 検証用フォルダに書き込み拒否（`icacls <dir> /deny %USERNAME%:W`）を付けて復元 → エラー内容と、元データが無傷なこと。終わったら `icacls <dir> /remove:d %USERNAME%`。
  - 容量切れ: 小さな検証用 VHD／空き僅少のドライブがある場合のみ。**無ければ SKIP**（無理に作らない）。
  - 強制終了: 復元中にプロセスを終了 → 中途半端なファイルの扱い、再実行できるか、元データが無傷か。
- 止める条件: 元データのハッシュが変わったら即中止し FAIL 報告。

## 7. 作業 6（任意・承認があるときだけ）

```bash
npm run measure
```
承認が無ければ **SKIP（承認未取得）**。

## 8. 記録欄（実測後に埋める。空欄＝未実施）

### 環境
| 項目 | 値 |
|---|---|
| OS |  |
| Node |  |
| Ollama |  |
| モデル（`ollama list`） |  |
| 埋め込みモデル |  |
| RAM / GPU / VRAM |  |
| 空き容量 |  |
| 実施日・実施者 |  |

### 結果
| # | 作業 | 判定 | 実行コマンド | 所要時間 | 失敗原因・メモ |
|---|---|---|---|---|---|
| 1 | 診断 |  |  |  |  |
| 2 | Operator 20課題 |  |  |  | 成功 /20、応答時間、RAM/VRAM |
| 3a | Knowledge Hub 意味検索 |  |  |  | 1位 /32（基準 17/32） |
| 3b | 長期記憶 意味検索 |  |  |  | 1位 /25（基準 12/25） |
| 4 | ci:local 1回目 |  |  |  | 工程別 |
| 4 | ci:local 2回目 |  |  |  | 再現: |
| 4 | 孫プロセス（taskkill） |  |  |  |  |
| 4 | Ctrl+C |  |  |  |  |
| 5 | backup → restore |  |  |  | ハッシュ照合: |
| 5 | 権限不足 |  |  |  |  |
| 5 | 容量切れ |  |  |  |  |
| 5 | 強制終了 |  |  |  |  |
| 6 | measure |  |  |  |  |

## 9. 記録の反映先と Draft PR

- 実測値は既存の該当欄を更新する: `docs/operator-20task-real-model-benchmark.md`、`docs/knowledge-hub-search-benchmark.md`、`docs/long-term-memory-search-benchmark.md`、`docs/実機検証-記録票.md`、`docs/backup-restore-final-verification.md`。
- 作業ブランチ `claude/pc-real-model-eval-20261118` へコミットし push。**Draft PR** を作る。本文: 目的／変更（ドキュメントのみ）／テスト結果／実機検証結果（上の表）／ロールバック（`git revert` またはブランチ削除。実データは変更していない）。
- 後片付け: `git worktree remove ../z1-wt-*`、検証用フォルダの削除、`icacls` の拒否設定の解除。
