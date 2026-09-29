#!/usr/bin/env bash
# ctx-peek.sh FILE PATTERN [MAX]
# FILE 内の PATTERN 該当行を「行番号: 先頭100字」だけ出し、Read用の推奨 offset/limit を添える。
# ファイルを丸ごと読まずに着手位置を決めるための補助（出力は最大 MAX 件、既定20）。
set -u
f="${1:-}"; pat="${2:-}"; max="${3:-20}"
if [ -z "$f" ] || [ -z "$pat" ]; then
  echo "usage: ctx-peek.sh FILE PATTERN [MAX]" >&2; exit 2
fi
[ -f "$f" ] || { echo "not found: $f" >&2; exit 2; }
total=$(wc -l < "$f")
echo "# $f (${total} lines) / pattern: $pat"
grep -nE -- "$pat" "$f" | head -n "$max" | while IFS= read -r line; do
  n=${line%%:*}
  start=$(( n > 30 ? n - 30 : 1 ))
  printf '%s  → Read offset=%d limit=60\n' "$(printf '%s' "$line" | cut -c1-100)" "$start"
done
cnt=$(grep -cE -- "$pat" "$f")
[ "$cnt" -gt "$max" ] && echo "# ...他 $((cnt - max)) 件（パターンを絞ること）"
exit 0
