# accounting/ — 課金監視・経理台帳

経理エージェント（`.claude/agents/accounting-agent.md`）が、hideのソフトウェア開発で
**追加課金が発生し得る操作を常時監視**し、課金額をモニタリングするためのディレクトリ。

## 目的
- 追加で課金が発生する場合に深澤（PM）へ**通知**する。
- 深澤の許可で課金が発生する場合に、**月次累計が上限（¥5,000）を超えないようチェック＆報告**する。
- プロジェクト方針は **課金ゼロの維持**（CLAUDE.md L159-164 / music-generator.md L28-35）。本ディレクトリはその安全装置。

## ファイル構成
| ファイル | 役割 |
|---|---|
| `budget.md` | 予算設定（月上限¥5,000・アラート閾値・通貨）。**機械可読**な `KEY: VALUE` を含む |
| `ledger.md` | 課金台帳（当月分）。課金イベントを1行ずつ記帳 |
| `archive/YYYY-MM.md` | 月初に退避した過去月の台帳（必要時に作成） |
| `README.md` | 本書（運用ルール） |

## 監視の仕組み（自動 + エージェント）
1. **自動監視hook**: `.claude/hooks/accounting-guard.sh`（PreToolUse）が、課金リスクのあるツール呼び出しを
   実行**前**に検知し、深澤の確認（`ask`）を要求、上限超過見込みならブロック（`deny`）する。
2. **経理エージェント**: hookの警告や深澤の依頼で起動し、リスク分類・台帳照合・通知・記帳を行う。

## 承認フロー
```
課金リスク操作を検知（hook or エージェント）
  └→ [RED] 課金確実 / 上限超過見込み → 停止して深澤に通知・承認要求
  └→ [YELLOW] 金額不明 / 無料有料混在 → 金額・代替手段を確認してから判断
  └→ [GREEN] 課金なし → そのまま実行・記録のみ
深澤が承認 → ledger.md に「承認済」で記帳 → 実行
請求確定 → ledger.md を「実績」に更新
```

## Slack通知の設定
通知は `.claude/hooks/notify-slack.sh` 経由。Slack Incoming Webhook を使う（**無料**・有料APIキーに非該当）。

1. SlackでIncoming Webhookを作成しURLを取得。
2. 環境変数に設定（**gitにコミットしないこと**）:
   ```bash
   export SLACK_ACCOUNTING_WEBHOOK_URL="https://hooks.slack.com/services/XXX/YYY/ZZZ"
   ```
3. 未設定でも動作する（その場合はチャット上で深澤へ直接報告するフォールバックになる）。

> ⚠️ Webhook URL・カード情報・APIキー等の秘密情報は、このディレクトリのどのファイルにも書かない。

## 月次リセット
- 毎月初（`budget.md` の `RESET_DAY`）に、`ledger.md` の当月分を `archive/YYYY-MM.md` へ移し、当月行をクリアする。
