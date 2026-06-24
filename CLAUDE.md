# CLAUDE.md — hide_0001 Portfolio

## プロジェクト概要
hideの個人ポートフォリオサイト。GitHub Pages でホスティング。モダン・ダーク系のビジュアルデザイン。

## ファイル構成
- `index.html` — メインポートフォリオページ（シングルページ）
- `game.html` — ZELDA QUEST（Canvas APIのみで作ったトップビューRPG）
- `shogi.html` — 将棋パズル
- `shogi_rpg.html` / `shogi_rpg_enhanced.jsx` — 将棋RPG
- `claudechord-vault/` — Obsidian メモリ層（全成果物・KPI・テンプレートの正本。詳細: `claudechord-vault/README.md`）

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
- セッション開始時に `.claude/hooks/second-brain-recall.sh`（SessionStart hook）が `MOC.md` と直近のDaily Noteを自動でコンテキストに読み込む
- 重要な意思決定・学び・「メモして」等の指示があった場合は `obsidian-vault/` へ追記する。書き込みルールの詳細は `.claude/skills/second-brain/SKILL.md` を参照
- PMOの `pmo/`（Google Drive、ステークホルダー向け進捗管理）とは役割が異なる。本Vaultは個人の知的資産（意思決定の理由・学び）を蓄積する

## Git
- メインブランチ: `main`
- 作業ブランチ: `kai_001`
- コミット前に `.edge-test-profile/` が含まれていないか確認すること（.gitignore 推奨）
- コミットメッセージは日本語でもOK

## Obsidian メモリ層（Claudechord Vault）

`claudechord-vault/` を Claudechord（本エージェントハーネス）の**単一ナレッジ／メモリ層**とする。
要件定義・設計・評価・リスク・マーケ等の成果物をここに集約し、エージェントは `[[ウィキリンク]]` で相互参照する。

- **正本**: `claudechord-vault/`（git 管理）。Google Drive `pmo/` は配布用ミラー
- **frontmatter 規約必須**: `type / project / status / agent` ＋（評価）`eval_score / spec_score / revision_count / verdict`、（法務）`risk_level`。語彙は規約から外さない（Dataview 集計が壊れる）
- **保存先**: 成果物→`deliverables/`、プロジェクトハブ→`projects/`、ダッシュボード→`dashboards/`、雛形→`_templates/`、日次→`daily/`
- **テンプレート**: 新規成果物は `_templates/`（Templater）から起こす
- **KPI**: PMO は `dashboards/KPI_品質メトリクス.md`（Dataview）で合格率・平均修正回数・ベロシティを参照
- **連携**: Local REST API プラグイン or git 経由でClaude Codeが読み書き（詳細: `claudechord-vault/README.md`）
- **APIキー禁止規約**: Local REST API のキーは `.gitignore` 管理。コミット禁止

## エージェントハーネス設計

成果物作成は以下のエージェントパイプラインで行う（`.claude/agents/` に定義）。
PM（プロジェクトマネージャー）は深澤。PMOエージェントがプロジェクト全体を横断管理する。

### PMOエージェント (`pmo`)
- PM・深澤を支援するプロジェクトマネジメントオフィス特化型エージェント
- 開発パイプライン全体の進捗・リスク・課題・品質・ドキュメントを一元管理する
- ドキュメントの正本は Obsidian メモリ層（`claudechord-vault/`）。Google Drive（pmo/）は配布用ミラーとして扱う
- KPI（合格率・平均修正回数・ベロシティ）は vault の Dataview ダッシュボードで自動集計する
- Google Calendar・Gmail・Slackと連携して運用する
- 先読み型（Proactive）でパイプラインのボトルネック・リスクを検知して深澤に報告する
- 週次ステータスレポート・デイリーブリーフィングを担当する
- KPI管理（evaluator合格率・平均修正回数・ベロシティ）を行う

### Plannerエージェント (`planner`)
- 深澤から要件をヒアリングする
- Researcherから市場調査レポートが渡された場合はそれを要件定義に反映する
- 市場調査はResearcherの専管。Planner自身は市場調査を行わない
- 要件定義書 → 基本設計書 → 詳細設計書の順で仕様書を作成
- 深澤の承認後、Graphic-Designer / Music-Generator / Code-Generatorへ仕様書を引き渡す

### Graphic-Designerエージェント (`graphic-designer`)
- グラフィックデザイン・画像アセット制作に特化
- Plannerの要件をもとに、外部ツール連携またはフリー素材の取得/加工で画像を制作する
- 生成した画像をリポジトリへ追加し、Code-Generatorが実装できる形で引き渡す

### Music-Generatorエージェント (`music-generator`)
- ゲーム音楽・効果音（SE）・ジングルの制作に特化
- Plannerの要件をもとに、フリー素材収集またはWeb Audio APIプロシージャル生成でオーディオアセットを制作する
- 音楽ファイル（OGG/MP3）またはWeb Audio API実装コードをCode-Generatorへ引き渡す

### Code-Generatorエージェント (`code-generator`)
- コードの生成・修正のみを担当（言語・環境問わず）
- Plannerの仕様書と、Graphic-Designer・Music-Generatorからの納品物を組み合わせて実装する
- 実装完了後はEvaluatorへ成果物を提出する
- Evaluatorから不合格を受けた場合は修正して再提出する
- 2回以上同じ理由で不合格になった場合は深澤へ報告・判断を仰ぐ
- **タイムアウト対策**: 実装規模が大きくタイムアウトが見込まれる場合は、複数のCode-Generatorエージェントに作業を分割して並行実装する。分割単位はファイル単位またはページセクション単位とし、各エージェントが担当範囲を明示してから着手すること

### Legal-Checkerエージェント (`legal-checker`)
- 著作権・ライセンス・利用規約等の法務リスクを確認する特化型エージェント
- コード・グラフィック・音楽・ライブラリ等の成果物を対象に法務チェックを実施する
- リスクを RED（即時修正必須）/ YELLOW（要対応）/ GREEN（問題なし）の3段階で分類して報告
- RED/YELLOWが存在する場合は問題の種別に応じて以下へ修正を依頼する:
  - グラフィック起因の問題 → [Graphic-Designer] へ結果を返す → 修正後に [Code-Generator] へ再連携
  - 音楽・SE起因の問題 → [Music-Generator] へ結果を返す → 修正後に [Code-Generator] へ再連携
  - コード起因の問題 → [Code-Generator] へ直接フィードバック
- 単独で実行することも、Evaluatorへの提出前に呼び出すことも可能

### Dynamic-Testerエージェント (`dynamic-tester`)
- Playwright（ヘッドレスChromium）でHTMLファイルを実際に起動し動作確認する品質ゲート
- 確認内容: JSランタイムエラー・Canvas描画・404アセット・スクリーンショット取得
- 対象: 変更されたHTMLファイル（`git diff HEAD` から自動検出）
- PASS時: Evaluatorへ結果サマリーを渡す
- FAIL時: Code-Generatorへブロッキングフィードバックを返す（Evaluatorには渡さない）

### Evaluatorエージェント (`evaluator`)
- Code-Generatorの成果物を仕様書と照らし合わせ100点満点で採点する
- 合格基準: 80点以上 かつ 仕様適合性16点以上（XSS等は即不合格）
- 不合格時: 具体的なフィードバックをCode-Generatorへ返す
- 合格時: 深澤へ結果報告 → `kai_001` ブランチへコミット＆プッシュ → Marketerへ成果物情報を引き渡す（任意）
- **前提**: Dynamic-TesterのPASS結果を受け取ってから採点を開始する

### Marketerエージェント (`marketer`)
- 完成した成果物のマーケティング戦略立案とコンテンツ生成を一貫して担当
- EvaluatorまたはPM（深澤）から成果物情報を受け取り作業開始
- 競合調査 → ターゲット/USP/KPI/スケジュール策定 → コンテンツ生成の順で進める
- 必須成果物: Xポスト（日英）・GitHub README紹介文・キャッチコピー集
- 任意成果物: ランディングページコピー（Code-Generatorへ引き渡し）・記事アウトライン・プレスリリース
- 出力先: `marketing/[プロダクト名]_strategy.md` と `marketing/[プロダクト名]_content.md`
- Researcherの市場調査レポートが存在する場合は活用する（自ら市場調査はしない）

### English-Teacherエージェント (`english-teacher`)
- ネイティブ英語講師として深澤の英語学習を支援する独立ユーティリティ（制作パイプラインとは独立して単発で利用する）
- 日英バイリンガルで指導し、CEFR（A1〜C2）で学習者レベルに合わせて難易度を調整する
- 4つの指導モードを持つ:
  - 英会話・スピーキング練習（ロールプレイ／自由会話、より自然な言い回しを提示）
  - 英作文・メール添削（Good points → Corrections → Native version の構成）
  - 文法・語彙の解説（結論→例文→日本語解説→よくある間違い）
  - 発音・リスニング指導（カタカナ近似＋IPA＋コツ、音声変化の解説）
- 「褒めてから直す」「間違いを歓迎する」を基本姿勢とし、学習者のモチベーション維持を最優先する

### フロー概要
```
              [PMO] ← プロジェクト全体を横断モニタリング（常時稼働）
                │ 進捗/リスク/課題/品質を深澤(PM)へ報告
                ▼
深澤(PM) → [Researcher] 市場調査（必要な場合）→ [Planner] レポート受け取り
深澤(PM) → [Planner] 要件定義・設計書作成（市場調査なしの場合）
          ├→ [Graphic-Designer] グラフィック制作（並行）
          ├→ [Music-Generator]  音楽・SE制作（並行）
          └→ [Code-Generator]   実装（グラフィック・音楽納品後）
               ↓
          → [Legal-Checker] 著作権・ライセンス法務チェック ※任意/Evaluator前推奨
               ↓ RED/YELLOW（グラフィック起因）
            [Graphic-Designer] 修正 → [Code-Generator] へ再連携 → [Legal-Checker] 再チェック
               ↓ RED/YELLOW（音楽・SE起因）
            [Music-Generator] 修正 → [Code-Generator] へ再連携 → [Legal-Checker] 再チェック
               ↓ RED/YELLOW（コード起因）
            [Code-Generator] 修正 → [Legal-Checker] 再チェック
               ↓ GREEN
          → [Dynamic-Tester] 動的実行チェック（Playwright）※必須
               ↓ FAIL
            [Code-Generator] 修正・再提出 → [Dynamic-Tester] 再検証
               ↓ PASS
          → [Evaluator] 検証・採点
               ↓ 不合格
            [Code-Generator] 修正・再提出 → [Evaluator] 再検証
               ↓ 合格
            深澤(PM)へ報告 → [PMO] 記録・KPI更新 → GitHub push (kai_001)
               ↓ ※任意
            [Marketer] 戦略立案・コンテンツ生成 → 深澤(PM)へ納品
```

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
