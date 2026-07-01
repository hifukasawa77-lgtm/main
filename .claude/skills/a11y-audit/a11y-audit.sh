#!/bin/bash
# a11y-audit.sh — アクセシビリティの静的監査
# 使い方: bash .claude/skills/a11y-audit/a11y-audit.sh [file.html ...]
# 終了コード: 問題なし=0 / 問題あり=1
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2

if [ $# -gt 0 ]; then
  FILES="$(printf '%s\n' "$@")"
else
  FILES=$(find . -name '*.html' \
    -not -path './node_modules/*' -not -path './.git/*' -not -path './.claude/*' \
    -not -path './test-screenshots/*' -not -path './gamekit/*' \
    -not -name 'admin*.html' -not -name 'template.html' | sed 's|^\./||' | sort)
fi

FAIL=0
TOTAL=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  TOTAL=$((TOTAL+1))
  ISSUES=""
  grep -qiE '<html[^>]*lang=' "$f" || ISSUES="$ISSUES lang属性なし;"
  grep -qiE '<title' "$f" || ISSUES="$ISSUES titleなし;"
  # alt無しimg（img行のうちaltを含まないもの）
  NOALT=$(grep -oiE '<img[^>]*>' "$f" | grep -civ 'alt=' || true)
  [ "${NOALT:-0}" -gt 0 ] && ISSUES="$ISSUES alt無しimg×${NOALT};"
  # canvasにaria/role/フォールバックなし
  if grep -qi '<canvas' "$f"; then
    grep -oiE '<canvas[^>]*>' "$f" | grep -qiE 'aria-label|role=' || ISSUES="$ISSUES canvasにaria-label/roleなし;"
  fi
  # アニメーション持ちページ（rAF使用）でreduced-motion未対応（警告扱い＝FAILにはしない）
  if grep -q 'requestAnimationFrame' "$f" && ! grep -q 'prefers-reduced-motion' "$f"; then
    ISSUES="$ISSUES [warn]reduced-motion未対応;"
  fi
  if [ -n "$ISSUES" ]; then
    echo "  ✗ $f —$ISSUES"
    # [warn]のみの行はFAILにしない
    printf '%s' "$ISSUES" | sed 's/\[warn\][^;]*;//g' | grep -q '[^ ]' && FAIL=1
  fi
done <<< "$FILES"

echo ""
if [ "$FAIL" = 0 ]; then
  echo "==> a11y-audit: ${TOTAL}件検査、必須項目の問題なし ✅（[warn]は任意対応）"
else
  echo "==> a11y-audit: 要対応 ❌（SKILL.mdの指針で是正）"
fi
exit "$FAIL"
