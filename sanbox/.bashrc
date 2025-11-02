#!/bin/bash
# Custom prompt: user@project-name:relative-path

PROJECT_NAME="${PROJECT_NAME:-sandbox}"

# Function to show path relative to /workspace
_path() {
    case "${PWD}" in
        /workspace) echo "/" ;;
        /workspace/*) echo "${PWD#/workspace}" ;;
        *) echo "${PWD}" ;;
    esac
}

# Update prompt on every command
PROMPT_COMMAND='PS1="\u@${PROJECT_NAME}:$(_path)\$ "'

# Auto-start Claude Code CLI on first terminal connection only
# Use a file flag that persists across ttyd reconnections
CLAUDE_FLAG_FILE="/tmp/.claude_started"

if [ ! -f "$CLAUDE_FLAG_FILE" ]; then
    touch "$CLAUDE_FLAG_FILE"
    echo "🤖 Starting Claude Code CLI..."
    claude
fi
