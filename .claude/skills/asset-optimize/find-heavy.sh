#!/bin/bash
# find-heavy.sh — 大容量アセット（画像/JSON/音声/JS）の検出
# 使い方: bash .claude/skills/asset-optimize/find-heavy.sh [閾値KB(既定150)]
# 終了コード: 閾値超なし=0 / あり=1
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2
THRESHOLD_KB="${1:-150}"

HEAVY=$(find . \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.gif' -o -name '*.webp' \
  -o -name '*.json' -o -name '*.ogg' -o -name '*.mp3' -o -name '*.wav' -o -name '*.js' \) \
  -not -path './node_modules/*' -not -path './.git/*' -not -path './.claude/*' \
  -not -path './test-screenshots/*' -not -name 'package-lock.json' \
  -size +"${THRESHOLD_KB}"k -exec du -k {} \; | sort -rn)

if [ -z "$HEAVY" ]; then
  echo "==> asset-optimize: ${THRESHOLD_KB}KB 超のアセットなし ✅"
  exit 0
fi

COUNT=0
printf '%10s  %s\n' "SIZE" "FILE"
while IFS= read -r line; do
  KB=$(printf '%s' "$line" | cut -f1)
  F=$(printf '%s' "$line" | cut -f2-)
  printf '%8sKB  %s\n' "$KB" "$F"
  COUNT=$((COUNT+1))
done <<< "$HEAVY"

echo ""
echo "==> asset-optimize: ${THRESHOLD_KB}KB 超 ${COUNT} 件 ❌（SKILL.mdの優先順位で削減）"
exit 1
