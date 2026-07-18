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
WARN=0
note_fail() { echo "  ✗ $1"; FAIL=1; }
note_warn() { echo "  △ $1"; WARN=1; }
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

echo "== 7. mtime依存ソート（ls -t 等）が .claude スクリプトにないか =="
# CCRリモート環境はフレッシュクローンで全ファイルのmtimeがほぼ同一になるため、
# hooks/skills のスクリプトで mtime順ソートに依存すると選択結果が不定になる
# （recall hook が「直近のDaily」を誤選択した実例: 2026-07-09）。
# このスクリプト自身は検出パターン文字列を含むため除外する。
MT=$(grep -rnE 'ls[[:space:]]+-[a-zA-Z]*t|find[[:space:]].*-newer|sort[[:space:]].*-k.*%Y' \
  .claude/hooks .claude/skills --include='*.sh' --include='*.cjs' 2>/dev/null \
  | grep -v 'harness-lint.sh' \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*#' || true)
if [ -z "$MT" ]; then
  ok "mtime依存ソートなし"
else
  while IFS= read -r l; do
    [ -n "$l" ] && note_fail "mtime依存ソート疑い（フレッシュクローンで不定）: $l"
  done <<< "$MT"
fi

echo "== 8. 未昇格の学びを含むDaily（昇格漏れリマインド・警告のみ／exit codeに影響しない）=="
# 「学び」セクションを含むDailyに 昇格済み/反映済み マーカーが無ければ警告する。
# 学びの昇格は /self-improve の手順1〜4で行う人間+LLM作業のため、この検査は
# 非ブロッキング（△）。手作業でやっていた「未マーカーDailyの遡り点検」の機械化（2026-07-16）。
for f in obsidian-vault/01-Daily/*.md; do
  [ -f "$f" ] || continue
  # 明示の未昇格マーカーは最優先で警告する。ファイル内に昇格済みマーカーが同居して
  # いても（セクション単位で昇格状況が異なるDaily）取りこぼさない（2026-07-17の実例:
  # 冒頭セクションの「昇格済み」で後続2件の未昇格が不可視化されていた）。
  # マーカー実体（太字 **未昇格**）のみ拾う。地の文の言及（「未昇格4件を昇格」等）は対象外
  if grep -q '\*\*未昇格\*\*' "$f"; then
    note_warn "$f: 未昇格マーカーあり（/self-improve で昇格する）"
    continue
  fi
  # 見出し型（## 学んだこと）に加え inline 太字型（**学び（…）**）も学びとして検出する
  grep -qE '^## 学んだこと|学び（' "$f" || continue
  # マーカーの「存在」だけでは、昇格済みマーカーの後ろに新しい学びセクションが
  # 追記されたDailyを見逃す（2026-07-17で実例: マージで末尾に未マーカーの学び2件が
  # 追記されたが存在チェックは✓）。最後の学び行と最後のマーカー行の位置を比べ、
  # 学びが後ろなら未昇格分ありとして警告する。
  LAST_LEARN=$(grep -nE '^## 学んだこと|学び（' "$f" | tail -1 | cut -d: -f1)
  LAST_MARK=$(grep -nE '昇格済み|反映済み|昇格しない' "$f" | tail -1 | cut -d: -f1)
  if [ -z "$LAST_MARK" ]; then
    note_warn "$f: 学びに昇格済み/反映済みマーカーなし（/self-improve で昇格要否を点検）"
  elif [ "$LAST_LEARN" -gt "$LAST_MARK" ]; then
    note_warn "$f: 最後のマーカー(${LAST_MARK}行)より後ろに学び(${LAST_LEARN}行)が追記されている（/self-improve で昇格要否を点検）"
  else
    ok "$f"
  fi
done

echo "== 9. Dailyなしの作業日（直近14日・警告のみ／exit codeに影響しない）=="
# 作業コミット（obsidian-vault/ 以外を変更した非マージコミット）がある日に
# 対応する 01-Daily/YYYY-MM-DD.md が無ければ警告する。検査#8は「存在するDailyの
# 昇格漏れ」しか見えず、Dailyごと書かれなかった作業日は蓄積ループから漏れる
# （2026-07-15の大型実装5件が無記録だった実例）。記録要否の判断はLLM作業のため
# 非ブロッキング（△）。古い作業日を延々警告しないよう直近14日に限定する。
COMMITS=$(git log --no-merges --since='14 days ago' --date=short --pretty='%H %ad' 2>/dev/null || true)
if [ -z "$COMMITS" ]; then
  echo "  - 直近14日のコミットなし（スキップ）"
else
  WORKDAYS=""
  while read -r h d; do
    [ -n "$h" ] || continue
    # obsidian-vault/ のみのコミット（Daily追記等）は「作業」に数えない。
    # 注意: `git show | grep -q` 直結は pipefail 下で grep の早期exitが
    # git show を SIGPIPE(141) で殺しパイプライン全体が偽になる（変更ファイル数が
    # 多いコミットだけ落ちる）ため、先に変数へ受けてから grep する。
    CHANGED=$(git show --pretty=format: --name-only "$h" 2>/dev/null || true)
    if grep -qv -e '^$' -e '^obsidian-vault/' <<< "$CHANGED"; then
      WORKDAYS="$WORKDAYS$d"$'\n'
    fi
  done <<< "$COMMITS"
  while IFS= read -r d; do
    [ -n "$d" ] || continue
    if [ -f "obsidian-vault/01-Daily/$d.md" ]; then
      ok "$d（Dailyあり）"
    else
      note_warn "$d: 作業コミットあり・Dailyなし（学び/決定があれば obsidian-vault/01-Daily/$d.md へ記録）"
    fi
  done <<< "$(printf '%s' "$WORKDAYS" | sort -u)"
fi

echo ""
if [ "$FAIL" = 0 ]; then
  if [ "$WARN" = 0 ]; then
    echo "==> harness-lint: 問題なし ✅"
  else
    echo "==> harness-lint: 問題なし ✅（△の警告あり — /self-improve の振り返りで点検）"
  fi
else
  echo "==> harness-lint: 問題あり ❌（上記 ✗ を /self-improve で是正）"
fi
exit "$FAIL"
