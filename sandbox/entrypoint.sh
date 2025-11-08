#!/bin/bash
# Start ttyd with true color support
# -t: Set terminal type to xterm-direct (supports 24-bit true color)
# -W: Enable websocket compression
ttyd -t 'xterm-direct' -W bash
