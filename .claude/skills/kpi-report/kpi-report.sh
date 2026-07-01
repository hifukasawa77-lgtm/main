#!/bin/bash
# kpi-report.sh — 期間内の開発KPIをMarkdownで集計出力
# 使い方: bash .claude/skills/kpi-report/kpi-report.sh [日数(既定7)]
# 終了コード: 常に0（集計のみ）
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2
DAYS="${1:-7}"
SINCE="${DAYS} days ago"
FROM=$(date -d "-${DAYS} days" +%Y-%m-%d 2>/dev/null || date -v -"${DAYS}"d +%Y-%m-%d)
TODAY=$(date +%Y-%m-%d)

echo "# KPIレポート（${FROM} 〜 ${TODAY} / ${DAYS}日間）"
echo ""

# コミット
N_COMMITS=$(git log --since="$SINCE" --oneline 2>/dev/null | grep -c "" || true)
N_FILES=$(git log --since="$SINCE" --name-only --pretty=format: 2>/dev/null | grep -v '^$' | sort -u | grep -c "" || true)
echo "## 開発アクティビティ"
echo "- コミット数: ${N_COMMITS}"
echo "- 変更ファイル数（ユニーク）: ${N_FILES}"
echo "- 主要変更領域（上位5）:"
git log --since="$SINCE" --name-only --pretty=format: 2>/dev/null | grep -v '^$' \
  | sed 's|/.*||' | sort | uniq -c | sort -rn | head -5 | sed 's/^/  - /'
echo ""

# Vault
echo "## ナレッジ・意思決定"
N_ADR=0
for f in obsidian-vault/03-Decisions/*.md; do
  [ -f "$f" ] || continue
  D=$(grep -oE '^date: [0-9]{4}-[0-9]{2}-[0-9]{2}' "$f" | grep -oE '[0-9-]+' || true)
  if [ -n "$D" ] && [ "$D" \> "$FROM" ]; then N_ADR=$((N_ADR+1)); fi
done
N_DAILY=$(find obsidian-vault/01-Daily -name '*.md' -newermt "$FROM" 2>/dev/null | grep -c "" || true)
echo "- 期間内ADR（意思決定）: ${N_ADR}"
echo "- 期間内Daily Note: ${N_DAILY}"
echo ""

# パイプラインKPI（Dailyの [pipeline] 行から集計）
echo "## パイプラインKPI（Daily記録から）"
PIPE=$(grep -h '\[pipeline\]' obsidian-vault/01-Daily/*.md 2>/dev/null || true)
if [ -z "$PIPE" ]; then
  echo "- 記録なし（記録書式は SKILL.md 参照）"
else
  N_RUN=$(printf '%s\n' "$PIPE" | grep -c "" || true)
  N_PASS=$(printf '%s\n' "$PIPE" | grep -c 'PASS' || true)
  echo "- 実行数: ${N_RUN} / PASS: ${N_PASS}"
  printf '%s\n' "$PIPE" | sed 's/^ *//;s/^/- /' | head -10
fi
echo ""

# 成果物の総量（ストック指標）
N_HTML=$(find . -name '*.html' -not -path './node_modules/*' -not -path './.git/*' -not -path './.claude/*' -not -path './test-screenshots/*' | grep -c "" || true)
N_SKILLS=$(find .claude/skills -name 'SKILL.md' 2>/dev/null | grep -c "" || true)
N_AGENTS=$(find .claude/agents -name '*.md' 2>/dev/null | grep -c "" || true)
echo "## ストック指標"
echo "- 公開HTML総数: ${N_HTML} / スキル: ${N_SKILLS} / エージェント: ${N_AGENTS}"
exit 0
