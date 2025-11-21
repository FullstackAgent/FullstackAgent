#!/bin/bash
# Custom prompt: user@project-name:relative-path

# Enable 256 color support for terminal
export TERM="${TERM:-xterm-256color}"
export COLORTERM="${COLORTERM:-truecolor}"

PROJECT_NAME="${PROJECT_NAME:-sandbox}"

# ---- colorized ls/grep ----
if command -v dircolors >/dev/null 2>&1; then
  # Use system default if user hasn't customized ~/.dircolors
  if [ -f "$HOME/.dircolors" ]; then
    eval "$(dircolors -b "$HOME/.dircolors")"
  else
    eval "$(dircolors -b)"
  fi
fi
alias ls='ls --color=auto'
alias grep='grep --color=auto'
alias egrep='egrep --color=auto'
alias fgrep='fgrep --color=auto'

# Function to show path relative to /home/fulling
_path() {
    case "${PWD}" in
        /home/fulling) echo "/" ;;
        /home/fulling/*) echo "${PWD#/home/fulling}" ;;
        *) echo "${PWD}" ;;
    esac
}

# Update prompt on every command
# ---- prompt (Apprentice-friendly) ----
# Color scheme:
#  - Username: default color (follows foreground)
#  - Hostname: bright blue (brightBlue -> #8FAFD7)
#  - Project name: bright cyan (brightCyan -> #5FAFAF)
#  - Path: bright yellow (brightYellow -> #FFFFAF)
_ps1_update() {
  local c_reset='\[\e[0m\]'
  local c_host='\[\e[94m\]'   # brightBlue
  local c_proj='\[\e[96m\]'   # brightCyan
  local c_path='\[\e[93m\]'   # brightYellow
  PS1="\u@${c_host}\h${c_reset}:${c_proj}${PROJECT_NAME}${c_reset}:${c_path}$(_path)${c_reset}\$ "
}
PROMPT_COMMAND=_ps1_update

# Change to Next.js project directory on shell start
# if [ "$PWD" = "$HOME" ] && [ -d "$HOME/next" ]; then
#     cd "$HOME/next"
# fi

# Auto-start Claude Code CLI on first terminal connection only
# Use a file flag that persists across ttyd reconnections
CLAUDE_FLAG_FILE="/tmp/.claude_started"

if [ ! -f "$CLAUDE_FLAG_FILE" ]; then
    touch "$CLAUDE_FLAG_FILE"
    echo "🤖 Starting Claude Code CLI..."
    claude
fi
