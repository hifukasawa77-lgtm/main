# CLAUDE.md — hide_0001 Portfolio

## プロジェクト概要
hideの個人ポートフォリオサイト。GitHub Pages でホスティング。ダークサイバーパンク系のビジュアルデザイン。

## ファイル構成
- `index.html` — メインポートフォリオページ（シングルページ）
- `game.html` — ZELDA QUEST（Canvas APIのみで作ったトップビューRPG）
- `shogi.html` — 将棋パズル
- `shogi_rpg.html` / `shogi_rpg_enhanced.jsx` — 将棋RPG

## デザイン・スタイルのルール
- カラースキーム: 黒背景 + ネオンシアン / マゼンタ / パープル
- スタイル: Glassmorphism カード、アニメーションパーティクル背景（Canvas API）
- UIは日英バイリンガル表記
- 既存のビジュアルスタイルを壊さないこと

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

成果物作成は以下の3エージェントのパイプラインで行う（`.claude/agents/` に定義）。

### Plannerエージェント (`planner`)
- 深澤から要件をヒアリングする
- 要件定義書 → 基本設計書 → 詳細設計書の順で仕様書を作成
- 必要に応じて市場調査・改善提案を行う
- 深澤の承認後、Generatorへ仕様書を引き渡す

### Generatorエージェント (`generator`)
- Plannerの仕様書をもとにプログラム・ドキュメント等を実装する
- 実装完了後はEvaluatorへ成果物を提出する
- Evaluatorから不合格を受けた場合は修正して再提出する
- 2回以上同じ理由で不合格になった場合は深澤へ報告・判断を仰ぐ

### Evaluatorエージェント (`evaluator`)
- Generatorの成果物を仕様書と照らし合わせ100点満点で採点する
- 合格基準: 80点以上 かつ 仕様適合性16点以上（XSS等は即不合格）
- 不合格時: 具体的なフィードバックをGeneratorへ返す
- 合格時: 深澤へ結果報告 → `kai_001` ブランチへコミット＆プッシュ

### フロー概要
```
深澤 → [Planner] 要件定義・設計書作成
     → [Generator] 実装
     → [Evaluator] 検証・採点
          ↓ 不合格
       [Generator] 修正・再提出 → [Evaluator] 再検証
          ↓ 合格
       深澤へ報告 → GitHub push (kai_001)
```

## 注意事項
- `.edge-test-profile/` はMicrosoft Edgeのブラウザデータ。gitignoreすること
- `shogi_rpg_enhanced.jsx` はJSX形式だがビルド環境なし。取り扱い注意
