# CLAUDE.md — hide_0001 Portfolio

## プロジェクト概要
hideの個人ポートフォリオサイト。GitHub Pages でホスティング。モダン・ダーク系のビジュアルデザイン。

## ファイル構成
- `index.html` — メインポートフォリオページ（シングルページ）
- `game.html` — ZELDA QUEST（Canvas APIのみで作ったトップビューRPG）
- `shogi.html` — 将棋パズル
- `shogi_rpg.html` / `shogi_rpg_enhanced.jsx` — 将棋RPG

## デザイン・スタイルのルール
- カラースキーム: 黒背景 + アクセントカラー（シアン / パープル系）※サイバーパンク的演出は使用禁止
- スタイル: Glassmorphism カード、アニメーションパーティクル背景（Canvas API）
- UIは日英バイリンガル表記
- 既存のビジュアルスタイルを壊さないこと
- **禁止**: サイバーパンクテーマ（ネオングロウ過多、SF都市風演出など）

## コーディング方針
- フレームワーク不使用。素のHTML / CSS / JavaScript（Canvas API）を優先
- ライブラリを追加する場合はCDN経由、ビルドツール不使用
- ゲーム系はCanvas APIのみで完結させる方針

## GameKit（ゲーム制作フレームワーク）
- 新規ゲームは `gamekit/gamekit.js`（自作マイクロエンジン）を土台にする。ループ・入力・衝突・SFX・パーティクル・Glassmorphism UI・セーブを提供（詳細: `gamekit/README.md`）
- スターター: `gamekit/template.html` をリポジトリ直下にコピーして開始する
- `/new-game` スキルでエージェントパイプライン一式（仕様→アセット→実装→テスト→採点）を起動できる
- 画像生成はAPIキー不要のMCPコネクタ（Adobe / Canva / Figma）またはプロシージャル生成を使う（`.claude/agents/graphic-designer.md` 参照）

## Obsidian 第二の脳（セカンドブレイン）
- `obsidian-vault/` をClaude Codeの永続メモリとして運用する（Obsidian互換のMarkdown Vault）
- セッション開始時に `.claude/hooks/second-brain-recall.sh`（SessionStart hook）が `MOC.md`・知見クイックインデックス（`04-Knowledge/`）・直近のDaily Noteを自動でコンテキストに読み込む
- 重要な意思決定・学び・「メモして」等の指示があった場合は `obsidian-vault/` へ追記する。書き込みルールの詳細は `.claude/skills/second-brain/SKILL.md` を参照
- **再帰的自己改善ループ**: 蓄積（`/second-brain`）→ 想起（recall hook）→ 反映（`/self-improve`）の閉ループで運用する。セッションの区切りや同種のミス再発時は `/self-improve` で、Vaultの学びを最も狭く効く宛先（該当エージェント定義 / CLAUDE.md / スキル / フック）へ昇格させる。詳細は `.claude/skills/self-improve/SKILL.md`
- PMOの `pmo/`（Google Drive、ステークホルダー向け進捗管理）とは役割が異なる。本Vaultは個人の知的資産（意思決定の理由・学び）を蓄積する

## Git
- メインブランチ: `main`
- 作業ブランチ: `kai_001`
- コミット前に `.edge-test-profile/` が含まれていないか確認すること（.gitignore 推奨）
- コミットメッセージは日本語でもOK

## エージェントハーネス設計

成果物作成は `.claude/agents/` 定義のエージェントパイプラインで行う。PM（プロジェクトマネージャー）は深澤。
**各エージェントの役割・手順の正（詳細）は各 `.claude/agents/*.md`**。本ファイルには再掲しない（コンテキスト節約。要約はAgentツールのdescriptionとして常時ロード済み）。

### パイプライン概要
- 横断常時稼働: **PMO**（進捗/リスク/品質/KPIを一元管理し深澤へ報告）、**Accounting**（課金リスク監視。`.claude/hooks/accounting-guard.sh` PreToolUse hookが実行前に検知して承認要求、月次累計が予算上限（¥5,000）超過見込みはブロック。台帳: `accounting/budget.md`・`ledger.md`。大前提は課金ゼロの維持）
- 制作フロー: 深澤(PM) →（必要時 **Researcher** 市場調査 ※市場調査はResearcher専管）→ **Planner** 要件定義〜詳細設計 → **Graphic-Designer** / **Music-Generator** 並行アセット制作 → **Code-Generator** 実装 →（推奨 **Legal-Checker** 法務チェック: RED/YELLOWは起因エージェントへ差し戻し→修正→再チェック）→ **Dynamic-Tester** Playwright動的検証 ※必須。FAILはCode-Generatorへ差し戻し → **Evaluator** 採点 → 合格: 深澤へ報告 → PMO記録 → `kai_001` へpush →（任意 **Marketer** 戦略・コンテンツ生成）
- **Evaluator合格基準**: 80点以上 かつ 仕様適合性16点以上（XSS等は即不合格）。Dynamic-TesterのPASS後に採点開始
- **English-Teacher** は制作パイプラインから独立した英語学習ユーティリティ

### メインセッション側の運用ルール（サブエージェント委任時）
- **タイムアウト対策**: 実装規模が大きい場合は複数のCode-Generatorへファイル単位/ページセクション単位で分割し並行実装する（各エージェントが担当範囲を明示してから着手）
- **エージェント停止時の引き継ぎ**: サブエージェント停止＝作業消失と即断しない。まずディスク上の成果物ファイル実体を確認し、メイン側が残作業（テスト・修正）を引き継ぐ。上限リスクが高い局面では後続の品質ゲートをエージェント追加起動せずインライン実行に切り替えてよい
- Code-Generatorが2回以上同じ理由で不合格になった場合は深澤へ報告・判断を仰ぐ

## 注意事項
- `.edge-test-profile/` はMicrosoft Edgeのブラウザデータ。gitignoreすること
- `shogi_rpg_enhanced.jsx` はJSX形式だがビルド環境なし。取り扱い注意

## APIキーに関する禁止事項（必ず守ること）
- **有料APIキーを環境変数・設定ファイル・コードに設定・記述することを禁止**
  - 禁止対象例: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` 等
- Claude Codeのセッション認証はOAuth経由のみで行い、APIキーは使用しない
- `.env` ファイルや `config.json` 等にAPIキーを書いた場合は即時削除し、gitにコミットしないこと
- APIキーが誤ってコミットされた場合は、該当キーを即座に無効化（revoke）すること

## コンテキスト節約のルール（必ず守ること）

### ファイル読み込みの基本原則
- **Read前に必ず grep/find** で対象行番号を特定する
- **Read には offset + limit を必ず指定**（全体読み込み禁止）
  - 上限: 対象行の前後200行（index.html等は前後50行）
- `.claudeignore` 記載ファイルは Read 禁止。grep + offset/limit のみ許可

### エージェント間のデータ受け渡し
- **Code-Generator** へは変更箇所のみを渡す（ファイル全体を渡さない）
  - 形式: 「ファイルXのY行目付近をEdit toolで以下に変更」
- **Evaluator** は `git diff HEAD` で確認する（変更ファイルの全体再読み込み禁止）
  ```bash
  git diff HEAD        # 未コミット変更確認
  git diff HEAD~1 HEAD # 直前コミットの確認
  ```
- エージェント間のコードブロックにファイル全体を貼ることを禁止

### Code-Generator の出力形式
- コードは **変更箇所スニペット（前後10行含む）** で出力する
- ファイル全体出力は禁止（「省略なし」ルールより本ルールを優先）

### プランファイルの管理
- 完了タスクは詳細を削除し1行サマリーに置き換える
- プランファイルは「現在未完了のタスク」のみ保持する
