#!/bin/bash
# deploy-verify.sh — GitHub Pages 公開ページの疎通＋スモークテスト
# 使い方: bash .claude/skills/deploy-verify/deploy-verify.sh [--smoke] [page.html ...]
# 終了コード: 全OK=0 / NGあり=1
set -uo pipefail

BASE="https://hifukasawa77-lgtm.github.io/main"
SMOKE=0
PAGES=()
for a in "$@"; do
  if [ "$a" = "--smoke" ]; then SMOKE=1; else PAGES+=("$a"); fi
done
[ "${#PAGES[@]}" = 0 ] && PAGES=(index.html zelda_like.html shogi.html)

FAIL=0
echo "== HTTPステータス確認 =="
for p in "${PAGES[@]}"; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/$p" || true)
  [ "$CODE" = "000" ] && CODE="接続不可"
  if [ "$CODE" = "200" ]; then
    echo "  ✓ 200 $BASE/$p"
  else
    echo "  ✗ $CODE $BASE/$p"
    FAIL=1
  fi
done

if [ "$SMOKE" = 1 ]; then
  echo "== Playwright 本番スモーク（pageerror検知） =="
  ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
  if [ ! -d "$ROOT/node_modules/playwright" ]; then
    echo "  - playwright未インストールのためスキップ（npm install で有効化）"
  else
    if [ -z "${CHROMIUM_PATH:-}" ] && [ -x /opt/pw-browsers/chromium ]; then
      export CHROMIUM_PATH=/opt/pw-browsers/chromium
    fi
    for p in "${PAGES[@]}"; do
      OUT=$(cd "$ROOT" && node .claude/skills/deploy-verify/smoke.cjs "$BASE/$p" 2>&1)
      if printf '%s' "$OUT" | grep -q '^OK'; then
        echo "  ✓ $p — $OUT"
      else
        echo "  ✗ $p — $OUT"
        FAIL=1
      fi
    done
  fi
fi

echo ""
if [ "$FAIL" = 0 ]; then echo "==> deploy-verify: 問題なし ✅"; else echo "==> deploy-verify: NGあり ❌（反映待ち1〜3分の可能性も確認）"; fi
exit "$FAIL"
