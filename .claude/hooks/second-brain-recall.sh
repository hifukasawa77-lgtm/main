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

# 04-Knowledge/ の再利用可能な知見を「クイックインデックス」として常時投入する。
# 全文は重いので各ノートのH1見出しのみを列挙し、必要な知見へ最短で辿れるようにする。
# （これが「学び→反映」閉ループの常時稼働部分: 過去の教訓が毎セッション文脈に乗る）
if compgen -G "$VAULT/04-Knowledge/*.md" > /dev/null; then
  echo "### 知見クイックインデックス（04-Knowledge/ — 詳細は各ファイル参照）"
  for f in "$VAULT"/04-Knowledge/*.md; do
    title=$(grep -m1 '^# ' "$f" 2>/dev/null | sed 's/^# //' || true)
    base=$(basename "$f" .md)
    echo "- [[$base]] — ${title:-$base}"
  done
  echo
fi

LATEST_DAILY=$(ls -t "$VAULT/01-Daily"/*.md 2>/dev/null | head -1 || true)
if [ -n "${LATEST_DAILY:-}" ]; then
  echo "### 直近のDaily Note ($(basename "$LATEST_DAILY"))"
  cat "$LATEST_DAILY"
  echo
fi

echo "_(新しい学び・決定事項は obsidian-vault/ に追記する。詳細は .claude/skills/second-brain/SKILL.md を参照)_"
echo "_(セッション区切りでは /self-improve で学びをエージェント定義・CLAUDE.md へ還元する。詳細は .claude/skills/self-improve/SKILL.md)_"
