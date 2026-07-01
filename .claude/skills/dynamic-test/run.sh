#!/bin/bash
# run.sh — dynamic-test-auto.cjs のラッパー。複数HTML・git diff自動検出・PASS/FAIL判定を追加。
# 使い方: bash .claude/skills/dynamic-test/run.sh <file.html ...> | --changed
# 終了コード: 全PASS=0 / FAILあり=1
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2

if [ ! -d node_modules/playwright ]; then
  echo "playwright未インストール。実行: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install" >&2
  exit 2
fi

# 同梱Chromiumがある環境（リモート実行環境等）ではバージョン不一致を避けるため実行パスを固定
if [ -z "${CHROMIUM_PATH:-}" ] && [ -x /opt/pw-browsers/chromium ]; then
  export CHROMIUM_PATH=/opt/pw-browsers/chromium
fi

TARGETS=()
if [ "${1:-}" = "--changed" ]; then
  # 変更されたHTML（未コミット＋ステージ済み）を自動検出
  CHANGED=$(git diff HEAD --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.html$' || true)
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$f" ] && TARGETS+=("$f")
  done <<< "$CHANGED"
  if [ "${#TARGETS[@]}" = 0 ]; then
    echo "変更されたHTMLはありません（git diff HEAD）"
    exit 0
  fi
else
  TARGETS=("$@")
fi

if [ "${#TARGETS[@]}" = 0 ]; then
  echo "使い方: run.sh <file.html ...> | --changed" >&2
  exit 2
fi

FAIL=0
for f in "${TARGETS[@]}"; do
  echo "== dynamic-test: $f =="
  OUT=$(node dynamic-test-auto.cjs "$f" 2>&1)
  RC=$?
  if [ $RC -ne 0 ]; then
    echo "  ✗ 実行エラー: $OUT"
    FAIL=1
    continue
  fi
  # JSON末尾以外にログが混ざる場合に備えpython3で判定
  VERDICT=$(printf '%s' "$OUT" | python3 -c "
import json, sys
raw = sys.stdin.read()
start = raw.find('{')
r = json.loads(raw[start:])
fails = []
if r.get('jsErrors'): fails.append('jsErrors: ' + '; '.join(r['jsErrors'][:3]))
if r.get('notFound'): fails.append('notFound: ' + '; '.join(r['notFound'][:3]))
if r.get('bodyEmpty'): fails.append('bodyEmpty: true')
c = r.get('canvasResult', {})
if c.get('hasCanvas') and c.get('hasDrawing') is False: fails.append('canvas: 描画なし（hasDrawing=false）')
print('SCREENSHOT: ' + str(r.get('screenshotPath')))
if fails:
    print('FAIL')
    [print('  - ' + f) for f in fails]
else:
    print('PASS')
" 2>&1)
  echo "$VERDICT" | sed 's/^/  /'
  if printf '%s' "$VERDICT" | grep -q '^FAIL$'; then FAIL=1; fi
done

echo ""
if [ "$FAIL" = 0 ]; then echo "==> dynamic-test: 全PASS ✅"; else echo "==> dynamic-test: FAILあり ❌"; fi
exit "$FAIL"
