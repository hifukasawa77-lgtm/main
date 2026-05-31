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

## Git
- メインブランチ: `main`
- 作業ブランチ: `kai_001`
- コミット前に `.edge-test-profile/` が含まれていないか確認すること（.gitignore 推奨）
- コミットメッセージは日本語でもOK

## エージェントハーネス設計

成果物作成は以下のエージェントパイプラインで行う（`.claude/agents/` に定義）。
PM（プロジェクトマネージャー）は深澤。PMOエージェントがプロジェクト全体を横断管理する。

### PMOエージェント (`pmo`)
- PM・深澤を支援するプロジェクトマネジメントオフィス特化型エージェント
- 開発パイプライン全体の進捗・リスク・課題・品質・ドキュメントを一元管理する
- Google Drive（pmo/）・Google Calendar・Gmail・Slackと連携して運用する
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
- RED/YELLOWが存在する場合は該当エージェント（Code-Generator / Graphic-Designer / Music-Generator）へ修正を依頼する
- 単独で実行することも、Evaluatorへの提出前に呼び出すことも可能

### Evaluatorエージェント (`evaluator`)
- Code-Generatorの成果物を仕様書と照らし合わせ100点満点で採点する
- 合格基準: 80点以上 かつ 仕様適合性16点以上（XSS等は即不合格）
- 不合格時: 具体的なフィードバックをCode-Generatorへ返す
- 合格時: 深澤へ結果報告 → `kai_001` ブランチへコミット＆プッシュ

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
               ↓ RED/YELLOW
            [該当エージェント] 修正 → [Legal-Checker] 再チェック
               ↓ GREEN
          → [Evaluator] 検証・採点
               ↓ 不合格
            [Code-Generator] 修正・再提出 → [Evaluator] 再検証
               ↓ 合格
            深澤(PM)へ報告 → [PMO] 記録・KPI更新 → GitHub push (kai_001)
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
