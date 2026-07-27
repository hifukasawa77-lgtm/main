#!/bin/bash
# i18n-check.sh — 日英バイリンガル表記の一貫性監査
# 使い方: bash .claude/skills/i18n-check/i18n-check.sh [file.html ...]
# 終了コード: 必須項目OK=0 / 問題あり=1（[warn]はFAILにしない）
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2

if [ $# -gt 0 ]; then FILES="$(printf '%s\n' "$@")"; else
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
  TITLE=$(grep -oiE '<title[^>]*>[^<]*' "$f" | head -1 | sed 's/<[^>]*>//')
  if [ -n "$TITLE" ]; then
    # `(*UTF)` は必須。C locale（ANSI_X3.4-1968）では PCRE がバイトモードになり
    # `\x{3040}` 等が "character code point value ... is too large" で毎行エラーになる。
    # エラー時も grep -c は 0 を返すため、日本語タイトルが「日本語なし」と誤判定され
    # [warn] の出方が静かに狂っていた（2026-07-28に発見・修正）。
    HAS_JA=$(printf '%s' "$TITLE" | grep -cP '(*UTF)[\x{3040}-\x{30ff}\x{4e00}-\x{9fff}]' 2>/dev/null || true)
    HAS_EN=$(printf '%s' "$TITLE" | grep -cE '[A-Za-z]{3,}' || true)
    if [ "${HAS_JA:-0}" -gt 0 ] && [ "${HAS_EN:-0}" = 0 ]; then ISSUES="$ISSUES [warn]title日本語のみ;"; fi
    if [ "${HAS_JA:-0}" = 0 ] && [ "${HAS_EN:-0}" -gt 0 ]; then ISSUES="$ISSUES [warn]title英語のみ;"; fi
  fi
  if [ -n "$ISSUES" ]; then
    echo "  ✗ $f —$ISSUES"
    printf '%s' "$ISSUES" | sed 's/\[warn\][^;]*;//g' | grep -q '[^ ]' && FAIL=1
  fi
done <<< "$FILES"

echo ""
if [ "$FAIL" = 0 ]; then
  echo "==> i18n-check: ${TOTAL}件検査、必須項目OK ✅（[warn]は日英併記の推奨）"
else
  echo "==> i18n-check: 要対応 ❌（lang属性の欠落を是正）"
fi
exit "$FAIL"
