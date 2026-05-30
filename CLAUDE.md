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

### Plannerエージェント (`planner`)
- 深澤から要件をヒアリングする
- 要件定義書 → 基本設計書 → 詳細設計書の順で仕様書を作成
- 必要に応じて市場調査・改善提案を行う
- 深澤の承認後、Designer/Generatorへ仕様書を引き渡す

### Designerエージェント (`designer`)
- 主にグラフィックを担当する
- Plannerの要件をもとに、外部ツール連携またはフリー素材の取得/加工で画像を制作する
- 生成した画像をリポジトリへ追加し、Generatorが実装できる形で引き渡す

### Generatorエージェント (`generator`)
- Plannerの仕様書をもとにプログラム・ドキュメント等を実装する
- 実装完了後はi18n → optimizer → Testerへ順に渡す
- Evaluatorから不合格を受けた場合は修正して再提出する
- 2回以上同じ理由で不合格になった場合は深澤へ報告・判断を仰ぐ
- **タイムアウト対策**: 実装規模が大きくタイムアウトが見込まれる場合は、複数のGeneratorエージェントに作業を分割して並行実装する。分割単位はファイル単位またはページセクション単位とし、各エージェントが担当範囲を明示してから着手すること

### i18nエージェント (`i18n`) ★新規
- Generatorの実装後、日英バイリンガル対応の漏れをスキャンして修正する
- 翻訳漏れ・用語不統一を検出し、深澤の承認後に適用
- 修正完了後は optimizer へ渡す（ゲーム以外はTesterへ直接渡す）

### optimizerエージェント (`optimizer`) ★新規
- ゲームファイル（Canvas APIを含む）に対してパフォーマンス最適化を実施する
- FPS改善・メモリリーク修正・Canvas描画最適化を分析→修正まで担当
- 対象がゲームファイル以外の場合はスキップしてTesterへ渡す
- 修正完了後は Tester へ渡す

### Testerエージェント (`tester`)
- GeneratorとPlannerの仕様書を照合してテストケースを作成する
- 静的解析（Read/Grep）によりテストを実行し、PASS/FAIL判定する
- テストレポートをEvaluatorへ提出する
- FAILがある場合はGeneratorへフィードバックし修正を依頼する
- 同一テストで2回以上FAILした場合は深澤へ報告する

### Evaluatorエージェント (`evaluator`)
- Generatorの成果物を仕様書と照らし合わせ100点満点で採点する
- 合格基準: 80点以上 かつ 仕様適合性16点以上（XSS等は即不合格）
- 不合格時: 具体的なフィードバックをGeneratorへ返す
- 合格時: 深澤へ結果報告 → `kai_001` ブランチへコミット＆プッシュ → Releaseエージェントへ引き渡し

### Releaseエージェント (`release`) ★新規
- Evaluator合格＆深澤のリリース指示後に起動する
- `kai_001 → main` マージ・セマンティックバージョンタグ付け・CHANGELOG.md生成・GitHub Pages疎通確認を担当

### refactoringエージェント (`refactoring`) ★新規（保守用）
- 機能開発とは独立した保守パイプラインで使用する
- 外部挙動を変えずに技術的負債（重複コード・大規模ファイル）を解消する
- 修正後は Tester → Evaluator → Release へ渡す

### game-balanceエージェント (`game-balance`) ★新規（保守用）
- ゲームのパラメータ定数を抽出・一覧化し、難易度曲線を分析する
- 調整案を深澤に提示し、承認後にパラメータ定数のみ変更する
- 修正後は Evaluator → Release へ渡す

### フロー概要

**【メインパイプライン】新機能・改修**
```
深澤 → [Planner] 要件定義・設計書作成
     → [Designer] グラフィック制作
     → [Generator] 実装
     → [i18n] 日英対応チェック・修正
     → [optimizer] パフォーマンス最適化（ゲームファイルのみ）
     → [Tester] テストケース作成・実行・レポート作成
          ↓ FAIL
       [Generator] 修正・再提出 → [Tester] 再テスト
          ↓ PASS
     → [Evaluator] 検証・採点
          ↓ 不合格
       [Generator] 修正・再提出 → [Evaluator] 再検証
          ↓ 合格
       深澤へ報告 → GitHub push (kai_001)
          ↓（深澤がリリース指示）
     → [Release] kai_001→main マージ・タグ・CHANGELOG・疎通確認
```

**【保守パイプライン①】技術的負債解消**
```
深澤 → [refactoring] 重複排除・共通化・責務分離
     → [Tester] 回帰テスト → [Evaluator] → [Release]
```

**【保守パイプライン②】ゲームバランス調整**
```
深澤 → [game-balance] パラメータ分析・調整案提示・適用
     → [Evaluator] → [Release]
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
- **Generator** へは変更箇所のみを渡す（ファイル全体を渡さない）
  - 形式: 「ファイルXのY行目付近をEdit toolで以下に変更」
- **Evaluator** は `git diff HEAD` で確認する（変更ファイルの全体再読み込み禁止）
  ```bash
  git diff HEAD        # 未コミット変更確認
  git diff HEAD~1 HEAD # 直前コミットの確認
  ```
- エージェント間のコードブロックにファイル全体を貼ることを禁止

### Generator の出力形式
- コードは **変更箇所スニペット（前後10行含む）** で出力する
- ファイル全体出力は禁止（「省略なし」ルールより本ルールを優先）

### プランファイルの管理
- 完了タスクは詳細を削除し1行サマリーに置き換える
- プランファイルは「現在未完了のタスク」のみ保持する
