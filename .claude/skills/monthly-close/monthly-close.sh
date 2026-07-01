#!/bin/bash
# monthly-close.sh — ledger.md の月次締め状態を検査
# 使い方: bash .claude/skills/monthly-close/monthly-close.sh
# 終了コード: 当月セクションが最新=0 / 締め作業が必要=1
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2
LEDGER="accounting/ledger.md"
BUDGET="accounting/budget.md"
[ -f "$LEDGER" ] || { echo "✗ $LEDGER が見つからない"; exit 2; }
FAIL=0

NOW=$(date +%Y-%m)
echo "== 月次締め状態（当月: $NOW） =="

# 当月セクションのヘッダ月を取得
LEDGER_MONTH=$(grep -oE '^## 当月（[0-9]{4}-[0-9]{2}）' "$LEDGER" | grep -oE '[0-9]{4}-[0-9]{2}' | head -1 || true)
if [ -z "$LEDGER_MONTH" ]; then
  echo "  ✗ ledger.md の「## 当月（YYYY-MM）」が未設定（プレースホルダのまま）— SKILL.md の締め手順1〜4を実施"
  FAIL=1
elif [ "$LEDGER_MONTH" != "$NOW" ]; then
  echo "  ✗ ledger.md は ${LEDGER_MONTH} のまま — ${LEDGER_MONTH} 分を accounting/archive/${LEDGER_MONTH}.md へ退避し、当月（$NOW）へ初期化する"
  FAIL=1
else
  echo "  ✓ 当月セクションは最新（$NOW）"
fi

# 累計と上限の照合
TOTAL=$(grep -oE 'CURRENT_TOTAL:[[:space:]]*[0-9]+' "$LEDGER" | grep -oE '[0-9]+' | head -1 || echo "")
LIMIT=$(grep -oE 'MONTHLY_LIMIT:[[:space:]]*[0-9]+' "$BUDGET" 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo "")
if [ -n "$TOTAL" ] && [ -n "$LIMIT" ]; then
  PCT=$(( TOTAL * 100 / LIMIT ))
  if [ "$TOTAL" -gt "$LIMIT" ]; then
    echo "  ✗ 当月累計 ¥${TOTAL} が上限 ¥${LIMIT} を超過（${PCT}%）— 即時停止・深澤へ報告"
    FAIL=1
  else
    echo "  ✓ 当月累計 ¥${TOTAL} / ¥${LIMIT}（${PCT}%）"
  fi
else
  echo "  ✗ CURRENT_TOTAL または MONTHLY_LIMIT をパースできない"
  FAIL=1
fi

# アーカイブの存在（情報表示のみ）
if [ -d accounting/archive ]; then
  echo "  - アーカイブ済み: $(ls accounting/archive/ 2>/dev/null | tr '\n' ' ')"
else
  echo "  - accounting/archive/ は未作成（初回締めで作成する）"
fi

echo ""
if [ "$FAIL" = 0 ]; then echo "==> monthly-close: 締め済み・健全 ✅"; else echo "==> monthly-close: 締め作業が必要 ❌（SKILL.mdの手順を実施）"; fi
exit "$FAIL"
