---
type: knowledge
tags: [knowledge, harness, self-improve, maintenance]
related: ["[[recursive-self-improvement]]", "[[0004-code-generator-color-scheme-align]]", "[[0005-billing-guard-matcher-sync]]", "[[0006-activate-orphaned-skills]]", "[[0007-harness-lint-automation]]"]
---

# ハーネス保守のパターン・ハマりどころ

`.claude/`（エージェント定義・スキル・フック・settings.json）を保守する際の再利用可能な教訓。機械検査は `bash .claude/skills/self-improve/harness-lint.sh` で一括実行できる。

## ドリフト（CLAUDE.mdとの不整合）
- **色ドリフトは3層すべてに出る**: コード / エージェント定義 / スキルのいずれにも、CLAUDE.md禁止の「ネオングロウ過多・マゼンタ #ff00ff・原色ネオン」が紛れ込む（code-generator → planner → design で実際に3度発生）。CLAUDE.mdの色ルールは全層に波及する前提で grep 横串点検する。
- **具体値は重複させない**: カラーコード・閾値・ブランチ名などCLAUDE.mdに正がある値をエージェント定義/スキルに重複記述すると必ずドリフトする。正は1箇所（CLAUDE.md）に集約し、各定義は「CLAUDE.md準拠」と参照させる。
- 同種ドリフトは1箇所直すと他にも潜んでいる。1件見つけたら必ず横串で全件を grep する。
- **色以外の具体値ドリフトも機械検査済み（2026-06-30, 9th）**: 予算上限（budget.md `MONTHLY_LIMIT` が正）/ Evaluator合格閾値（CLAUDE.md 80・16点が正）/ 作業ブランチ（CLAUDE.md `kai_001` が正）を `harness-lint.sh` 検査#5が正の単一ソースから導出して再掲先と突き合わせる。→ [[0008-value-drift-lint]]

## スキル定義
- スキルは **ファイル名が厳密に `SKILL.md`** かつ **frontmatter（1行目`---`・`name:`・`description:`・閉じ`---`）** が必須。どちらかを欠くとサイレントにロードされず死蔵される（`Skills.md` のまま5スキルが死んでいた実例）。
- `name` はディレクトリ名に合わせる。invocation 精度は `description` が決めるので、内容・使用タイミングを具体的に書く。

## フック（PreToolUse）の2段ゲート
- PreToolUse は「**settings.json の matcher**（hook起動の外側ゲート）」→「**スクリプト内判定**」の2段。matcher にマッチしないツールはスクリプトすら走らない。
- よって matcher はスクリプト内の判定リスト（例: `accounting-guard.sh` の `BILLING_RISK_TOOLS`）の**上位集合**でなければ判定が死ぬ。最も安全なのは両者を同一文字列に保つこと。課金ガードは「監視表 / BILLING_RISK_TOOLS / matcher」の3箇所同期。

## bash 検査スクリプトの罠
- `grep ... | while read; do FAIL=1; done` はパイプ右辺が**サブシェル**で動くため、ループ内で立てたフラグが親シェルに伝播しない（exit 0 のままになる）。集計フラグを使うなら `while ...; done <<< "$VAR"`（here-string）で回す。
- 検査スクリプトは**自身が検出パターン文字列を含む**ため自己誤検出する。grep対象から自スクリプトを除外する。パターンをコメントで説明した**他ファイルのコメント行**も誤検出するため、コメント行（`:番号:` の後が `#`）も除外する。
- **grep のBRE（デフォルト）で `\+` はGNU拡張の「1回以上」量指定子**になる。`grep -v '^\+\+\+'`（diffヘッダ除外のつもり）が `+` で始まる全行を除外し、検査が空振りする（release-check #2の実例、2026-07-13）。diff処理のgrepは必ず `-E` で書く。また「`^\+[^+].*パターン`」の1段regexは**行頭直書きの追加行**（`+console.log…`）を取りこぼす—`[^+]`が先頭文字を消費するため。ヘッダ除外（`grep -Ev '^\+\+\+'`）とパターン検索は分離する。
- **pipefail 下の `cmd | grep -q` は左辺がSIGPIPEで死ぬ**: `grep -q` は最初のマッチで即exitしパイプを閉じるため、まだ書き込み中の左辺（`git show` 等）が SIGPIPE(141) で終了し、`set -o pipefail` だとパイプライン全体が偽になる。出力が短いと再現せず**出力量の多い入力だけ落ちる**確率的バグになる（harness-lint 検査#9で変更ファイル数の多いコミットだけ判定漏れした実例、2026-07-17）。対策: 左辺を先に変数へ受けてから `grep -q <<< "$VAR"` する。
- **C locale では多バイト文字のブラケット表現が必ず空振りする**: この環境は `LANG` 未設定＝C locale のため、`grep -oE '毎週[月火水木金土日]曜'` のような**多バイト文字を含む `[...]`** はバイト単位比較になりマッチしない（harness-lint 検査#11の初回実装が全行抽出できず △ を出した実例、2026-07-25）。日本語を検査パターンに使うときは「リテラル文字列」か「`[^ ]` `[^|]` のような**単バイトの否定クラス**」の形にする（`毎週[^ ]*曜` は安全）。同様に `{2}` 等の量指定子より `[0-9][0-9]` の方が移植性が高い。
- **`cmd | python3 - <<'PY'` はヒアドキュメントがパイプを上書きしてstdinを奪う**: python本体をstdin（`-`）から読ませているため、パイプで流したデータは `sys.stdin` に届かず**空**になる。エラーは出ず「対象0件」として正常終了するので、**perf-audit が「0ページ計測・1MB超過0件 ✅」を出し続けていた**（2026-07-28に発見。実測すると95ページ・8件超過、index.html は22.9MB）。データは環境変数か argv で渡す。
- **PCREの `\x{...}` は `(*UTF)` 無しでC localeだと全行エラーになる**: `grep -cP '[\x{3040}-\x{30ff}]'` は "character code point value in \x{} or \o{} is too large" を吐き、`grep -c` の結果は **0**（＝「該当なし」と区別できない）。i18n-check の日本語判定が常に0になり [warn] の出方が静かに狂っていた（2026-07-28）。パターン先頭に `(*UTF)` を付ける。上の「多バイトブラケット表現」と同根の locale 問題。
- **監査スクリプトの故障は "✗" ではなく "✓" として現れる**: 上の2件はどちらも「検査対象が0件」に落ちるため合格側に倒れた。対策は①**計測対象0件を成功にしない**（明示的に異常終了させる）②外部コマンドのエラー出力を `|| true` で握りつぶさない③新規検査には必ず**負のテスト**。→ harness-lint 検査#14で静的検出（[[0022-routine-trace-marker-and-save-data-reconciliation]]）。
- **mtimeはフレッシュクローン環境で信用できない**: CCRリモート環境はコンテナ起動時にクローンするため全ファイルのmtimeがほぼ同一になる。`ls -t`（最新選択）は不定に、`find -newermt`（期間内判定）は全件マッチになる（recall hookの直近Daily誤選択・kpi-reportの全件カウントの実例、2026-07-09）。日付はファイル名（`YYYY-MM-DD.md`）に持たせて**名前で比較**する。→ harness-lint 検査#7で機械検査済み。

## lint検査の2段重大度（✗ / △）
- 機械検査には2種類ある: **✗（ブロッキング）＝ハーネスの破損・不整合**（frontmatter欠落・ゲート非同期・ドリフト。即是正、CIも失敗させる）と、**△（警告・exit codeに影響しない）＝ワークフローのリマインド**（未昇格の学びDaily等）。
- 「発生直後は正常で、後続の人間+LLM作業で解消される状態」をブロッキングにすると、正規フロー（Dailyを書く→後日 /self-improve で昇格）のたびにlint/CIが赤くなる誤設計になる。判断を機械で下せない検査は△に留め、/self-improve 手順0で列挙→手順1で点検する（[[0015-unpromoted-learning-lint]] の実例）。
- △検査はマーカー規約（`昇格済み`/`反映済み`/`昇格しない`）とセットで初めて成立する。規約側は second-brain スキルの書式ルールで保守する。

## セカンドブレイン運用
- recall hook は直近Dailyを**全文**投入する。Dailyに大量追記すると毎セッションのコンテキストを圧迫する。再利用可能な学びは Daily に溜めず `04-Knowledge/` へ昇格し（索引で常時surface・コンパクト）、Daily は1行サマリー＋ADR/知見へのリンクに圧縮する。

---
> ♻️ **昇格済み（2026-07-01, /self-improve）**: 「ドリフト」「スキル定義」「hook 2段ゲート」は `harness-lint.sh` 検査#1〜#5で機械強制済み（[[0007-harness-lint-automation]] / [[0008-value-drift-lint]]）。「bash罠」は `/self-improve` 手順0の追記注意へ、「セカンドブレイン運用（Daily圧縮）」は `second-brain/SKILL.md` 書式ルールへ反映済み（[[0009-daily-hygiene-rule]]）。
