---
type: decision
tags: [decision, harness, agents, pipeline]
date: 2026-08-23
status: accepted
related: [0006-activate-orphaned-skills, 0007-harness-lint-automation, harness-maintenance-patterns]
---

# 0028: 重複エージェント2体を統合し、孤立7体をパイプラインへ載せる

## 背景
深澤から「AIチームに仕事をしていないエージェントがいる。開発パイプラインに載っていないのが原因。
タスクが重複していれば統合したい」との指摘。`agents.html` は21体を紹介していたが、
実際にどのパイプライン・スキルからも呼ばれていないエージェントが **9体** あった:
`debug-agent` `spec-agent` `security` `i18n` `optimizer` `refactoring` `game-balance`
`achievement-agent` `release`。

さらに `release` は **agents.html のフロー図には居るのに CLAUDE.md のフロー図には存在しない**
という文書間の食い違いがあり、`researcher` は CLAUDE.md のエージェント一覧に節が無いまま
フロー図にだけ登場していた。孤立は「サボっている」のではなく**呼び出し口が無い**ことが原因だった。

## 決定

### 1. 重複2体を統合（21体 → 19体）
| 廃止 | 吸収先 | 理由 |
|---|---|---|
| `debug-agent` | `evaluator` の**単独診断モード** | 「バグ＋性能＋脆弱性＋品質」の4観点は、性能=optimizer・脆弱性=security・品質=refactoring が**より深く**担当済み。残るバグ/品質診断は evaluator の静的解析と同質 |
| `spec-agent` | `planner` の**ゲーム特化モード** | どちらも要件定義書→基本設計書→詳細設計書を生成。固有だったのは specs/ 保存とコードスケルトンのみ |

統合時に **spec-agent の素のCanvasスケルトンは GameKit ベースへ改めた**
（CLAUDE.md「新規ゲームは GameKit を土台にする」と矛盾していたため）。

### 2. 孤立7体をパイプラインへ配置
- **品質ゲート（必須・3体並列）**: `legal-checker` ｜ `security` ｜ `i18n` → Dynamic-Tester の前に完了
  - security の CRITICAL を Evaluator の「即不合格」まで持ち越すと手戻りが大きいので**ここで止める**
  - i18n は `i18n-check.sh` の機械検出結果に**訳語を当てる**役割（検出をゼロからやり直さない）
- **リリース工程**: Evaluator 合格 → push → `release` → `marketer`（CLAUDE.md のフロー図にも明記）
- **公開後の改善ループ（新フェーズ）**: `optimizer` / `refactoring` / `game-balance` / `achievement-agent`
  を1フェーズにまとめ、**各エージェント定義に「起動条件」を明記**した
  （例: optimizer = /perf-audit でFPS低下が出た時、game-balance = 難易度の指摘があった時）。
  4体とも変更後は Dynamic-Tester で回帰確認する

### 3. 再発防止（harness-lint 検査#13）
「定義はあるが呼ばれない」「サイトには居るが CLAUDE.md に無い」を機械検出する検査を追加:
- (a) 各 `.claude/agents/*.md` が CLAUDE.md のエージェント一覧に居るか
- (b) フロー図・スキル・自身の「パイプライン上の位置」節のいずれかで参照されているか（孤立検出）
- (c) agents.html にカードがあるか（警告）
- (d) 逆方向 — サイトが参照するのに定義ファイルが無い（削除漏れ）
ダミーエージェントを置いて**実際に✗が出ることを確認済み**（偽の✓でないこと）。

## 学び
- **エージェントを増やすときは「誰が・いつ呼ぶか」を定義に書かないと必ず孤立する**。
  役割の記述だけでは呼び出し口にならない。「パイプライン上の位置」＋「起動条件」を必須項目にした
- **重複は"似た役割"ではなく"より深く同じことをする"かで判定する**。debug-agent は4観点すべてを
  浅く持っていたため、単独では常に専門3体の下位互換だった
- **文書が2箇所（CLAUDE.md と agents.html）にあると片方だけ更新される**。今回の release がまさにそれで、
  人の目視レビューでは半年気づかなかった。機械検査に落として初めて検出できた
