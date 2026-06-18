---
type: vault-readme
project: claudechord
status: 運用中
created: 2026-06-18
updated: 2026-06-18
tags: [claudechord, vault, pmo]
---

# Claudechord Vault — Obsidian メモリ層

Claudechord（Claude Code ベースのマルチエージェント開発ハーネス）の **単一ナレッジ／メモリ層**。
要件定義・設計・評価・リスク・マーケなど全成果物をこの vault に集約し、各エージェントは
ファイルパスではなく `[[ウィキリンク]]` で参照し合う。

> このディレクトリ全体が 1 つの Obsidian vault です。`claudechord-vault/` を Obsidian で「フォルダを vault として開く」で開いてください。

---

## 1. なぜ vault 化するのか（メモリ層）

- **永続メモリ**: リモート実行環境（コンテナ）は使い捨てだが、vault は git にコミットされるため意思決定・履歴が残る。
- **コンテキスト節約**: エージェント間の受け渡しがリンク参照になり、ファイル全体の貼り付けを避けられる（CLAUDE.md のコンテキスト節約ルールに準拠）。
- **トレーサビリティ**: 要件 → 設計 → 実装 → 評価 → マーケ をリンクで連結し、グラフビューで俯瞰できる。
- **自動集計**: frontmatter（メタデータ）を Dataview で集計し、PMO の KPI を手作業ゼロで可視化する。

---

## 2. ディレクトリ構成

```
claudechord-vault/
├── README.md            ← このファイル（運用ルール・接続手順）
├── _templates/          ← Templater テンプレート（雛形）
│   ├── 要件定義書.md
│   ├── 基本設計書.md
│   ├── 詳細設計書.md
│   ├── 評価レポート.md
│   ├── リスク報告書.md
│   ├── プロジェクト.md
│   └── デイリーノート.md
├── dashboards/          ← Dataview ダッシュボード（自動集計ビュー）
│   ├── PMO_ダッシュボード.md
│   ├── KPI_品質メトリクス.md
│   ├── リスク登録簿.md
│   └── 課題ログ.md
├── projects/            ← プロジェクト単位のハブノート
│   └── city_builder.md  ← サンプル
├── deliverables/        ← 成果物ノート（frontmatter 付き）
│   ├── city_builder_要件定義.md  ← サンプル
│   └── city_builder_評価_v2.md   ← サンプル
└── daily/               ← デイリーノート（PMO ブリーフィング／開発ログ）
    └── 2026-06-18.md     ← サンプル
```

---

## 3. frontmatter 規約（最重要・必ず守る）

Dataview 集計が成立するよう、全ノートの先頭に YAML frontmatter を付ける。

### 成果物ノート（deliverables/）

```yaml
---
type: 要件定義書        # 要件定義書 | 基本設計書 | 詳細設計書 | 評価レポート | リスク報告書 | マーケ戦略
project: city_builder   # プロジェクト識別子（projects/ のファイル名と一致させる）
status: 作業中          # 起票 | 作業中 | レビュー中 | 合格 | 不合格 | 完了
agent: planner          # 生成元エージェント
target_file: city.html  # 対象ファイル（任意）
created: 2026-06-18
updated: 2026-06-18
tags: [claudechord, city_builder]
---
```

### 評価レポート専用の追加フィールド

```yaml
eval_score: 86      # 100点満点の総合点
spec_score: 17      # 仕様適合性（16点以上で合格基準の一つ）
revision_count: 2   # 何回目の提出か（修正回数）
verdict: 合格        # 合格 | 不合格
```

### リスク報告書（legal-checker）専用の追加フィールド

```yaml
risk_level: GREEN   # GREEN | YELLOW | RED
```

### プロジェクトハブ（projects/）

```yaml
---
type: プロジェクト
project: city_builder
status: 作業中          # 起票 | 作業中 | 完了 | 中断
phase: 実装             # 要件定義 | 基本設計 | 詳細設計 | 実装 | 法務 | テスト | 評価 | マーケ | 完了
target_file: city.html
owner: 深澤
start: 2026-05-17
tags: [claudechord, project]
---
```

> **stat): 値はこの規約の語彙から外れないこと**（表記ゆれは Dataview の集計を壊す）。

---

## 4. Claude Code ⇄ Obsidian 連携（双方向同期）

### 方式A: Local REST API プラグイン（ローカル運用・推奨）

1. Obsidian で **コミュニティプラグイン「Local REST API」** をインストール・有効化。
2. 設定で API キーを発行（このキーは git にコミットしない。CLAUDE.md の API キー禁止規約に準拠し `.gitignore` 管理）。
3. Claude Code から `https://127.0.0.1:27124/vault/<path>` に対し GET/PUT してノートを読み書き。
   - 例: `GET /vault/dashboards/PMO_ダッシュボード.md`、`PUT /vault/daily/2026-06-18.md`

### 方式B: git 経由（リモート実行環境・現行ワークフロー併用）

- vault は本リポジトリ配下なので、Claude Code は通常のファイル編集（Edit/Write）でノートを更新し、`main` / 作業ブランチへコミットすればよい。
- Obsidian Git プラグインを入れれば、手元の Obsidian からも pull/commit/push が可能。
- **GitHub Pages との共存**: vault は `.md` のみでサイト出力に影響しない。`.nojekyll` 環境のためそのまま配置可能。

### 方式C: MCP（将来拡張）

- Obsidian MCP サーバ（コミュニティ実装）を `.claude` の MCP 設定に追加すれば、`mcp__obsidian__*` ツールで検索・取得・追記が可能になる。検索ベースの参照に向く。

---

## 5. Google Drive(pmo/) との役割分担

二重管理を避けるため、**正本（source of truth）は本 vault** とする。

| 用途 | 保管先 |
|------|--------|
| 作業中の成果物・設計・評価・リスク | **Obsidian vault（正本）** |
| 深澤・外部共有用の配布コピー、週次レポートの提出物 | Google Drive `pmo/`（ミラー） |

PMO は vault の Dataview 集計結果を週次レポートとしてエクスポートし、Drive に配布する運用とする。

---

## 6. 運用フロー（エージェント別）

| エージェント | vault での動き |
|---|---|
| Planner | `_templates/要件定義書` 等から成果物を起こし `deliverables/` に保存、`projects/` ハブにリンク |
| Code-Generator | 実装後、対象 deliverable の `status` を更新 |
| Legal-Checker | `_templates/リスク報告書` から `risk_level` 付きノートを生成 |
| Evaluator | `_templates/評価レポート` から `eval_score`/`spec_score`/`revision_count` 付きノートを生成 |
| PMO | `dashboards/` を参照して進捗・KPI・リスクを監視、デイリーノートにブリーフィングを記録 |

---

## 7. 導入ステップ（このコミットの範囲 = ①②④）

- [x] **① メモリ層**: vault 構成・frontmatter 規約・接続手順（本 README）
- [x] **② KPI ダッシュボード**: `dashboards/`（Dataview）
- [x] **④ テンプレート標準化**: `_templates/`（Templater）

### 必要な Obsidian プラグイン

- **Dataview**（ダッシュボードの集計に必須）。設定で「Enable JavaScript Queries」を ON。
- **Templater**（テンプレート挿入に必須）。Template folder location を `claudechord-vault/_templates` に設定。
- （任意）Local REST API / Obsidian Git / Tasks / Kanban。
