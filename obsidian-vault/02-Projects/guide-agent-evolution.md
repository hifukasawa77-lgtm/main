---
type: project
status: active
tags: [project, agent, self-evolution]
---

# 案内エージェント自己進化基盤（guide-agent-evolution）

サイトの「hideの案内エージェント」を日々賢くする閉ループ基盤。2026-07-18 に構築。

## 構成
- **データ/ロジック分離**: `assets/js/agent-data.js`（進化の編集対象）＋ `assets/js/agent.js`（ロジック）。app.jsから約1,930行を切り出し
- **賢さ**: カナ折り畳み＋長音展開の正規化、bigramファジー第2パス（タイポ耐性）、文脈スロット（それ→直前のゲーム）、永続プロファイル `hide-agent-profile-v1`（未プレイ優先おすすめ）、プロアクティブ提案（news/新着/未プレイ、セッション2件上限、FAB未読ドット）
- **worker**: SYSTEM_PROMPT を `site-knowledge.js`（自動生成）化、公開 `GET /stats`（👎質問の集計＝弱点発見の入力）
- **日次進化**: Routine（毎日05:00 JST）→ `/agent-evolve` → 改善最大3件（データのみ）→ ローリングPR `claude/agent-evolve` → 深澤承認制
- **週次提案**: Routine（月曜07:00 JST）→ `/site-proposal` → トップ3提案を Issue（`proposal`）起票のみ

## 品質ゲート
`scripts/agent-evolve-check.mjs`（整合）／`scripts/agent-dynamic-test.cjs`（Playwright 6シナリオ）／`gen-agent-knowledge.mjs --check`（drift、harness-lint 検査#10）

## 運用ルール
- 進化の編集対象はデータファイルのみ。ロジック変更はPR提案欄に書くだけ
- 2週間安定したら auto-merge 化を深澤へ提案（勝手に移行しない）

## 関連
[[2026-07-18]] / `.claude/skills/agent-evolve/SKILL.md` / `.claude/skills/site-proposal/SKILL.md`
