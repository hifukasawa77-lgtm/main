---
type: decision
tags: [decision, self-improve, harness-lint, routine, verifier]
date: 2026-09-27
status: accepted
related: [0034-agent-contract-and-least-privilege, false-red-checks-are-worse-than-none, verification-counts-the-wrong-thing]
---

# 0035: /self-improve 初の実運用（Routine修正確認・検査#15の盲点修正・学び5件の昇格）

## 背景
`/self-improve` Routineは2026-07-26の初回firingから一度も成果物を出しておらず、直近
（2026-09-20）はABANDONEDだった。原因は2026-09-25に特定済み: Routineの`persistent_session_id`が
指すセッションにgitリポジトリが紐づいていなかった（`sources: []`）。2026-09-25に5本のRoutine全て
（self-improve/marketer-evolve/site-proposal/agent-evolve/note-post）が repo-bound な常駐セッションへ
作り直された。本セッションはその修正後、初めて実際に完走した `/self-improve` の実行である。

## 決定・確認したこと

### 1. Routine修正の効果を実地で確認
- `list_triggers` で5本すべての `created_at` が2026-09-25であることを確認（修正が全Routineに適用済み）
- 本セッション（self-improve）が実際に起動・作業できていること自体が修正の証拠
- **`claude/note-post` ブランチで、修正後に本物の成果物（note記事1本＋実行痕跡マーカー付きDaily）が
  既に生成されていた**（2026-09-25T14:27、トリガー作成の5秒後にコミット）。ただし
  `mcp__github__*` が使えないRoutineセッションはPRを作れず、mainには未マージのまま2日間放置されていた

### 2. `verify-routine-delivery.mjs`（harness-lint検査#15）の盲点を修正
- 上記のnote-postの件で発覚: 検査Aは**mainのローカルチェックアウトのDailyしか見ておらず**、
  成果物ブランチ上に正しく書かれた痕跡マーカーを検出できなかった。実際に動いたRoutineが
  「一度も動いていない」と誤判定される構造的な盲点だった
- 修正: 検査Aが、成果物ブランチの`git ls-tree`/`git show`でそのブランチの
  `obsidian-vault/01-Daily/*.md`も走査し、mainのローカルと合わせて新しい方の日付を採用するように変更
  （`scripts/verify-routine-delivery.mjs`）。ブランチ側でしか見つからない場合は
  「main未マージ＝要PR化」という注記付きの✓に変える
- 検証: 修正前は note-post が✗（agent-evolve/self-improve/marketer-evolve/site-proposalと同様）、
  修正後は note-post のみ✓に変わり他4本は✗のまま（変化なし）。実データでの正例・負例が
  両方揃っており、故障注入の代替として妥当と判断した

### 3. 未マージのPRバックログを発見（要・深澤判断、本セッションでは対処しない）
`gh` 相当のGitHub検索で確認した限り、以下がopenのまま滞留している:
- **PR #345**（14日経過・121ファイル）: `claude/zero-1-gesture-control-68dq1u`。エアタッチのブラッシュアップ、
  **サイト全99ページへのCSP導入**、自己改善3件（ADR 0035〜0039・harness-lint検査#9修正、ただし
  この番号は本ADRと衝突している＝**未マージ枝が使った番号と重複**。マージ時に番号の付け替えが必要）
- PR #272（67日経過）: `claude/agent-evolve`。ゲームカタログ同期
- PR #347（11日経過）: 戦国・源平・太平・幕末の法務チェックレポート
- PR #332 / #316 / #271（35〜67日経過）: 個別ゲーム機能追加

**self-improveの役割はここまで**——この5〜6本のPRは他のパイプライン（release/legal-checker等）の
管轄で、CSPのようなサイト全体に影響する変更を自己改善ループが無審査でマージするのは越権。
深澤への報告に留める。

### 4. Vaultの学び5件を恒久ルールへ昇格
| 学び | 昇格先 |
|---|---|
| 検査の相対比較は両方が同程度に壊れる故障を見逃す（レシートOCR） | `verifier.md` 検査原則#8、`verification-counts-the-wrong-thing.md` |
| ローカルの作業ツリーだけを見る検査はブランチ側の成果物を見逃す（note-post） | `verifier.md` 検査原則#9 |
| フィルターで隠した要素はIntersectionObserver revealが発火しない／スクショはスクロールしてから撮る | `design/SKILL.md`「スクロールreveal演出とフィルター表示の両立」（新設） |
| SWのcache-first経路はCSS変更後に`?v=`を上げないと反映されない | `CLAUDE.md` Service Worker節 |
| 構造化データは実装/画面と不一致のまま申告してはいけない・robots.txtはGitHub Pagesプロジェクトサイトで無効 | `seo-audit/SKILL.md`（新設） |

昇格しなかったもの（Vault留め置き）: レシートOCR固有のTesseract実装詳細、CRLF保存（`coding/SKILL.md`
に既存記載と重複のため）、ZERO-1（PC版・別リポジトリ`zero-1-local-ai`）関連の学び全般。

## 影響・トレードオフ
- `verify-routine-delivery.mjs` の変更はネットワーク越しに `git ls-tree`/`git show` を追加で呼ぶため、
  オフライン環境では従来通り判定保留（`△`）になる。既存の挙動を壊さない追加のみ
- ADR番号0035は本ADRとPR #345側のADR 0035が重複している。PR #345をレビュー・マージする際は
  この重複（0035〜0039の番号帯）の付け替えが必須
