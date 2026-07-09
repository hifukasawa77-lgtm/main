---
type: decision
date: 2026-07-09
status: accepted
tags: [decision, context, token, hook]
related: ["[[0009-daily-hygiene-rule]]", "[[claude-md-project-rules]]"]
---

# 0012 セッション固定コンテキストのダイエット（recall抜粋化＋CLAUDE.md圧縮）

## 背景・問題
Claude Codeの消費トークンを抑えたい（深澤の指示）。実測したところ、毎セッション無条件でコンテキストに乗る固定費が大きかった:
- `CLAUDE.md`: 15.8KB — うち約半分が「エージェントハーネス設計」節で、`.claude/agents/*.md` の内容とほぼ全部重複（Agentツールのdescriptionにも同じ要約が常時ロードされる＝三重掲載）
- recall hook出力: 9.5KB — 直近Daily Noteを**全文** `cat` しており、Dailyが長い日ほど無制限に肥大（07-09は5.8KB）

## 決定
1. **recall hook**（`second-brain-recall.sh`）: Daily Note全文投入をやめ、「セクション見出し一覧＋『次回への引き継ぎ/持ち越し』セクション（最後の一致、上限3,000バイト）」の抜粋に変更。引き継ぎセクションがない場合は末尾1,200バイトにフォールバック
2. **CLAUDE.md**: エージェント別の詳細節（11エージェント×箇条書き＋大型フロー図）を削除し、パイプライン概要＋メインセッション側運用ルールのみに圧縮。役割詳細の正は各 `.claude/agents/*.md` とする

## 理由
- 重複排除が最も安全なトークン削減: 情報の正はエージェント定義に残り、失われるものがない（削除前に各詳細が agents/*.md に存在することをgrepで確認済み）
- Dailyの「引き継ぎ」だけが次セッションで即必要な情報。それ以外は見出し一覧から必要時に grep + offset/limit で辿れる
- harness-lint 検査#5の正規値（¥5,000 / 80点以上・16点以上 / kai_001）はCLAUDE.mdに保持し、lint全パスを確認済み

## 影響・トレードオフ
- 効果: CLAUDE.md 15.8KB→8.1KB（−49%）、recall出力 9.5KB→5.2KB（−45%）。毎セッション合計 約12KB（日本語で概算 7〜9Kトークン相当）の固定費削減
- トレードオフ: セッション冒頭でDailyの本文詳細が自動では見えない → 見出し一覧＋全文パスを提示して能動的に読めるようにした
- 残る大口はリポジトリ外: MCPコネクタ群（Adobe/Canva/Figma/Gmail/Calendar/Drive/Spotify/Zoom/Microsoft Learn等）のツール一覧・サーバー指示が毎セッション載る。未使用コネクタの無効化は深澤のclaude.ai側設定でのみ可能（→深澤へ提案済み）
