#!/bin/bash
# seo-audit.sh — 全HTMLのOGP/meta欠落を機械監査
# 使い方: bash .claude/skills/seo-audit/seo-audit.sh [file.html ...]
# 終了コード: 欠落なし=0 / 欠落あり=1
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

MISS=0
TOTAL=0
printf '%-52s %-8s %-8s %-8s %-8s %-9s %-9s\n' "FILE" "og:title" "og:desc" "og:image" "tw:card" "meta:desc" "canonical"
while IFS= read -r f; do
  [ -f "$f" ] || continue
  TOTAL=$((TOTAL+1))
  HEAD_PART=$(head -c 20000 "$f")
  ROW=""
  BAD=0
  for pat in 'og:title' 'og:description' 'og:image' 'twitter:card' 'name="description"' 'rel="canonical"'; do
    if printf '%s' "$HEAD_PART" | grep -qi "$pat"; then
      ROW="$ROW ✓       "
    else
      ROW="$ROW -       "
      BAD=1
    fi
  done
  if [ "$BAD" = 1 ]; then
    printf '%-52s%s\n' "$f" "$ROW"
    MISS=$((MISS+1))
  fi
done <<< "$FILES"

echo ""
echo "==> seo-audit: 対象 ${TOTAL} 件中、欠落あり ${MISS} 件（✓のみの行は非表示）"
[ "$MISS" = 0 ] && { echo "==> 問題なし ✅"; exit 0; } || { echo "==> 要対応 ❌（SKILL.mdのOGPテンプレで是正）"; exit 1; }
