#!/usr/bin/env bash
# sensitive-file-guard: blocks Read/Edit/Write on sensitive paths even with
# symlink/relative tricks. Stdin: PreToolUse JSON. Exit 2 + stderr blocks.
set -u

input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty')"
case "$tool" in
  Read|Edit|Write|MultiEdit|NotebookEdit) ;;
  *) exit 0 ;;
esac

raw="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // .tool_input.notebook_path // empty')"
[ -z "$raw" ] && exit 0

# Resolve to absolute (best-effort; readlink -f handles non-existent tails on GNU).
abs="$(readlink -f -- "$raw" 2>/dev/null || true)"
[ -z "$abs" ] && abs="$raw"

block() {
  printf 'sensitive-file-guard: BLOCKED — %s\nResolved path: %s\n' "$1" "$abs" >&2
  exit 2
}

# Sensitive path patterns (resolved path)
case "$abs" in
  */.env|*/.env.*) block "dotenv file" ;;
  *.pem|*.key) block "private key file" ;;
  */id_rsa|*/id_rsa.*|*/id_ed25519|*/id_ed25519.*) block "SSH private key" ;;
  */.ssh/*) block ".ssh directory contents" ;;
  */.aws/*) block ".aws credentials" ;;
  */credentials|*/credentials.*) block "credentials file" ;;
  */secrets|*/secrets.*|*.secret) block "secrets file" ;;
  /home/user/main/backend/admin.db.json) block "admin database (contains password hashes / JWT secret)" ;;
  /home/user/main/backend/*.db) block "backend database file" ;;
  /root/.claude/*) block "user-level Claude config (out of scope)" ;;
  /home/user/main/.git/*)
    case "$tool" in Edit|Write|MultiEdit) block "direct write to .git internals" ;; esac
    ;;
  /home/user/main/.edge-test-profile/*)
    case "$tool" in Edit|Write|MultiEdit) block "Edge browser profile data" ;; esac
    ;;
esac

# Block writes outside the project root.
case "$tool" in
  Edit|Write|MultiEdit|NotebookEdit)
    case "$abs" in
      /home/user/main/*) ;;
      *) block "edit/write outside /home/user/main" ;;
    esac
    ;;
esac

exit 0
