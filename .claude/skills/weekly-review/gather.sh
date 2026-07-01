#!/bin/bash
# gather.sh — 週次振り返りの素材（直近7日のDaily/ADR/コミット）を収集して表示
# 使い方: bash .claude/skills/weekly-review/gather.sh [日数(既定7)]
# 終了コード: 常に0
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2
DAYS="${1:-7}"
FROM=$(date -d "-${DAYS} days" +%Y-%m-%d 2>/dev/null || date -v -"${DAYS}"d +%Y-%m-%d)

echo "# 週次振り返り素材（${FROM} 〜 $(date +%Y-%m-%d)）"
echo ""

echo "## 期間内の Daily Note"
FOUND=0
for f in obsidian-vault/01-Daily/*.md; do
  [ -f "$f" ] || continue
  D=$(basename "$f" .md)
  if [ "$D" \> "$FROM" ] || [ "$D" = "$FROM" ]; then
    FOUND=1
    echo "--- $f ---"
    cat "$f"
    echo ""
  fi
done
[ "$FOUND" = 0 ] && echo "（なし）"
echo ""

echo "## 期間内の ADR（03-Decisions/）"
FOUND=0
for f in obsidian-vault/03-Decisions/*.md; do
  [ -f "$f" ] || continue
  D=$(grep -oE '^date: [0-9]{4}-[0-9]{2}-[0-9]{2}' "$f" | grep -oE '[0-9-]+' || true)
  if [ -n "$D" ] && { [ "$D" \> "$FROM" ] || [ "$D" = "$FROM" ]; }; then
    FOUND=1
    TITLE=$(grep -m1 '^# ' "$f" | sed 's/^# //')
    echo "- $(basename "$f"): ${TITLE}"
  fi
done
[ "$FOUND" = 0 ] && echo "（なし）"
echo ""

echo "## 期間内のコミット"
git log --since="${DAYS} days ago" --pretty='- %ad %s' --date=short 2>/dev/null | head -30
echo ""

echo "## 未整理（00-Inbox/）"
INBOX=$(ls obsidian-vault/00-Inbox/*.md 2>/dev/null || true)
if [ -z "$INBOX" ]; then echo "（空 — 良好）"; else printf '%s\n' "$INBOX" | sed 's/^/- /'; fi
exit 0
