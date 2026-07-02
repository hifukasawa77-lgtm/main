#!/bin/bash
# second-brain-session-log.sh — Claude Codeのやりとり（会話ログ）を第二の脳へ自動記録
# 登録: .claude/settings.json の Stop / SessionEnd hook
# 動作: transcript(JSONL) からユーザー⇄Claudeのテキスト部分を抽出し、
#       obsidian-vault/01-Daily/sessions/YYYY-MM-DD-<sid>.md を毎回再生成する（冪等）。
#       ツール呼び出し・システムリマインダーは含めない。長文は1500字で切り詰める。
#       SessionEnd かつ claude/* ブランチ（リモートセッション）ではログを自動コミット＆プッシュ
#       する（リモートコンテナはセッション終了で破棄されるため、pushしないとログが消える）。
# 無効化: SECOND_BRAIN_SESSION_LOG=0（記録ごと停止） / SECOND_BRAIN_LOG_AUTOPUSH=0（自動pushのみ停止）
# 注意: 本リポジトリは公開。機微情報を扱ったセッションのログはコミット前に確認・削除すること。
set -uo pipefail

[ "${SECOND_BRAIN_SESSION_LOG:-1}" = "0" ] && exit 0
command -v python3 >/dev/null 2>&1 || exit 0   # python3 がない環境では静かにスキップ

HOOK_INPUT=$(cat)
export HOOK_INPUT

OUT=$(python3 <<'PY'
import datetime, json, os, sys

d = json.loads(os.environ["HOOK_INPUT"])
tp = d.get("transcript_path") or ""
sid = (d.get("session_id") or "")[:8] or "unknown"
root = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."
vault = os.path.join(root, "obsidian-vault")
if not (tp and os.path.isfile(tp) and os.path.isdir(vault)):
    sys.exit(0)

LIMIT = 1500  # 1メッセージあたりの最大文字数
msgs, first_ts = [], None
with open(tp, encoding="utf-8", errors="replace") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get("type") not in ("user", "assistant"):
            continue
        if e.get("isMeta") or e.get("isSidechain"):
            continue
        c = (e.get("message") or {}).get("content")
        if isinstance(c, str):
            parts = [c]
        elif isinstance(c, list):
            parts = [b.get("text", "") for b in c
                     if isinstance(b, dict) and b.get("type") == "text"]
        else:
            parts = []
        txt = "\n\n".join(p.strip() for p in parts if p and p.strip())
        if not txt:
            continue
        # system-reminder / コマンド展開 / ローカルコマンド注意書きは記録しない
        if e["type"] == "user" and (txt.startswith("<") or txt.startswith("Caveat:")):
            continue
        if first_ts is None:
            first_ts = e.get("timestamp")
        if len(txt) > LIMIT:
            txt = txt[:LIMIT].rstrip() + "\n\n…（省略）"
        role = "🧑 User" if e["type"] == "user" else "🤖 Claude"
        if msgs and msgs[-1][0] == role:  # 連続する同role（分割された応答）は結合
            if len(msgs[-1][1]) < LIMIT * 2:
                msgs[-1] = (role, msgs[-1][1] + "\n\n" + txt)
        else:
            msgs.append((role, txt))

if len(msgs) < 2:  # 実質的なやりとりがないセッションは記録しない
    sys.exit(0)
if len(msgs) > 120:  # 長大セッションは冒頭と末尾のみ残す
    omitted = len(msgs) - 100
    msgs = msgs[:20] + [("…", f"（中略: {omitted} メッセージ省略）")] + msgs[-80:]

date = (first_ts or "")[:10]
try:
    datetime.date.fromisoformat(date)
except ValueError:
    date = datetime.date.today().isoformat()

outdir = os.path.join(vault, "01-Daily", "sessions")
os.makedirs(outdir, exist_ok=True)
out = os.path.join(outdir, f"{date}-{sid}.md")
buf = [
    "---",
    "type: session-log",
    f"date: {date}",
    f"session: {sid}",
    "tags: [session-log, auto-generated]",
    "---",
    "",
    f"# セッションログ {date}（{sid}）",
    "",
    "> 🤖 自動生成（`.claude/hooks/second-brain-session-log.sh`）。生ログのため自由に削除してよい。"
    "再利用価値のある学びは Daily Note / 03-Decisions / 04-Knowledge へ昇格させる。",
    "",
]
for role, txt in msgs:
    buf += [f"## {role}", "", txt, ""]
with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(buf))
print(out)
PY
) || exit 0
[ -n "$OUT" ] || exit 0

# ---- SessionEnd かつ claude/* ブランチのみ自動コミット＆プッシュ ----
[ "${SECOND_BRAIN_LOG_AUTOPUSH:-1}" = "0" ] && exit 0
EVENT=$(printf '%s' "$HOOK_INPUT" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("hook_event_name",""))' 2>/dev/null || true)
[ "$EVENT" = "SessionEnd" ] || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-.}"
BRANCH=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
case "$BRANCH" in claude/*) ;; *) exit 0 ;; esac
# 他の変更が staging にある場合は巻き込まないため何もしない
git -C "$ROOT" diff --cached --quiet 2>/dev/null || exit 0
git -C "$ROOT" add "$OUT" 2>/dev/null || exit 0
git -C "$ROOT" diff --cached --quiet && exit 0
git -C "$ROOT" commit -q -m "第二の脳: セッションログを自動記録 (${BRANCH##*/})" \
  -m "Co-Authored-By: Claude <noreply@anthropic.com>" || exit 0
for delay in 0 2 4 8; do
  sleep "$delay"
  git -C "$ROOT" push -q origin "HEAD:$BRANCH" 2>/dev/null && exit 0
done
exit 0
