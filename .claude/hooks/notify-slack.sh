#!/bin/bash
# notify-slack.sh — 経理エージェントの通知をSlackへ送る（Incoming Webhook / 無料）
# 使い方: notify-slack.sh "メッセージ"
# 環境変数 SLACK_ACCOUNTING_WEBHOOK_URL が未設定なら、メッセージを標準出力に出すのみ
# （= チャット上で深澤へ直接報告するフォールバック。エラーにはしない）。
# ⚠️ Webhook URL は環境変数で渡す。コードや台帳にコミットしないこと。
set -euo pipefail

MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then
  echo "usage: notify-slack.sh \"<message>\"" >&2
  exit 1
fi

# Webhook 未設定 → フォールバック（標準出力のみ）
if [ -z "${SLACK_ACCOUNTING_WEBHOOK_URL:-}" ]; then
  echo "[accounting][slack未設定→チャット報告] $MESSAGE"
  exit 0
fi

# JSON 文字列エスケープ（最小）
PAYLOAD_TEXT="$(printf '%s' "$MESSAGE" | sed 's/\\/\\\\/g; s/"/\\"/g')"

# curl は環境のプロキシ設定（HTTPS_PROXY）に従う
if curl -sS -X POST \
  -H 'Content-type: application/json' \
  --data "{\"text\":\"💰 [経理] ${PAYLOAD_TEXT}\"}" \
  "$SLACK_ACCOUNTING_WEBHOOK_URL" >/dev/null; then
  echo "[accounting][slack送信済] $MESSAGE"
else
  # 送信失敗してもパイプラインを止めない（フォールバック）
  echo "[accounting][slack送信失敗→チャット報告] $MESSAGE" >&2
fi
exit 0
