---
name: workflow
description: GitHub Pagesホスティング/エージェントパイプライン/コードレビューのワークフローガイドライン。コミット前チェックリスト（.edge-test-profile混入・XSS・グローバル変数・メモリリーク・スタイル破壊・モバイル崩れ）・GitHub Pagesデプロイ手順・バグ報告/Planner要件渡しフォーマット・ブランチ運用（main/kai_001/claude/*）。レビュー・デプロイ・タスク受け渡し時に参照する。
---

# ワークフロースキル集

GitHub Pages ホスティング・エージェントパイプライン・コードレビューのワークフローガイドライン。

---

## Skill: コードレビューチェックリスト (Code Review Checklist)
- **概要**: プルリクエスト / コミット前に確認すべき項目。
- **機械チェック**: 混入・console.log・SRI・大容量・シークレットは `bash .claude/skills/release-check/release-check.sh` で一括検査できる（/release-check）。以下のうち目視が必要な項目だけ手で確認する。
- **チェック項目**:
  - [ ] `.edge-test-profile/` がステージングに含まれていないこと（`git status` で確認）
  - [ ] XSS脆弱性がないこと（`innerHTML` / `eval` へのユーザー入力の直接代入を禁止）
  - [ ] グローバル変数の意図しない追加がないこと（`window.xxx` の確認）
  - [ ] Canvas / アニメーションのメモリリーク: イベントリスナーの登録解除、`cancelAnimationFrame` の呼び出し
  - [ ] 既存のビジュアルスタイル（カラーパレット・フォント・グロウエフェクト）を壊していないこと
  - [ ] モバイル表示で崩れていないこと（DevTools の Responsive Mode で確認）

## Skill: GitHub Pages デプロイ (GitHub Pages Deploy)
- **概要**: `main` ブランチへのプッシュで自動デプロイされる GitHub Pages の運用手順。
- **実装要件**:
  - 作業は必ず `kai_001` ブランチで行い、動作確認後に `main` へマージすること。
  - 静的ファイル（HTML / CSS / JS / 画像）のみで完結させ、サーバーサイド処理を混入させないこと。
  - 画像は `images/` ディレクトリに配置し、パスは相対パス（`./images/xxx.png`）で記述すること。
  - CDN経由ライブラリは SRI (Subresource Integrity) ハッシュを付与すること（セキュリティ要件）。
  - デプロイ後は GitHub Pages の URL で実機確認し、キャッシュが残る場合は強制リロード（Ctrl+Shift+R）で確認すること。

## Skill: GitHub Actions の保守 (Workflow Maintenance)
- **概要**: `.github/workflows/` の Action バージョン更新と、CIが「存在するのに走らない」状態の防止（2026-07-25の `actions/checkout@v4` Node20非推奨対応で実証）。
- **実装要件**:
  - **バージョンは推測せずタグを実確認する**: 記憶で `@v5` 等と書くと、存在しないタグでCIが即死するか、逆に古いまま放置される（実際に「最新はv5」と想定したが実態は **v7** だった）。`git ls-remote --tags --refs https://github.com/actions/<name>` で確認し、**メジャータグが実semverリリースと同一SHAを指しているか**（`v7` → `v7.0.1` 等）まで見て、浮動タグだけの未リリース版を掴まないこと。
  - **リリースノートが読めない環境では `action.yml` を直接読む**: GitHub API がプロキシで403になる環境では、`git clone --depth 1 --branch <tag>` して `action.yml` の `runs.using`（Node実行系＝非推奨解消の確認）と `inputs`（自分が渡している入力が残っているか）を確認すれば、互換性を実証ベースで判断できる。
  - **Node実行系の非推奨警告は放置しない**: `Node.js 20 is deprecated` 系の警告はCIを失敗させないため見落とされる。警告のうちに上げること。上げる前に全ワークフローの `uses:` を横串grepし、同じActionを使う箇所を**まとめて**更新する（1本だけ直すとバージョン差が残る）。
  - **CIの `paths` は「検査が正として読むファイル」を含める**: 検査対象だけでなく**正（single source of truth）側**が監視パスに無いと、そこを変更してもワークフローが起動せず、検査が一度も走らないまま通過する（harness-lint が `CLAUDE.md` を正とするのに `.claude/**` しか監視していなかった実例）。
  - GitHub Actions は **YAML アンカー（`&` / `*`）を解釈しない**。`push` と `pull_request` で同じ `paths` を使う場合も明示的に二重記述し、片方だけ増やさないよう注意する。

## Skill: バグ報告・タスク管理 (Bug Report & Task Management)
- **概要**: エージェントパイプラインへ渡す際の要件記述と、バグ発見時の報告フォーマット。
- **バグ報告フォーマット**:
  ```
  【バグ報告】
  - 発生箇所: <ファイル名>:<行番号 or 関数名>
  - 再現手順: <ステップを箇条書き>
  - 期待動作: <本来どうなるべきか>
  - 実際の動作: <何が起きているか>
  - ブラウザ/環境: <Chrome xx / Safari xx 等>
  ```
- **Plannerへの要件渡しフォーマット**:
  ```
  【要件】
  - 目的: <何を達成したいか1行で>
  - 対象ファイル: <変更対象のHTML/JS/CSSファイル>
  - 制約: <既存スタイルを壊さない / ライブラリ追加不可 等>
  - 完了条件: <どうなったら完成か>
  ```

## Skill: ブランチ運用ルール (Branch Strategy)
- **概要**: このリポジトリのブランチ運用とコミット規約。
- **実装要件**:
  - `main`: 本番（GitHub Pages）。直接コミット禁止。マージのみ。
  - `kai_001`: 通常の開発作業ブランチ。
  - `claude/*`: Claude エージェントが自動作成する作業ブランチ。命名規則は `claude/<機能名>-<ランダムID>`。
  - コミットメッセージは日本語でもOK。形式: `<動詞>: <変更内容>` 例: `追加: パーティクル背景のパフォーマンス改善`
  - コミット前に必ず `git diff --staged` でステージング内容を確認すること。
