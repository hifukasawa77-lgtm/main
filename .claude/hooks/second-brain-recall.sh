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

# mtime順(ls -t)は使わない: CCRリモート環境はフレッシュクローンで全ファイルのmtimeが
# ほぼ同一になり最新判定が壊れる。ファイル名が YYYY-MM-DD.md なので名前順が正。
LATEST_DAILY=$(ls "$VAULT/01-Daily"/*.md 2>/dev/null | sort | tail -1 || true)
if [ -n "${LATEST_DAILY:-}" ]; then
  # コンテキスト節約のため全文は投入しない（[[0012-session-context-diet]]）:
  # 見出し一覧＋「次回への引き継ぎ」系セクション（最後の一致）のみ。
  # 全文が必要な場合は該当セクションを grep + offset/limit で読む。
  echo "### 直近のDaily Note ($(basename "$LATEST_DAILY")) — 抜粋（全文: $LATEST_DAILY）"
  echo "セクション見出し:"
  grep -E '^## ' "$LATEST_DAILY" | sed 's/^## /- /'
  echo
  CARRY=$(awk '
    /^## /{insec = ($0 ~ /引き継ぎ|持ち越し/); if(insec){buf=""}}
    insec{buf = buf $0 ORS}
    END{printf "%s", buf}
  ' "$LATEST_DAILY" | head -c 3000)
  if [ -n "$CARRY" ]; then
    printf '%s\n' "$CARRY"
  else
    # 引き継ぎセクションがない場合のフォールバック: 末尾のみ
    tail -c 1200 "$LATEST_DAILY"
    echo
  fi
fi

echo "_(新しい学び・決定事項は obsidian-vault/ に追記する。詳細は .claude/skills/second-brain/SKILL.md を参照)_"
echo "_(セッション区切りでは /self-improve で学びをエージェント定義・CLAUDE.md へ還元する。詳細は .claude/skills/self-improve/SKILL.md)_"
