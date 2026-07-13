---
type: decision
date: 2026-07-13
status: accepted
tags: [decision, self-improve, performance, canvas, seo]
related: ["[[recursive-self-improvement]]", "[[0003-recursive-self-improvement-loop]]"]
---

# 0012 Canvasパフォーマンス実証知見とOG画像知見をスキルへ昇格

## 背景・問題
戦国の野望の改善サイクル（2026-07-12, Cycle 0〜6）で、計測に裏づけられた再利用可能な知見が得られた（MapScene ~7.5→19.7fps、BattleScene ~19.3→36fps）。Daily Noteに「coding / game-dev / perf-audit スキルへの昇格候補」と明記されたまま未反映だった。Dailyに置いたままでは次セッションで自動では効かない。

## 決定
以下を各スキルへ差分追記で昇格（すべて追加型・既存ルールの変更なし）:
1. **coding/SKILL.md（最適化手法の正）**: ①カメラ非依存レイアウトの変化検知メモ化＋安全リフレッシュ ②時間非依存静的層のオフスクリーン合成→ブリット（分割点は「フレーム間で変わる最初の要素」）③禁止: ズーム変換配下のベクター要素のビットマップキャッシュ（高ズームでボケる）④カリングは疎ビュー向けの補助策（高ズーム密集では相殺）
2. **perf-audit/SKILL.md（実測の正）**: attribution手法 — シーンdrawラップ計測→サブ描画スタブ切り分け→主犯確定後に適用・同条件再計測。複数ズーム/密度でスイープ
3. **seo-audit/SKILL.md**: OG画像は写真的内容ならJPEG（969KB PNG→79KB JPEG実例）／Canvasゲームはタイトル画面canvasから1200x630クロップで自動生成（レターボックス回避）

## 理由
- 2画面（Map/Battle）への横展開で再現した＝一般則として再利用可能。
- 手法の正はcodingに集約し、game-devへの重複記載は見送り（perf-auditからcoding参照の既存導線を維持。「狭く効かせる・重複させない」原則）。

## 影響・トレードオフ
- 次回以降のCanvasゲーム最適化で、計測（perf-audit）→切り分け→定番2パターン適用（coding）が最初から指示として効く。
- スキル本文がやや長くなるが、recall hookで毎回読まれるDailyから知見を降ろせるため総コンテキストは削減方向。
