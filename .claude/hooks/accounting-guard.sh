#!/bin/bash
# accounting-guard.sh — PreToolUse hook
# 課金リスクのあるツール呼び出しを実行前に検知し、深澤の確認(ask)を要求する。
# 当月累計が予算上限を超える見込みの場合はブロック(deny)する。
# 経理エージェント: .claude/agents/accounting-agent.md
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
BUDGET_FILE="$PROJECT_DIR/accounting/budget.md"
LEDGER_FILE="$PROJECT_DIR/accounting/ledger.md"

# 台帳が無ければ何もしない（素通り）
[ -f "$BUDGET_FILE" ] || exit 0
[ -f "$LEDGER_FILE" ] || exit 0

# stdin の PreToolUse ペイロードを読む（{"tool_name": "...", "tool_input": {...}}）
PAYLOAD="$(cat || true)"

# tool_name を抽出（jq が無くても動くよう grep ベース）
TOOL_NAME="$(printf '%s' "$PAYLOAD" \
  | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//; s/"$//' || true)"

[ -n "${TOOL_NAME:-}" ] || exit 0

# --- 課金リスクツール一覧 ---
# 次の3箇所を必ず同一に保つこと: (1) accounting-agent.md の監視対象テーブル,
# (2) この BILLING_RISK_TOOLS, (3) .claude/settings.json の PreToolUse matcher。
# settings.json の matcher は hook 起動の外側ゲートなので、ここに無いツール名は
# このスクリプトが走らない → matcher は本リストの上位集合（＝同一文字列）であること。
# 部分一致でマッチさせる正規表現（パイプ区切り）
BILLING_RISK_TOOLS='asset_license_and_download_stock|license_and_download|purchase|checkout|subscribe|billing|payment'

echo "$TOOL_NAME" | grep -Eq "$BILLING_RISK_TOOLS" || exit 0  # リスク該当なし→素通り

# --- 予算と当月累計を読む ---
MONTHLY_LIMIT="$(grep -oE 'MONTHLY_LIMIT:[[:space:]]*[0-9]+' "$BUDGET_FILE" | grep -oE '[0-9]+' | head -1 || echo 5000)"
CURRENT_TOTAL="$(grep -oE 'CURRENT_TOTAL:[[:space:]]*[0-9]+' "$LEDGER_FILE" | grep -oE '[0-9]+' | head -1 || echo 0)"
: "${MONTHLY_LIMIT:=5000}"
: "${CURRENT_TOTAL:=0}"

# JSON 文字列用の最小エスケープ
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

REASON_BASE="💰 経理ガード: '$TOOL_NAME' は課金が発生し得る操作です（当月累計 ¥${CURRENT_TOTAL} / 上限 ¥${MONTHLY_LIMIT}）。"

# すでに上限到達済みなら停止(deny)
if [ "$CURRENT_TOTAL" -ge "$MONTHLY_LIMIT" ]; then
  REASON="${REASON_BASE} 当月累計が予算上限に到達しています。深澤の承認と上限見直しが必要です。経理エージェントを起動してください。"
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$(esc "$REASON")"
  exit 0
fi

# それ以外は深澤の確認(ask)を要求
REASON="${REASON_BASE} 実行前に深澤の許可が必要です。無料の代替手段がないか確認し、課金する場合は金額を accounting/ledger.md に記帳してください。"
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"%s"}}\n' "$(esc "$REASON")"
exit 0
