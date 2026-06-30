#!/bin/bash
# harness-lint.sh — ハーネス整合性の一括検査
# /self-improve の手順0（振り返り前のヘルスチェック）として実行する。
# 今日までに手作業で繰り返した監査（SKILL.md欠落・frontmatter・色ドリフト・
# 課金ガードの2段ゲート同期・主要参照の実在）を機械化したもの。
# 使い方: bash .claude/skills/self-improve/harness-lint.sh
# 終了コード: 問題なし=0 / 問題あり=1
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2
FAIL=0
note_fail() { echo "  ✗ $1"; FAIL=1; }
ok() { echo "  ✓ $1"; }

echo "== 1. スキルの SKILL.md 存在チェック =="
for d in .claude/skills/*/; do
  d="${d%/}"
  if [ -f "$d/SKILL.md" ]; then
    ok "$d/SKILL.md"
  else
    note_fail "$d に SKILL.md なし（$(ls "$d" 2>/dev/null | tr '\n' ' ')）— スキルとしてロードされない"
  fi
done

echo "== 2. frontmatter 検証（agents + skills: 1行目---, name:, description:, 閉じ---）=="
for f in .claude/agents/*.md .claude/skills/*/SKILL.md; do
  [ -f "$f" ] || continue
  [ "$(sed -n '1p' "$f")" = "---" ] || { note_fail "$f: 1行目が --- でない"; continue; }
  awk 'NR>1 && $0=="---"{found=1;exit} END{exit !found}' "$f" || { note_fail "$f: 閉じ --- なし"; continue; }
  fm=$(awk 'NR==1{next} $0=="---"{exit} {print}' "$f")
  echo "$fm" | grep -q '^name:' || { note_fail "$f: name: なし"; continue; }
  echo "$fm" | grep -q '^description:' || { note_fail "$f: description: なし"; continue; }
  ok "$f"
done

echo "== 3. 課金ガードの2段ゲート同期（settings.json matcher == BILLING_RISK_TOOLS）=="
if [ -f .claude/settings.json ] && [ -f .claude/hooks/accounting-guard.sh ]; then
  M=$(python3 -c "import json,sys;d=json.load(open('.claude/settings.json'));print([h['matcher'] for h in d.get('hooks',{}).get('PreToolUse',[]) if 'accounting-guard' in str(h)][0])" 2>/dev/null || echo "__ERR__")
  B=$(grep -oE "BILLING_RISK_TOOLS='[^']*'" .claude/hooks/accounting-guard.sh | sed "s/BILLING_RISK_TOOLS='//;s/'$//")
  if [ "$M" = "__ERR__" ] || [ -z "$M" ]; then
    note_fail "settings.json から accounting-guard の matcher を取得できない"
  elif [ "$M" = "$B" ]; then
    ok "matcher == BILLING_RISK_TOOLS"
  else
    note_fail "不一致: matcher='$M' / BILLING_RISK_TOOLS='$B'（matcherは上位集合＝同一文字列であること）"
  fi
else
  echo "  - 課金ガード未設定（スキップ）"
fi

echo "== 4. 色ドリフト（CLAUDE.md禁止のマゼンタ/原色ネオンが指示として残っていないか）=="
# 禁止文（禁止/使わない/避け）を除いた、指示としての #ff00ff / ネオンシアン を検出。
# このスクリプト自身は検出パターン文字列を含むため除外する。
DRIFT=$(grep -rniE '#ff00ff|ネオンシアン|マゼンタ' .claude/agents .claude/skills 2>/dev/null \
  | grep -v 'harness-lint.sh' \
  | grep -vE '禁止|使わない|使用しない|避け|NG|準拠' || true)
if [ -z "$DRIFT" ]; then
  ok "色ドリフトなし"
else
  # パイプを避け（サブシェルだとFAILが親へ伝播しない）here-stringで回す
  while IFS= read -r l; do
    [ -n "$l" ] && note_fail "色ドリフト疑い: $l"
  done <<< "$DRIFT"
fi

echo "== 5. CLAUDE.md正の具体値ドリフト（予算/採点閾値/作業ブランチが再掲先と一致するか）=="
# 色以外の重複した具体値（閾値・予算・ブランチ名）も必ずドリフトする（[[harness-maintenance-patterns]]）。
# 正の単一ソースから値を導出し、再掲している各ファイルと突き合わせる（カンマ表記差は除去して比較）。
# 6a. 予算上限: 正=accounting/budget.md の MONTHLY_LIMIT（ガードが実際に読む値）
if [ -f accounting/budget.md ]; then
  LIM=$(grep -oE 'MONTHLY_LIMIT:[[:space:]]*[0-9]+' accounting/budget.md | grep -oE '[0-9]+' | head -1)
  if [ -n "$LIM" ]; then
    for f in CLAUDE.md .claude/agents/accounting-agent.md; do
      [ -f "$f" ] || continue
      if grep -qE "¥?${LIM}" <(tr -d ',' < "$f"); then ok "予算上限 ¥${LIM} 整合: $f"
      else note_fail "予算上限ドリフト: $f が budget.md の ¥${LIM} と不一致"; fi
    done
  fi
fi
# 6b. Evaluator合格閾値: 正=CLAUDE.md「N点以上 かつ … M点以上」
read -r T1 T2 < <(grep -oE '[0-9]+点以上' CLAUDE.md | grep -oE '[0-9]+' | head -2 | tr '\n' ' ')
if [ -n "${T1:-}" ] && [ -n "${T2:-}" ]; then
  if grep -qE "${T1}.*${T2}|${T2}.*${T1}" .claude/agents/evaluator.md; then ok "採点閾値 ${T1}/${T2} 整合: evaluator.md"
  else note_fail "採点閾値ドリフト: evaluator.md が CLAUDE.md の ${T1}点/${T2}点 と不一致"; fi
fi
# 6c. 作業ブランチ: 正=CLAUDE.md「作業ブランチ: \`xxx\`」
WB=$(grep -E '作業ブランチ:' CLAUDE.md | grep -oE '`[^`]+`' | head -1 | tr -d '`')
if [ -n "$WB" ]; then
  if grep -qE "作業ブランチ.*${WB}" .claude/agents/pmo.md; then ok "作業ブランチ ${WB} 整合: pmo.md"
  else note_fail "作業ブランチドリフト: pmo.md が CLAUDE.md の ${WB} と不一致"; fi
fi

echo "== 6. 主要参照パスの実在 =="
for p in \
  .claude/hooks/second-brain-recall.sh .claude/hooks/accounting-guard.sh .claude/hooks/notify-slack.sh \
  .claude/skills/second-brain/SKILL.md .claude/skills/self-improve/SKILL.md \
  gamekit/gamekit.js gamekit/template.html \
  accounting/budget.md accounting/ledger.md \
  obsidian-vault/MOC.md obsidian-vault/Templates/decision-note.md ; do
  [ -e "$p" ] && ok "$p" || note_fail "参照先なし: $p"
done

echo ""
if [ "$FAIL" = 0 ]; then
  echo "==> harness-lint: 問題なし ✅"
else
  echo "==> harness-lint: 問題あり ❌（上記 ✗ を /self-improve で是正）"
fi
exit "$FAIL"
