#!/bin/bash
set -euo pipefail

VAULT="${CLAUDE_PROJECT_DIR:-.}/obsidian-vault"
[ -d "$VAULT" ] || exit 0

echo "## 🧠 第二の脳（obsidian-vault/）からの記憶"
echo

if [ -f "$VAULT/MOC.md" ]; then
  echo "### MOC（目次）"
  cat "$VAULT/MOC.md"
  echo
fi

LATEST_DAILY=$(ls -t "$VAULT/01-Daily"/*.md 2>/dev/null | head -1 || true)
if [ -n "${LATEST_DAILY:-}" ]; then
  echo "### 直近のDaily Note ($(basename "$LATEST_DAILY"))"
  cat "$LATEST_DAILY"
  echo
fi

echo "_(新しい学び・決定事項は obsidian-vault/ に追記する。詳細は .claude/skills/second-brain/SKILL.md を参照)_"
