#!/bin/bash
# Start ttyd with 256 color support
# -T: Set terminal type to xterm-256color (widely supported)
# -W: Enable websocket compression
ttyd -T xterm-256color -W bash
