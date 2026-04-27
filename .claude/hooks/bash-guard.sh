#!/usr/bin/env bash
# bash-guard: blocks dangerous bash patterns the static deny list can miss.
# Stdin: PreToolUse JSON. Exit 2 + stderr blocks; exit 0 allows.
set -u

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -z "$cmd" ] && exit 0

block() {
  printf 'bash-guard: BLOCKED — %s\nCommand: %s\n' "$1" "$cmd" >&2
  exit 2
}

# Normalize: strip backslash-newlines so multi-line commands are scannable.
norm="$(printf '%s' "$cmd" | tr '\n' ' ' | tr -s ' ')"

# 1. rm -rf with variable expansion or glob at root-ish paths
if printf '%s' "$norm" | grep -Eq 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)[[:space:]]+(\$|/|~|\*|\.\.)'; then
  block "rm -rf with variable, glob, root, ~, or .. target"
fi

# 2. piped curl/wget into a shell — covers curl ... | sh / bash / zsh / sudo bash
if printf '%s' "$norm" | grep -Eiq '(curl|wget|fetch)[^|;&]*\|[[:space:]]*(sudo[[:space:]]+)?(sh|bash|zsh|ksh|dash|python|perl|node)([[:space:]]|$)'; then
  block "piped network download into shell interpreter"
fi

# 3. Process substitution download into shell:  bash <(curl ...)
if printf '%s' "$norm" | grep -Eiq '(sh|bash|zsh|python|perl|node)[[:space:]]+<\([[:space:]]*(curl|wget)'; then
  block "process-substitution download into interpreter"
fi

# 4. base64 / xxd decoded execution
if printf '%s' "$norm" | grep -Eiq '(base64[[:space:]]+(-d|--decode)|xxd[[:space:]]+-r)[^|]*\|[[:space:]]*(sh|bash|zsh|python|perl|node)'; then
  block "base64/xxd-decoded payload piped to interpreter"
fi
if printf '%s' "$norm" | grep -Eiq 'echo[[:space:]]+[A-Za-z0-9+/=]{40,}[[:space:]]*\|[[:space:]]*base64'; then
  block "suspicious base64 blob piped through decode"
fi

# 5. Reverse shells / netcat exfil
if printf '%s' "$norm" | grep -Eiq '(^|[[:space:]])(nc|ncat|netcat)[[:space:]]+(-[elnvp]+[[:space:]]+)*[a-zA-Z0-9.-]+[[:space:]]+[0-9]+'; then
  block "netcat connection (possible reverse shell / exfil)"
fi
if printf '%s' "$norm" | grep -Eiq 'bash[[:space:]]+-i[[:space:]]+>&[[:space:]]*/dev/tcp/'; then
  block "bash /dev/tcp reverse shell"
fi

# 6. Network exfil to non-allowlisted hosts via curl/wget POST/upload
ALLOW_HOSTS='github\.com|raw\.githubusercontent\.com|docs\.anthropic\.com|developer\.mozilla\.org|json\.schemastore\.org|unpkg\.com|registry\.npmjs\.org'
if printf '%s' "$norm" | grep -Eiq '(curl|wget)[[:space:]].*(--data|--data-binary|-d[[:space:]]|-F[[:space:]]|-T[[:space:]]|--upload-file)'; then
  host="$(printf '%s' "$norm" | grep -oEi 'https?://[a-zA-Z0-9.-]+' | head -1 | sed -E 's#https?://##')"
  if [ -n "$host" ] && ! printf '%s' "$host" | grep -Eiq "^($ALLOW_HOSTS)$"; then
    block "curl/wget POST/upload to non-allowlisted host: $host"
  fi
fi

# 7. Fork bomb
if printf '%s' "$norm" | grep -Eq ':\(\)[[:space:]]*\{[[:space:]]*:\|:&[[:space:]]*\};:'; then
  block "fork bomb"
fi

# 8. History wipe / shell-rc tamper
if printf '%s' "$norm" | grep -Eq 'history[[:space:]]+-(c|w)\b|>[[:space:]]*~?/?\.bash_history|unset[[:space:]]+HISTFILE'; then
  block "history tampering"
fi
if printf '%s' "$norm" | grep -Eq '(>>?|tee)[[:space:]]+~?/?\.(bashrc|zshrc|profile|bash_profile)\b'; then
  block "shell rc file modification"
fi

# 9. Force-push to protected branches (defense-in-depth against settings deny)
if printf '%s' "$norm" | grep -Eq 'git[[:space:]]+push[[:space:]].*(--force|--force-with-lease|-f\b).*[[:space:]](origin[[:space:]]+)?(main|master)\b'; then
  block "force push to main/master"
fi

# 10. Reading sensitive files via cat/less/more/head/tail/bat
if printf '%s' "$norm" | grep -Eq '(^|[[:space:]])(cat|less|more|head|tail|bat)[[:space:]]+[^|;&]*(\.env(\.|\b)|/\.ssh/|/\.aws/|id_rsa\b|id_ed25519\b|admin\.db\.json|\.pem\b|\.key\b)'; then
  block "reading sensitive file via shell utility (use Read tool, which is also denied for these paths)"
fi

# 11. /root or other-user home access
if printf '%s' "$norm" | grep -Eq '(^|[[:space:]])/root/'; then
  block "access to /root directory"
fi
if printf '%s' "$norm" | grep -Eq '(^|[[:space:]])/home/[^/[:space:]]+/' && \
   ! printf '%s' "$norm" | grep -Eq '(^|[[:space:]])/home/user/main(/|[[:space:]]|$)'; then
  # Allow only /home/user/main paths; flag any other /home/<x>/ access
  if printf '%s' "$norm" | grep -oE '/home/[^/[:space:]]+' | grep -vq '^/home/user$'; then
    block "access to another user's home directory"
  fi
fi

exit 0
