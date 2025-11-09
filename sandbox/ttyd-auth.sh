#!/bin/bash
# ttyd authentication wrapper script
# Validates TTYD_ACCESS_TOKEN before granting shell access

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

# Authentication successful - start bash shell
exec /bin/bash
