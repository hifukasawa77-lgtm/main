#!/bin/bash
# perf-audit.sh — ページ重量（HTML＋参照ローカルアセット）の実測レポート
# 使い方: bash .claude/skills/perf-audit/perf-audit.sh [file.html ...]
# 終了コード: 全ページ1MB以内=0 / 超過あり=1
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2

if [ $# -gt 0 ]; then TARGETS="$(printf '%s\n' "$@")"; else
  TARGETS=$(find . -maxdepth 2 -name '*.html' \
    -not -path './node_modules/*' -not -path './.git/*' -not -path './.claude/*' \
    -not -path './test-screenshots/*' -not -path './gamekit/*' \
    -not -name 'admin*.html' | sed 's|^\./||' | sort)
fi

printf '%s\n' "$TARGETS" | python3 - <<'PY'
import os, re, sys

targets = [l.strip() for l in sys.stdin if l.strip() and os.path.isfile(l.strip())]
WARN, LIMIT = 500*1024, 1024*1024
fail = False
rows = []
for f in targets:
    html = open(f, encoding='utf-8', errors='ignore').read()
    base = os.path.dirname(f)
    total = os.path.getsize(f)
    n_assets = 0
    seen = set()
    for m in re.finditer(r'(?:src|href)\s*=\s*["\']([^"\'#?]+)', html):
        u = m.group(1)
        if re.match(r'^(https?:|//|data:|mailto:|javascript:)', u): continue
        p = os.path.normpath(os.path.join(base, u))
        if p in seen or not os.path.isfile(p): continue
        seen.add(p)
        if re.search(r'\.(png|jpe?g|gif|webp|svg|js|css|json|ogg|mp3|wav|woff2?)$', p, re.I):
            total += os.path.getsize(p); n_assets += 1
    rows.append((total, f, n_assets))

rows.sort(reverse=True)
print(f"{'WEIGHT':>10}  {'ASSETS':>6}  PAGE")
for total, f, n in rows:
    mark = '❌' if total > LIMIT else ('⚠️ ' if total > WARN else '  ')
    if total > LIMIT: fail = True
    print(f"{total/1024:>8.0f}KB  {n:>6}  {mark} {f}")
print()
over = sum(1 for t, _, _ in rows if t > LIMIT)
print(f"==> perf-audit: {len(rows)}ページ計測、1MB超過 {over} 件" + ("（/asset-optimize で削減） ❌" if fail else " ✅"))
sys.exit(1 if fail else 0)
PY
