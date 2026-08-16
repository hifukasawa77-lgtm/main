#!/usr/bin/env bash
# backfill-daily.sh — Dailyの無い作業日に、git log から骨組みを起こす
#
# harness-lint 検査#9 が「作業コミットはあるが Daily が無い日」を警告する。
# その日の作業内容は git log にあるので、骨組みまでは機械で起こせる。
# **学び・決定は人／LLMが書く**（ここは空欄のまま残す。埋めずにコミットしてよい）。
#
#   bash .claude/skills/second-brain/backfill-daily.sh            # 直近14日・dry-run（作る対象を表示）
#   bash .claude/skills/second-brain/backfill-daily.sh --write     # 実際にファイルを作る
#   bash .claude/skills/second-brain/backfill-daily.sh --days 30 --write
#
# 既存の Daily は絶対に上書きしない（存在する日はスキップ）。
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1
DAILY_DIR="obsidian-vault/01-Daily"
DAYS=14
WRITE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --write) WRITE=1; shift ;;
    --days)  DAYS="${2:-14}"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

since="$(date -d "-${DAYS} days" +%Y-%m-%d 2>/dev/null)" || { echo "date コマンドが GNU date ではありません" >&2; exit 2; }
created=0
skipped=0

# 対象日を列挙（マージコミットは作業実体ではないので除外）。
# 注意: --since/--until は**コミッタ日付**で絞るのに %ad は**作者日付**を出すため、
# 日ごとに git log を引き直すと両者がズレた日（rebase/PR取込）を取りこぼす。
# ここでは1回のログ取得を作者日付でグルーピングし、以降その結果だけを使う。
LOG_TSV="$(git log --no-merges --since="$since" --date=short --pretty=format:'%ad%x09%H%x09%s')"
[ -z "$LOG_TSV" ] && { echo "対象期間（${since} 以降）に作業コミットがありません"; exit 0; }
days="$(cut -f1 <<< "$LOG_TSV" | sort -u)"

while IFS= read -r day; do
  [ -z "$day" ] && continue
  out="${DAILY_DIR}/${day}.md"
  if [ -f "$out" ]; then
    skipped=$((skipped+1))
    continue
  fi

  # その日のコミット（件名・ハッシュ）を、取得済みログから取り出す
  day_rows="$(awk -F'\t' -v d="$day" '$1==d' <<< "$LOG_TSV")"
  [ -z "$day_rows" ] && continue
  subjects="$(cut -f3 <<< "$day_rows" | sed 's/^/- /')"
  hashes="$(cut -f2 <<< "$day_rows")"
  areas="$(git show --name-only --pretty=format: $hashes 2>/dev/null \
            | grep -v '^$' | awk -F/ '{print ($1 ~ /\./) ? $1 : $1"/"}' | sort -u | head -8 | paste -sd' ' -)"

  if [ "$WRITE" -eq 0 ]; then
    echo "[dry-run] 作成対象: $out"
    created=$((created+1))
    continue
  fi

  {
    echo '---'
    echo 'type: daily'
    echo "date: ${day}"
    echo 'tags: [daily, backfill]'
    echo '---'
    echo
    echo "# ${day}"
    echo
    echo '## 作業記録（遡及・git log から再構成）'
    echo
    echo "$subjects"
    echo
    echo "触れた領域: ${areas:-（不明）}"
    echo
    echo '### 学び'
    echo
    echo '<!-- 骨組みは機械生成。学び・決定があれば当時の差分を見て追記する。'
    echo '     無ければこのコメントごと消して「特記なし」と書いてよい（空のまま放置しない）。 -->'
    echo
    echo '_(遡及作成のため詳細は git log を正とする。新しい学び・決定は obsidian-vault/ に追記する)_'
  } > "$out"
  echo "作成: $out"
  created=$((created+1))
done <<< "$days"

echo
if [ "$WRITE" -eq 0 ]; then
  echo "dry-run: ${created}日が作成対象（既存 ${skipped}日はスキップ）。--write で実行する"
else
  echo "完了: ${created}日を作成（既存 ${skipped}日はスキップ）"
fi
