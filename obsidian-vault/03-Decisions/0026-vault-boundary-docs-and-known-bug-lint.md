---
type: decision
date: 2026-08-20
status: accepted
tags: [decision, harness, vault, verification, portraits, drawimage]
related: ["[[harness-maintenance-patterns]]", "[[0018-battle-verification-patterns-promotion]]", "[[0022-asset-reencode-safety]]"]
---

# 0026 Vaultの二重メモリ層を境界明文化＋既知の無言バグを横断機械検査化

## 背景・問題

深澤から「Fukazawa AI System（本ハーネス）をブラッシュアップしたい」という依頼を受け、
`.claude/agents/`・スキル・Routine・両Vaultの実態を調査して4件提案し、うち2件の実装承認を得た。

- **`claudechord-vault/` と `obsidian-vault/` の二重「Obsidian メモリ層」**: CLAUDE.mdは両方を
  「Obsidian メモリ層」と呼んでおり、役割（PMO成果物の正本 vs Claude Codeの第二の脳）は違うが
  記述が似ている。`claudechord-vault/` は直近1ヶ月の実更新が31ファイルと薄く、PMOエージェントが
  実際に書き込んでいる形跡はほぼ無い一方、`obsidian-vault/` は日次で活発に更新されている。
  将来エージェントが書き先を誤る・重複記録するリスクがあった。
- **「肖像スロットのindexずれ」「source-rectの解像度直書き」の再発**: `sengoku.html`/`sanguo.html`/
  `taihei.html` で複数回踏んできた"例外もエラーも出ずに絵だけが無言でずれる/消える"バグパターンが、
  知見としては書いてあるものの検査は人間+LLMの目視レビュー任せのままだった。

## 決定

1. **Vaultの使い分けは境界明文化のみで解決**（統合はしない）。`claudechord-vault/` は
   Dataviewダッシュボード・Templater雛形など実装が入っており、移行の手間とObsidianアプリ側の
   既存ビューへの影響（KPIダッシュボードのDataviewクエリ等）に対して統合の効果が見合わないと判断。
   CLAUDE.mdの「Obsidian メモリ層（Claudechord Vault）」節に「`obsidian-vault/` との使い分け早見表」
   （主体／中身／読み書き主体／frontmatter規約／迷ったときの目安の5観点）を追加し、
   「Obsidian 第二の脳」節・「ファイル構成」節からも相互参照させた。
2. **`scripts/verify-known-bug-patterns.mjs` を新設**し、2種類の横断検査を機械化した。
   - 検査A（✗ブロッキング）: 肖像アトラスのindex割り当てに使う配列
     （`assets/sengoku/generals.json` の `generals` / `sanguo.html` の `GENERAL_IDS`）は
     「末尾追加のみ」が不変条件。比較対象（既定HEAD）時点の並びが現在の並びの先頭一致（prefix）に
     なっているかを機械確認する。新しいゲームで同種のindex依存割り当てを足す場合は、
     スクリプト内 `KNOWN_INDEX_SENSITIVE_ARRAYS` への登録が必要（CLAUDE.mdに明記）。
   - 検査B（△警告・非ブロッキング）: 全ゲームHTMLを横断し `drawImage` の9引数呼び出しで
     source-rectが数値リテラル直書きになっている箇所を検出する（現状 `beat_em_up.html` に1件）。
   - `sengoku.html`・`sanguo.html` の「必須チェック」バッシュブロックに追記した。

## 理由

- Vault統合は「一見きれいに片付く」が、`claudechord-vault/` はPMOエージェント定義
  （frontmatter規約・保存先・KPIダッシュボード）に密結合しており、移行はドキュメント修正だけでは
  終わらずKPI集計の実装まで波及する。ブラッシュアップの提案時点でも「境界明文化（推奨・低リスク）」
  と「統合（高リスク）」を両論併記し、深澤が低リスク案を選択した。
- 既知の無言バグは「知っている」だけでは再発を防げない。過去3ゲームで同じ形のバグを踏んだ実績
  （[[0018-battle-verification-patterns-promotion]] 等）があり、**同種のミスの再発**は
  self-improveの最優先昇格基準に該当する。CLAUDE.mdの知見をそのままにせず機械検査へ格上げした。
- 検査Aは「末尾のみ追加してよい」という既存ルール（CLAUDE.md記載）をそのままコードにした
  だけで、新しい規約は導入していない。既存ルールの機械強制であり、振る舞いの変更ではない。

## 影響・トレードオフ

- `CLAUDE.md` 更新（ファイル構成節・第二の脳節・Claudechord Vault節・sengoku/sanguo必須チェック節・
  新設「既知の無言バグパターンの機械検査」節）、`scripts/verify-known-bug-patterns.mjs` 新設。
- 負のテスト実施済み: `assets/sengoku/generals.json` の中間に武将を挿入して検査Aが✗になること、
  末尾に追加した場合は✓のままであることを確認し、元に戻して✓へ復帰することまで確認した。
- 検査Aの登録簿は現状 sengoku/sanguo の2件のみ。genpei（個別AI生成画像方式でindex非依存）・
  taihei は対象外と判断したが、今後 index依存の肖像アトラス方式を採用するゲームが増えたら
  登録漏れが起きうる（機械検査はできないため、new-game/game-devスキル側での注意喚起が別途要る）。
- 検査Bは静的ヒューリスティック（数値リテラルのみ検出）のため、変数経由の隠れたハードコードは
  見逃す。誤検出防止のため警告のみ（exit codeに影響しない）に留めた。
