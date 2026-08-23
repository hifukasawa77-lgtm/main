# local-agent

Ollamaで動くローカルLLMを頭脳にした、ツール実行型の汎用タスクエージェント（Claude Code的なものの最小実装）。
外部APIなし・npm依存パッケージなし。Node.js 18+の組み込み `fetch` だけで動く。

## 前提

- [Ollama](https://ollama.com/) がインストール済みで `ollama serve` が起動していること（通常はインストール時に常駐サービス化される）
- ツール呼び出し（function calling）に対応したモデルを1つ以上pull済みであること
  - `ollama list` で `capabilities` に `tools` が含まれるか確認できる（`ollama show <model>` でも可）。
    ただし**`capabilities` に `tools` があっても実際にOllamaの `tool_calls` 形式で返すとは限らない**
    （下記の実測結果を参照）。乗り換える前に一度 `/api/chat` を直接叩いて確認すること
  - 推奨: `qwen2.5`（7.6B・4.7GB・応答速度と精度のバランスが良く、`tool_calls` を確実に返す）
  - `llama3.2`（3.2B・2GB）はより高速だが精度は落ちる。`gemma4:26b`（17GB）は内蔵GPUのみのCPU推論だと非常に遅くなりやすい

## 使い方

```bash
cd local-agent
node agent.js                                    # 対話モード（rootは実行時のcwd）
node agent.js "hello.txt を作って今日の日付を書いて"  # ワンショット実行
node agent.js --model=llama3.2 --root=../         # モデル/作業ディレクトリを指定
node agent.js --temperature=0.1 --num-ctx=16384   # サンプリング設定を上書き
node agent.js --session=myproj                    # 会話を保存し、次回同名で再開できる
node agent.js --skip-tool-check                   # 起動時のtool calling自己診断をスキップ（起動を少し速くする）
```

対話モードは `exit` または Ctrl+C で終了。

## コード生成の精度を上げるための工夫

- **`num_ctx` を既定8192に明示指定**（Ollamaの生API既定は2048）。ツール実行でファイル内容や
  grep結果を積むとすぐ溢れ、超過分は黙って切り詰められる。溢れるとシステムプロンプトごと
  失われうるため、コーディング用途では必須。モデルが対応する最大値に応じて `--num-ctx` で
  さらに広げてよい（値を上げるほどVRAM/メモリ消費が増える）
- **`temperature` を既定0.2に下げている**（Ollama既定は0.8前後）。コード生成は決定的な方が
  存在しないAPIの捏造や無意味な変種を出しにくい
- **`write_file` / `edit_file` の直後に構文チェックを自動実行**し、結果をツール応答へ付記する
  （JS/MJS/CJS: `node --check`、JSON: `JSON.parse`）。例外もエラーも出さずに壊れたコードを
  「完了」と報告するのを防ぐため、エラーがあればモデルが同じターン内で読み取って直せるように
  している。Pythonなど他言語の構文チェックは未対応（`py_compile` 等を使う環境がある場合は
  `lib/tools.js` の `verifySyntax` に追加できる）
- **システムプロンプトで「推測実装の禁止」を明示**。存在しないAPI・関数名を使う前に
  `read_file` / `grep` / `list_dir` で実在確認すること、既存ファイルは `write_file`（全文上書き）
  でなく `edit_file`（最小差分）を使うことを指示している
- **モデル選定は「コード特化＝高精度」と決めつけず、必ず `tool_calls` の実挙動を確認すること**。
  ローカルに入っていた `qwen2.5-coder:3b`（tools capability あり）を既定にしてみたところ、
  `/api/chat` に `tools` を渡しても `tool_calls` を返さず、
  `{"name": "read_file", "arguments": {...}}` という**JSON文字列をそのまま `content` に**
  書いてしまい、このエージェントのツール実行ループが一切発火しなかった（`ollama show` の
  `capabilities: tools` はテンプレートにtool構文があることを示すだけで、実際に安定して
  使われる保証ではない）。同条件で `qwen2.5`（既定モデル）は正しく `tool_calls` を返した。
  そのため既定は `qwen2.5` のまま据え置いている
- **起動時に `tool_calls` の実挙動を自動診断する**。上記の事故を毎回手動確認しなくて済むよう、
  起動直後にダミーツール1個で軽い一往復を行い、`message.tool_calls` が実際に入るか検証する
  （`--model=` で別モデルへ切り替えた時に効く）。失敗した場合は警告を出し、続行するか確認を
  求める。ネットワークエラー等で判定不能な場合はブロックせず「確認できませんでした」として続行
  する。チェック自体をスキップしたい場合は `--skip-tool-check`
- **root直下の `AGENTS.md` / `CLAUDE.md`（この順で先に見つかった方）を自動でシステムプロンプトへ
  混ぜる**。プロジェクト固有の規約・命名ルール・禁止事項をモデルに読ませることで、
  「推測実装の禁止」ルールがより具体的に効くようになる（先頭 4000 文字まで、超過分は切り捨て）

## 安全設計

- **サンドボックスroot**: `read_file` / `write_file` / `edit_file` / `list_dir` / `grep` は `--root`（既定: カレントディレクトリ）配下の相対パスのみに制限される。`../` 等でrootの外へ出ようとするとエラーになる（`lib/sandbox.js` の `resolveSafe`）
- **確認ゲート**: `write_file` / `edit_file` / `run_shell` はモデルが呼び出しを決めても即実行されず、実行前に内容を表示してターミナルで `y/N` 確認を求める。`read_file` / `list_dir` / `grep` は読み取り専用なので確認なしで実行する
  - `edit_file` の確認画面は生の文字列比較ではなく行単位のdiff（`lib/diff.js`、削除行を赤、追加行を緑）で表示する
  - `run_shell` は確認前に `assessShellCommand()`（`lib/sandbox.js`）で「破壊的コマンドのパターン一致」「root外を指す可能性のあるパストークン」を粗くチェックし、該当すればコマンドの表示前に警告バナーを出す。**これは文字列パターンによる警告にすぎず、`resolveSafe` のような機械的な遮断ではない**（シェル文字列の完全なパース・サンドボックス化はスコープ外）。危険と判定された場合のみ、確認は `y` ではなく `yes` と全部入力しないと通らない
- **反復上限**: 1ターンあたり最大25回のツール呼び出しで強制打ち切り（無限ループ防止）
- **シェルタイムアウト**: `run_shell` は60秒でタイムアウト
- **tool_call引数のJSONパースはtry/catch内で行う**: モデルが壊れたJSONを返しても、エージェント全体がクラッシュせずエラーとしてモデルへフィードバックされ、次のターンで自己修正できる

## 構成

| ファイル | 役割 |
|---|---|
| `agent.js` | CLIエントリポイント、エージェンティックループ、確認ゲート、tool_calling自己診断、プロジェクト規約読み込み、セッション保存/再開 |
| `lib/ollama.js` | Ollama `/api/chat` の薄いラッパー（tool calling対応） |
| `lib/tools.js` | ツール定義（JSON Schema）と実装（read_file/write_file/edit_file/list_dir/grep/run_shell） |
| `lib/sandbox.js` | root外へのパス脱出を防ぐガード、run_shellの簡易危険度チェック |
| `lib/diff.js` | 依存なしの行diff（`edit_file`の確認画面表示用） |

## セッションの保存/再開

`--session=<名前>` を付けると、会話履歴を `local-agent/.sessions/<名前>.json` へ都度保存し、
同じ名前で次回起動した際に読み込んで続きから再開する（root や規約ファイルの内容が変わっていた
場合はシステムプロンプトだけ都度最新化する）。`.sessions/` はファイル内容やコマンド出力を含み
うるため `.gitignore` 済み。名前にパス区切り文字（`/` や `\`）は使えない。

## 既知の制限（MVP）

- ストリーミング非対応（`stream:false` 固定。tool_callsの確定を優先）
- `--session=` を付けない場合、会話履歴はメモリ上のみでプロセス終了で消える
- `run_shell` の危険度チェックはあくまで文字列パターンによる警告であり、コマンド内容を実際に
  サンドボックス内へ閉じ込めているわけではない。最終判断は確認画面の表示内容をよく読んでから行うこと
