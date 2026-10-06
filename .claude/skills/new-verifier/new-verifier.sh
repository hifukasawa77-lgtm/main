#!/bin/bash
# new-verifier.sh — 機械検査 scripts/verify-<名前>.mjs をひな形から起こす
# 使い方: bash .claude/skills/new-verifier/new-verifier.sh <名前> <対象ページ.html>
#   例:   bash .claude/skills/new-verifier/new-verifier.sh shogi shogi.html
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2
NAME="${1:-}"; PAGE="${2:-}"
if ! [[ "$NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]] || [ -z "$PAGE" ]; then
  echo "使い方: $0 <名前(英小文字-数字)> <対象ページ.html>"; exit 2
fi
[ -f "$PAGE" ] || { echo "✗ 対象ページが無い: $PAGE"; exit 2; }
OUT="scripts/verify-$NAME.mjs"
[ -e "$OUT" ] && { echo "✗ 既に存在: $OUT（上書きしない）"; exit 2; }
sed -e "s/__NAME__/$NAME/g" -e "s|__PAGE__|$PAGE|g" .claude/skills/new-verifier/verify-template.mjs > "$OUT"
chmod +x "$OUT"
echo "✓ $OUT を作成"
echo "次にやること（1つでも欠けると次のセッションが検査の存在に気づかない）:"
echo "  1. 「守りたい不変条件」節に、中身まで見る検査を書く"
echo "  2. node $OUT --inject で ❌ が出ることを確認（偽の緑は検査が無いより悪い）"
echo "  3. .claude/agent-conventions.md §4 の対応表へ1行追加"
echo "  4. CLAUDE.md の該当節へ追記 → bash .claude/skills/self-improve/harness-lint.sh"
