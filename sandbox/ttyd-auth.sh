#!/bin/bash
# ttyd authentication wrapper script
# Validates TTYD_ACCESS_TOKEN before granting shell access
#
# Arguments (passed via URL ?arg=...&arg=...):
#   $1 - TTYD_ACCESS_TOKEN (required)
#   $2 - TERMINAL_SESSION_ID (optional, for file upload directory tracking)

# Get the expected token from environment variable
EXPECTED_TOKEN="${TTYD_ACCESS_TOKEN:-}"

# Check if token is configured
if [ -z "$EXPECTED_TOKEN" ]; then
    echo "ERROR: TTYD_ACCESS_TOKEN is not configured"
    echo "Please contact your system administrator"
    sleep infinity
fi

# Check if token was provided as argument
if [ "$#" -lt 1 ]; then
    echo "ERROR: Authentication failed - no token provided"
    sleep infinity
fi

PROVIDED_TOKEN="$1"

# Validate token
if [ "$PROVIDED_TOKEN" != "$EXPECTED_TOKEN" ]; then
    echo "ERROR: Authentication failed - invalid token"
    sleep infinity
fi

# Authentication successful
echo "✓ Authentication successful"

# Optional: Handle terminal session ID for file upload directory tracking
if [ "$#" -ge 2 ] && [ -n "$2" ]; then
    # Validate format: only allow alphanumeric, hyphens, and underscores
    if [[ ! "$2" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "ERROR: Invalid session ID format"
        sleep infinity
    fi

    TERMINAL_SESSION_ID="$2"
    export TERMINAL_SESSION_ID

    # Store shell PID in session file
    # This allows backend to find the shell's working directory via /proc/$PID/cwd
    SESSION_FILE="/tmp/.terminal-session-${TERMINAL_SESSION_ID}"
    echo "$$" > "$SESSION_FILE"

    echo "✓ Terminal session: ${TERMINAL_SESSION_ID}"
fi

# Print welcome message and instructions
echo ""
echo "👋 Welcome to your FullstackAgent Sandbox!"
echo "========================================"
echo ""
echo "🚀 Getting Started:"
echo "   Your Next.js project is ready in this directory."
echo ""
echo "📦 1. Install dependencies:"
echo "      pnpm install"
echo ""
echo "▶️ 2. Start the development server:"
echo "      pnpm dev"
echo ""
echo "🤖 3. Use AI assistance:"
echo "      claude"
echo ""
echo "📎 4. Upload files:"
echo "      • Drag and drop files to the terminal"
echo "      • Paste images to upload"
echo "      • Files will be uploaded to the current directory"
echo ""
echo "Happy coding!"
echo ""

# Start bash shell
exec /bin/bash