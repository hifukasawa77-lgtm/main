#!/bin/bash
# release-check.sh — コミット/デプロイ前の機械チェック（workflowスキルのチェックリスト機械化）
# 使い方: bash .claude/skills/release-check/release-check.sh
# 終了コード: 問題なし=0 / 問題あり=1
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2
FAIL=0
note_fail() { echo "  ✗ $1"; FAIL=1; }
ok() { echo "  ✓ $1"; }

echo "== 1. ブラウザプロファイル/一時ディレクトリの混入 =="
PROFILES=$(git ls-files --cached --others --exclude-standard 2>/dev/null \
  | grep -E '(^|/)(\.edge-test-profile|tmp-edge-profile-[^/]*|\.playwright-profile)(/|$)' | cut -d/ -f1 | sort -u || true)
if [ -z "$PROFILES" ]; then ok "混入なし"; else
  while IFS= read -r p; do [ -n "$p" ] && note_fail "プロファイル混入: $p（削除または .gitignore へ）"; done <<< "$PROFILES"
fi

echo "== 2. console.log の追加行（git diff HEAD） =="
LOGS=$(git diff HEAD --unified=0 -- '*.html' '*.js' 2>/dev/null | grep -E '^\+[^+].*console\.log' | head -10 || true)
if [ -z "$LOGS" ]; then ok "追加なし"; else
  while IFS= read -r l; do [ -n "$l" ] && note_fail "console.log残り: ${l:0:100}"; done <<< "$LOGS"
fi

echo "== 3. CDNスクリプトの SRI（integrity）欠落（変更HTML） =="
CHANGED_HTML=$(git diff HEAD --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.html$' || true)
if [ -z "$CHANGED_HTML" ]; then ok "変更HTMLなし"; else
  SRI_OK=1
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    NOSRI=$(grep -oE '<script[^>]*src="https://[^"]*"[^>]*>' "$f" | grep -cv 'integrity=' || true)
    if [ "${NOSRI:-0}" -gt 0 ]; then note_fail "$f: SRIなしのCDNスクリプト ×${NOSRI}"; SRI_OK=0; fi
  done <<< "$CHANGED_HTML"
  [ "$SRI_OK" = 1 ] && ok "SRI欠落なし"
fi

echo "== 4. 1MB超の新規/変更ファイル =="
BIG_OK=1
BIGLIST=$(git diff HEAD --name-only --diff-filter=ACM 2>/dev/null || true)
while IFS= read -r f; do
  [ -n "$f" ] && [ -f "$f" ] || continue
  SZ=$(du -k "$f" | cut -f1)
  if [ "$SZ" -gt 1024 ]; then note_fail "大容量: $f (${SZ}KB) — /asset-optimize で削減を検討"; BIG_OK=0; fi
done <<< "$BIGLIST"
[ "$BIG_OK" = 1 ] && ok "1MB超なし"

echo "== 5. APIキー/シークレットらしき文字列（追加行） =="
SECRETS=$(git diff HEAD --unified=0 2>/dev/null \
  | grep -E '^\+[^+]' \
  | grep -aE 'sk-ant-|sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|_API_KEY[[:space:]]*[=:][[:space:]]*["'"'"'][^"'"'"']{8,}|hooks\.slack\.com/services/' \
  | head -5 || true)
if [ -z "$SECRETS" ]; then ok "検出なし"; else
  while IFS= read -r l; do [ -n "$l" ] && note_fail "シークレット疑い: ${l:0:60}...（コミット禁止・即削除）"; done <<< "$SECRETS"
fi

echo "== 6. test-screenshots/ の混入（ステージ済み） =="
SHOTS=$(git diff --cached --name-only 2>/dev/null | grep -c 'test-screenshots/' || true)
if [ "${SHOTS:-0}" = 0 ]; then ok "混入なし"; else note_fail "test-screenshots/ が ${SHOTS} 件ステージされている（unstageする）"; fi

echo ""
echo "-- git diff --stat（参考） --"
git diff HEAD --stat 2>/dev/null | tail -3

echo ""
if [ "$FAIL" = 0 ]; then echo "==> release-check: 問題なし ✅（次: /dynamic-test → コミット）"; else echo "==> release-check: 要対応 ❌"; fi
exit "$FAIL"
