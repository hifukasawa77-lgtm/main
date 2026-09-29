#!/bin/bash
# required-checks.sh — 変更ファイルから「通すべき機械検査」を割り出す
# 正本は .claude/agent-conventions.md §4 の対応表。ここに写しを持たない（表を直せば自動で追随する）。
# 使い方:
#   bash .claude/skills/required-checks/required-checks.sh              # 未コミット＋未追跡の変更から一覧を出す
#   bash .claude/skills/required-checks/required-checks.sh --run        # 一覧の検査を順に実行し、緑/赤を集計
#   bash .claude/skills/required-checks/required-checks.sh --base main  # main との差分（コミット済み分）から割り出す
#   bash .claude/skills/required-checks/required-checks.sh a.html b.js  # ファイルを直接指定
# 終了コード: 一覧のみ=0 / --run で全緑=0・赤あり=1 / 表が読めない=2
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2

RUN=0; BASE=""; FILES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --run) RUN=1 ;;
    --base) shift; BASE="${1:-}" ;;
    *) FILES+=("$1") ;;
  esac
  shift
done

if [ ${#FILES[@]} -eq 0 ]; then
  {
    if [ -n "$BASE" ]; then git diff --name-only "$BASE"...HEAD 2>/dev/null; fi
    git diff --name-only HEAD 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null   # 新規ファイルは git add 前＝未追跡
  } | sort -u > /tmp/.rc-files.$$
else
  printf '%s\n' "${FILES[@]}" > /tmp/.rc-files.$$
fi

export RC_FILES="/tmp/.rc-files.$$" RC_RUN="$RUN"
python3 - <<'PY'
import os, re, subprocess, sys

files = [l.strip() for l in open(os.environ['RC_FILES']) if l.strip()]
os.remove(os.environ['RC_FILES'])
run = os.environ['RC_RUN'] == '1'
conv = '.claude/agent-conventions.md'
if not os.path.isfile(conv):
    print('✗ agent-conventions.md が無い'); sys.exit(2)

# §4 の表だけを読む
text = open(conv, encoding='utf-8').read()
m = re.search(r'^## 4\..*?(?=^## 5\.)', text, re.S | re.M)
if not m:
    print('✗ agent-conventions.md に §4（必須検査の対応表）が見つからない'); sys.exit(2)

rows = []
for line in m.group(0).splitlines():
    if not line.startswith('|') or line.startswith('|---') or '変更したファイル' in line: continue
    cols = [c.strip() for c in line.strip().strip('|').split('|', 1)]
    if len(cols) != 2: continue
    pats = re.findall(r'`([^`]+)`', cols[0])
    cmds = [c for c in re.findall(r'`([^`]+)`', cols[1]) if re.match(r'^(node|bash|python3)\s', c)]
    rows.append((cols[0], pats, cmds))

IMG = re.compile(r'\.(png|jpe?g|webp|gif|svg)$', re.I)
def hit(label, pats, f):
    if label.startswith('上記以外の') or label.startswith('コミット直前'): return False
    for p in pats:
        p = p.strip()
        if p.endswith('/'):
            if f.startswith(p) and ('画像' not in label or IMG.search(f)): return True
        elif p.startswith('assets/') and '配下' in label:
            if f.startswith('assets/') and IMG.search(f): return True
        elif f == p: return True
    return False

need = {}   # cmd -> 理由(変更ファイル)
html_uncovered = []
for f in files:
    matched = False
    for label, pats, cmds in rows:
        if hit(label, pats, f):
            matched = True
            for c in cmds: need.setdefault(c, set()).add(f)
    if f.endswith('.html') and not matched and '/' not in f:
        html_uncovered.append(f)

# 専用検査の無い HTML は動的テスト、コミット前は release-check（表の末尾2行）
fallback = [c for lab, p, cs in rows if lab.startswith('上記以外の') for c in cs]
final = [c for lab, p, cs in rows if lab.startswith('コミット直前') for c in cs]
for f in html_uncovered:
    for c in fallback: need.setdefault(c, set()).add(f)
if files:
    for c in final: need.setdefault(c, set()).add('(コミット直前・全変更共通)')

if not files:
    print('変更ファイルなし — 検査は不要'); sys.exit(0)

print(f'変更ファイル {len(files)} 件 → 必須検査 {len(need)} 本')
for c, fs in need.items():
    fl = sorted(fs); s = ', '.join(fl[:3]) + (f' ほか{len(fl)-3}件' if len(fl) > 3 else '')
    print(f'  • {c}\n      ← {s}')
unmapped = [f for f in files if not any(hit(l, p, f) for l, p, _ in rows) and f not in html_uncovered]
if unmapped:
    print(f'\n（表に無いファイル {len(unmapped)} 件: CLAUDE.md に検査の記載が無いか確認）')
    for f in unmapped[:8]: print('   -', f)
if not run:
    print('\n実行するなら --run を付ける。※ 検査を飛ばした完了報告は無効（agent-conventions §4）'); sys.exit(0)

# 実行（コミット直前の検査は最後に回す）
order = [c for c in need if c not in final] + [c for c in need if c in final]
bad = []
for c in order:
    print(f'\n▶ {c}', flush=True)
    r = subprocess.run(c, shell=True)
    if r.returncode != 0: bad.append((c, r.returncode))
print('\n==> required-checks:', 'すべて緑 ✅' if not bad else f'赤 {len(bad)} 本 ❌')
for c, rc in bad: print(f'   ✗ (exit {rc}) {c}')
sys.exit(1 if bad else 0)
PY
