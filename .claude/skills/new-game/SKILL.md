---
name: new-game
description: 新しいCanvasゲームをGameKitエンジン＋エージェントパイプライン（Planner→Graphic-Designer/Music-Generator→Code-Generator→Legal-Checker→Dynamic-Tester→Evaluator）で1本制作する。「○○なゲームを作って」という依頼で使用。
---

# /new-game — ゲーム制作パイプライン

GameKit（`gamekit/gamekit.js`）を土台に、CLAUDE.md のエージェントパイプラインで新規ゲームを1本完成させる。

## 引数

`/new-game <ゲームの説明>`（例: `/new-game 落ちてくる星をキャッチするアクション`）
説明が無い場合は深澤に「ジャンル・操作方法・勝利条件・ボリューム感」をヒアリングしてから開始する。

## 実装ルール（全エージェント共通）

1. **GameKit を必ず使う**: `gamekit/template.html` をリポジトリ直下にコピーして `<ゲーム名>.html` として開始する。ループ・入力・衝突・SFX・UI を自前で再実装しない
2. **デザイン規約**: 黒背景 + シアン/パープル、Glassmorphism、日英バイリンガルUI、サイバーパンク演出禁止
3. **APIキー禁止**: 画像・音楽の生成に有料APIキーを設定しない。MCPコネクタ（OAuth）・プロシージャル生成・フリー素材のみ
4. **コンテキスト節約**: ファイル全体の受け渡し禁止。変更箇所スニペット＋行番号で連携する

## パイプライン手順

### 1. 仕様策定 — planner エージェント
- 要件定義（1画面ゲームならミニ仕様で可）: ジャンル / コアループ / 操作 / 勝敗条件 / 画面構成 / 必要アセット一覧
- 出力先: `specs/<ゲーム名>_spec.md`
- 深澤の承認を得てから次へ（自律実行時は仕様を提示して進行）

### 2. アセット制作（並行実行） — graphic-designer / music-generator
- **graphic-designer**: 必要画像を制作。優先順位は (1) プロシージャル（Canvas/SVGコード描画）(2) MCPコネクタ（Adobe/Canva）(3) フリー素材。納品先 `assets/art/`、`manifest.json` にライセンス記録
- **music-generator**: SE/ジングルは原則 `GameKit.Sfx`（beep/noise/jingle）のパラメータ指定で納品。BGMが必要な場合のみ Web Audio 実装コードを納品
- 画像ゼロ（全部コード描画）で成立するゲームならこのステップはスキップ可

### 3. 実装 — code-generator
- `gamekit/template.html` ベースで実装。シーンは `GameKit.Scene` 継承で分割
- 大規模な場合は複数の code-generator に分割（シーン単位 / ファイル単位、担当範囲を明示）
- 完了後 Dynamic-Tester へ

### 4. 品質ゲート — legal-checker（素材を使った場合のみ）→ dynamic-tester → evaluator
- **legal-checker**: 外部素材・ライブラリ使用時のみ。RED/YELLOW は起因エージェントへ差し戻し
- **dynamic-tester**: Playwright でJSエラー・Canvas描画・404を検証。FAILは code-generator へ差し戻し（Evaluatorに渡さない）
- **evaluator**: 仕様適合性を100点満点で採点。80点以上かつ仕様適合16点以上で合格。不合格は code-generator へ差し戻し（同一理由2回で深澤へエスカレーション）

### 5. 納品
- 合格後: 深澤へ結果報告 → 作業ブランチへコミット＆プッシュ
- コミット対象: `<ゲーム名>.html` / `specs/` / `assets/art/`（使用時）/ `marketing/`（Marketer起用時）
- `index.html` のゲーム一覧への追加は深澤の指示があった場合のみ

## 完了報告フォーマット

```
✅ <ゲーム名> 完成
- ファイル: <ゲーム名>.html（GameKit使用）
- Evaluator: XX点 / Dynamic-Tester: PASS
- アセット: プロシージャルのみ or assets/art/ にN点（ライセンス: manifest.json）
- 遊び方: <1行>
```
