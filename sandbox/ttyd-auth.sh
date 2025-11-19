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
    TERMINAL_SESSION_ID="$2"
    export TERMINAL_SESSION_ID

    # Store shell PID in session file
    # This allows backend to find the shell's working directory via /proc/$PID/cwd
    SESSION_FILE="/tmp/.terminal-session-${TERMINAL_SESSION_ID}"
    echo "$$" > "$SESSION_FILE"

    echo "✓ Terminal session: ${TERMINAL_SESSION_ID}"
fi

# Start bash shell
exec /bin/bash
