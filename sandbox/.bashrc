#!/bin/bash
# Custom prompt: user@project-name:relative-path

# Enable 256 color support for terminal
export TERM="${TERM:-xterm-256color}"
export COLORTERM="${COLORTERM:-truecolor}"

PROJECT_NAME="${PROJECT_NAME:-sandbox}"

# Function to show path relative to /home/agent
_path() {
    case "${PWD}" in
        /home/agent) echo "/" ;;
        /home/agent/*) echo "${PWD#/home/agent}" ;;
        *) echo "${PWD}" ;;
    esac
}

# Update prompt on every command
_ps1_update() {
  PS1="\u@\[\e[1;97m\]\h\[\e[0m\]:${PROJECT_NAME}:$(_path)\$ "
}
PROMPT_COMMAND=_ps1_update

# Change to Next.js project directory on shell start
if [ "$PWD" = "$HOME" ] && [ -d "$HOME/next" ]; then
    cd "$HOME/next"
fi

# Auto-start Claude Code CLI on first terminal connection only
# Use a file flag that persists across ttyd reconnections
CLAUDE_FLAG_FILE="/tmp/.claude_started"

if [ ! -f "$CLAUDE_FLAG_FILE" ]; then
    touch "$CLAUDE_FLAG_FILE"
    echo "🤖 Starting Claude Code CLI..."
    claude
fi
