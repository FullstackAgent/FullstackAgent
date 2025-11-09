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

# Terminal theme configuration (ttyd expects theme={...} format)
THEME='theme={
 "background":"#262626",
 "foreground":"#BCBCBC",
 "cursor":"#BCBCBC",
 "black":"#1C1C1C",
 "red":"#AF5F5F",
 "green":"#5F875F",
 "yellow":"#87875F",
 "blue":"#5F87AF",
 "magenta":"#5F5F87",
 "cyan":"#5F8787",
 "white":"#6C6C6C",
 "brightBlack":"#444444",
 "brightRed":"#FF8700",
 "brightGreen":"#87AF87",
 "brightYellow":"#FFFFAF",
 "brightBlue":"#8FAFD7",
 "brightMagenta":"#8787AF",
 "brightCyan":"#5FAFAF",
 "brightWhite":"#FFFFFF"
}'

# Start ttyd with authentication wrapper and theme
ttyd -T xterm-256color -W -a -t "$THEME" /usr/local/bin/ttyd-auth.sh