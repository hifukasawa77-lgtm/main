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
- 検査スクリプトは**自身が検出パターン文字列を含む**ため自己誤検出する。grep対象から自スクリプトを除外する。

## セカンドブレイン運用
- recall hook は直近Dailyを**全文**投入する。Dailyに大量追記すると毎セッションのコンテキストを圧迫する。再利用可能な学びは Daily に溜めず `04-Knowledge/` へ昇格し（索引で常時surface・コンパクト）、Daily は1行サマリー＋ADR/知見へのリンクに圧縮する。

---
> ♻️ **昇格済み（2026-07-01, /self-improve）**: 「ドリフト」「スキル定義」「hook 2段ゲート」は `harness-lint.sh` 検査#1〜#5で機械強制済み（[[0007-harness-lint-automation]] / [[0008-value-drift-lint]]）。「bash罠」は `/self-improve` 手順0の追記注意へ、「セカンドブレイン運用（Daily圧縮）」は `second-brain/SKILL.md` 書式ルールへ反映済み（[[0009-daily-hygiene-rule]]）。
