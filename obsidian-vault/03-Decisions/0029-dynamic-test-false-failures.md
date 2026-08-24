---
type: decision
tags: [decision, testing, harness, security]
date: 2026-08-23
status: accepted
related: [0023-verification-integrity-and-daily-backfill, static-hosting-security-limits]
---

# 0029: 動的テストの偽のFAILを一掃し、検査の信頼性を回復する

## 背景
`agents.html` の変更検証で dynamic-test が恒常FAILしていた。内訳を調べると
**4件すべてが検査側またはページ側の"防御になっていない記述"** で、実装の不具合はゼロだった。

恒常的に赤い検査は「どうせ赤い」と読み飛ばされ、**本物の不具合まで無視される**。
[[0023-verification-integrity-and-daily-backfill]] で決めた「検査スクリプトの健全性」の続きにあたる。

## 決定

### 検査側の修正（`dynamic-test-auto.cjs`）
| 症状 | 原因 | 対処 |
|---|---|---|
| `fetch()` が必ずCORSで落ちる | `file://` で開いていた | リポジトリ直下を一時HTTPサーバで配信（ポート自動割当・`favicon.ico` は204） |
| Webフォント/CDN失敗でFAIL | 外部オリジンの失敗を `jsErrors` に混ぜていた | `externalLoadErrors` へ分離し判定に使わない |
| パーティクル背景が「描画なし」 | 左上100×100pxしか見ていない | 全canvas・全面走査。1枚でも描けていればPASS |
| 対象ファイルが無いのに404でFAIL | 存在確認なし | 実行前にチェックして明示的に落とす |

### ページ側の修正
- `index.html` / `agents.html` の `<meta http-equiv="X-Frame-Options">` を削除し、
  **JSフレームバスター**（`if (self !== top) { top.location = self.location; }`）へ置換。
  meta の X-Frame-Options は**どのブラウザでも無視される**ため、防御ゼロのままコンソールを汚していた。
  `html{display:none}` を使う隠蔽版は JS 無効環境で白紙になるため採らない。
- `SECURITY_AUDIT.md` の「クリックジャッキング対策が適切に設定されている」という**誤った記述**を訂正。

### 文書
- `dynamic-test` スキルと `dynamic-tester` エージェント定義に上記を反映。
  エージェント定義は検証スクリプトの**写しを持っていた**ため、「正本は `dynamic-test-auto.cjs`、
  写しを編集して使わない」と明記した。

## 学び
- **恒常的に赤い検査は、検査そのもののバグを疑う**。今回は4件中4件が検査/無効な記述の側だった
- **「緑になった」を成果にしない**。修正後に故障（JSエラー・ローカル404・未描画canvas）を
  仕込んで✗が出ることまで確認して初めて完了。実際この自己テストで、
  外部判定を `^https?://` と書いたせいで**テストサーバ自身のローカル404まで外部扱いになる**
  自作のバグを検出できた
- **セキュリティ"らしい"記述は、効いているかを確かめる**。meta の X-Frame-Options は
  監査文書に「適切に設定されている」と書かれたまま、実際には一度も機能していなかった
- **エージェント定義にスクリプトの写しを置くと必ず腐る**。正本へのポインタに置き換える
