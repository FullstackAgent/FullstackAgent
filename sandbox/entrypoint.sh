#!/bin/bash
# Start ttyd with authentication
# -T: Set terminal type to xterm-256color (widely supported)
# -W: Enable websocket compression
# -a: Allow URL arguments to be passed to the command
# The ttyd-auth.sh script will receive the token as first argument via ?arg=TOKEN

# Verify authentication script exists
if [ ! -f /usr/local/bin/ttyd-auth.sh ]; then
    echo "ERROR: ttyd-auth.sh not found"
    exit 1
fi

# Start ttyd with authentication wrapper
ttyd -T xterm-256color -W -a /usr/local/bin/ttyd-auth.sh
