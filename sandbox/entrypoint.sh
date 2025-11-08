#!/bin/bash
# Start ttyd with true color support
# -T: Set terminal type to xterm-direct (supports 24-bit true color)
# -W: Enable websocket compression
ttyd -T xterm-direct -W bash
