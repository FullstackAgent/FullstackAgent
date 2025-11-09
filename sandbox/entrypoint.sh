#!/bin/bash
# Start ttyd with authentication
# -T: Set terminal type to xterm-256color (widely supported)
# -W: Enable websocket compression
# -a: Allow URL arguments to be passed to the command
# -t: Set terminal theme
# The ttyd-auth.sh script will receive the token as first argument via ?arg=TOKEN

# Verify authentication script exists
if [ ! -f /usr/local/bin/ttyd-auth.sh ]; then
    echo "ERROR: ttyd-auth.sh not found"
    exit 1
fi

# Terminal theme configuration
THEME='{"foreground":"#ada594","background":"#292724","cursor":"#bc672f","black":"#292724","red":"#816f4b","green":"#ec9255","yellow":"#ffb380","blue":"#957e50","magenta":"#ec9255","cyan":"#ac8e53","white":"#ada594","brightBlack":"#7e7767","brightRed":"#f29d63","brightGreen":"#3d3a34","brightYellow":"#615c51","brightBlue":"#908774","brightMagenta":"#ddcba6","brightCyan":"#e58748","brightWhite":"#f2ead9"}'

# Start ttyd with authentication wrapper and theme
ttyd -T xterm-256color -W -a -t "$THEME" /usr/local/bin/ttyd-auth.sh
