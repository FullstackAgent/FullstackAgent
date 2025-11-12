/**
 * XtermTerminal Component
 *
 * Core xterm.js terminal component with WebSocket connection to ttyd backend
 * Based on ttyd's frontend implementation
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { ITerminalOptions, Terminal as ITerminal } from '@xterm/xterm';

// Import xterm CSS at component level (safe for SSR)
import '@xterm/xterm/css/xterm.css';

// Type declarations for dynamically imported modules
// These will only be loaded on the client side to avoid SSR issues
type Terminal = import('@xterm/xterm').Terminal;
type FitAddon = import('@xterm/addon-fit').FitAddon;
type WebLinksAddon = import('@xterm/addon-web-links').WebLinksAddon;
type WebglAddon = import('@xterm/addon-webgl').WebglAddon;
type CanvasAddon = import('@xterm/addon-canvas').CanvasAddon;

// Command types matching ttyd protocol
enum Command {
  // server side
  OUTPUT = '0',
  SET_WINDOW_TITLE = '1',
  SET_PREFERENCES = '2',
}

// Client command types
enum ClientCommand {
  INPUT = '0',
  RESIZE_TERMINAL = '1',
  PAUSE = '2',
  RESUME = '3',
}

export interface XtermTerminalProps {
  /** WebSocket URL for ttyd connection */
  wsUrl: string;
  /** Terminal theme */
  theme?: {
    foreground?: string;
    background?: string;
    cursor?: string;
    black?: string;
    red?: string;
    green?: string;
    yellow?: string;
    blue?: string;
    magenta?: string;
    cyan?: string;
    white?: string;
    brightBlack?: string;
    brightRed?: string;
    brightGreen?: string;
    brightYellow?: string;
    brightBlue?: string;
    brightMagenta?: string;
    brightCyan?: string;
    brightWhite?: string;
  };
  /** Font size */
  fontSize?: number;
  /** Font family */
  fontFamily?: string;
  /** Renderer type */
  rendererType?: 'dom' | 'canvas' | 'webgl';
  /** Callback when terminal is ready */
  onReady?: () => void;
  /** Callback when connection opens */
  onConnected?: () => void;
  /** Callback when connection closes */
  onDisconnected?: () => void;
}

export function XtermTerminal({
  wsUrl,
  theme,
  fontSize = 14,
  fontFamily = 'Consolas, Liberation Mono, Menlo, Courier, monospace',
  rendererType = 'webgl',
  onReady,
  onConnected,
  onDisconnected,
}: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<ITerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const canvasAddonRef = useRef<CanvasAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const textEncoder = useRef(new TextEncoder());
  const textDecoder = useRef(new TextDecoder());

  // Track if user has scrolled away from bottom
  // When true, we should auto-scroll on new output
  const isAtBottomRef = useRef(true);

  // Scroll indicator state - shows when new content arrives while user is viewing history
  const [hasNewContent, setHasNewContent] = useState(false);
  const [newLineCount, setNewLineCount] = useState(0);

  /**
   * Check if terminal is scrolled to bottom (or very close)
   * Returns true if viewport is showing the last line of the buffer
   * Uses a small tolerance to handle edge cases with control sequences
   */
  const isTerminalAtBottom = (terminal: ITerminal): boolean => {
    try {
      const buffer = terminal.buffer.active;
      // viewportY: current scroll position (0-based)
      // baseY: the line number of the bottom of the viewport
      // Use <= instead of === to be more forgiving
      // This handles cases where content is being written with control sequences
      const threshold = 2; // Allow up to 2 lines of tolerance
      return buffer.viewportY >= buffer.baseY - threshold;
    } catch (error) {
      // Fallback: assume at bottom if we can't determine
      console.warn('[terminal] Could not determine scroll position:', error);
      return true;
    }
  };

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    let terminal: ITerminal | null = null;
    let fitAddon: FitAddon | null = null;
    let isMounted = true;

    // Dynamically load xterm and addons (client-side only)
    const initTerminal = async () => {
      try {
        // Dynamic imports to avoid SSR issues with 'self is not defined'
        const xtermModule = await import('@xterm/xterm');
        const fitAddonModule = await import('@xterm/addon-fit');
        const webLinksAddonModule = await import('@xterm/addon-web-links');

        // Check if component is still mounted after async import
        if (!isMounted || !containerRef.current) return;

        // Terminal options
        const termOptions: ITerminalOptions = {
          fontSize,
          fontFamily,
          theme: theme || {
            foreground: '#d2d2d2',
            background: '#1e1e1e',
            cursor: '#adadad',
            black: '#000000',
            red: '#d81e00',
            green: '#5ea702',
            yellow: '#cfae00',
            blue: '#427ab3',
            magenta: '#89658e',
            cyan: '#00a7aa',
            white: '#dbded8',
            brightBlack: '#686a66',
            brightRed: '#f54235',
            brightGreen: '#99e343',
            brightYellow: '#fdeb61',
            brightBlue: '#84b0d8',
            brightMagenta: '#bc94b7',
            brightCyan: '#37e6e8',
            brightWhite: '#f1f1f0',
          },
          cursorBlink: true,
          cursorStyle: 'block',
          allowProposedApi: true,
          scrollback: 10000,
          tabStopWidth: 8,
        };

        // Create terminal instance
        terminal = new xtermModule.Terminal(termOptions);
        terminalRef.current = terminal;

        // Create and load fit addon
        fitAddon = new fitAddonModule.FitAddon();
        fitAddonRef.current = fitAddon;
        terminal.loadAddon(fitAddon);

        // Load web links addon
        terminal.loadAddon(new webLinksAddonModule.WebLinksAddon());

        // Open terminal in container
        terminal.open(containerRef.current);

        // Wait for next frame before calling fit() to ensure container has dimensions
        // This prevents "Cannot read properties of undefined (reading 'dimensions')" error
        requestAnimationFrame(() => {
          if (!isMounted) return;
          fitAddon?.fit();
        });

        // Apply renderer (async to allow terminal to initialize)
        requestAnimationFrame(() => {
          if (!isMounted) return;
          applyRenderer(rendererType);
        });

        // Setup event handlers
        setupTerminalHandlers(terminal, fitAddon);

        // Call onReady callback
        onReady?.();
      } catch (error) {
        console.error('[terminal] Failed to initialize terminal:', error);
      }
    };

    // Start initialization
    initTerminal();

    // Cleanup
    return () => {
      isMounted = false;
      socketRef.current?.close();
      webglAddonRef.current?.dispose();
      canvasAddonRef.current?.dispose();
      terminal?.dispose();
    };
  }, []);

  // Apply renderer (webgl, canvas, or dom) - async to support dynamic imports
  const applyRenderer = async (type: 'dom' | 'canvas' | 'webgl') => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Dispose existing renderers
    try {
      webglAddonRef.current?.dispose();
      webglAddonRef.current = null;
    } catch (e) {
      // ignore
    }
    try {
      canvasAddonRef.current?.dispose();
      canvasAddonRef.current = null;
    } catch (e) {
      // ignore
    }

    // Apply new renderer with dynamic imports
    switch (type) {
      case 'webgl':
        try {
          const webglAddonModule = await import('@xterm/addon-webgl');
          const webglAddon = new webglAddonModule.WebglAddon();
          webglAddonRef.current = webglAddon;
          terminal.loadAddon(webglAddon);
          console.log('[terminal] WebGL renderer loaded');
        } catch (e) {
          console.log('[terminal] WebGL renderer failed, falling back to canvas', e);
          await applyRenderer('canvas');
        }
        break;
      case 'canvas':
        try {
          const canvasAddonModule = await import('@xterm/addon-canvas');
          const canvasAddon = new canvasAddonModule.CanvasAddon();
          canvasAddonRef.current = canvasAddon;
          terminal.loadAddon(canvasAddon);
          console.log('[terminal] Canvas renderer loaded');
        } catch (e) {
          console.log('[terminal] Canvas renderer failed, falling back to dom', e);
        }
        break;
      case 'dom':
        console.log('[terminal] DOM renderer loaded');
        break;
    }
  };

  // Setup terminal event handlers
  const setupTerminalHandlers = (terminal: ITerminal, fitAddon: import('@xterm/addon-fit').FitAddon) => {
    // Handle data input from user
    terminal.onData((data) => {
      // When user types, they expect to see the bottom
      // Auto-scroll to bottom and mark as being at bottom
      if (!isAtBottomRef.current) {
        terminal.scrollToBottom();
        isAtBottomRef.current = true;
      }
      // Clear new content indicator when user types
      if (hasNewContent) {
        setHasNewContent(false);
        setNewLineCount(0);
      }
      sendData(data);
    });

    // Handle binary input
    terminal.onBinary((data) => {
      // Same behavior for binary input
      if (!isAtBottomRef.current) {
        terminal.scrollToBottom();
        isAtBottomRef.current = true;
      }
      // Clear new content indicator
      if (hasNewContent) {
        setHasNewContent(false);
        setNewLineCount(0);
      }
      sendData(Uint8Array.from(data, (v) => v.charCodeAt(0)));
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        const msg = JSON.stringify({ columns: cols, rows });
        socket.send(textEncoder.current.encode(ClientCommand.RESIZE_TERMINAL + msg));
      }
    });

    // Handle scroll events - track if user is at bottom
    // This allows us to detect when user scrolls up to view history
    terminal.onScroll(() => {
      const wasAtBottom = isAtBottomRef.current;
      const nowAtBottom = isTerminalAtBottom(terminal);

      if (wasAtBottom !== nowAtBottom) {
        isAtBottomRef.current = nowAtBottom;
        console.log(
          '[terminal] User scroll position:',
          nowAtBottom ? 'at bottom' : 'viewing history'
        );

        // Clear new content indicator when user scrolls to bottom
        if (nowAtBottom && hasNewContent) {
          setHasNewContent(false);
          setNewLineCount(0);
        }
      }
    });

    // Handle line feed events - this catches when new lines are added
    // Critical for interactive prompts that use control sequences
    let lineFeedTimeout: NodeJS.Timeout | null = null;
    terminal.onLineFeed(() => {
      // Debounce scrolling to avoid excessive calls
      if (lineFeedTimeout) clearTimeout(lineFeedTimeout);

      lineFeedTimeout = setTimeout(() => {
        if (isAtBottomRef.current) {
          terminal.scrollToBottom();
        } else {
          // User is viewing history - increment new content counter
          setHasNewContent(true);
          setNewLineCount((prev) => prev + 1);
        }
      }, 10);
    });

    // Handle window resize
    const handleWindowResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleWindowResize);

    // Cleanup
    return () => {
      if (lineFeedTimeout) clearTimeout(lineFeedTimeout);
      window.removeEventListener('resize', handleWindowResize);
    };
  };

  // Send data to server
  const sendData = (data: string | Uint8Array) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;

    if (typeof data === 'string') {
      const payload = new Uint8Array(data.length * 3 + 1);
      payload[0] = ClientCommand.INPUT.charCodeAt(0);
      const stats = textEncoder.current.encodeInto(data, payload.subarray(1));
      socket.send(payload.subarray(0, (stats.written as number) + 1));
    } else {
      const payload = new Uint8Array(data.length + 1);
      payload[0] = ClientCommand.INPUT.charCodeAt(0);
      payload.set(data, 1);
      socket.send(payload);
    }
  };

  // Connect to WebSocket - runs once when wsUrl is provided
  useEffect(() => {
    if (!wsUrl || !terminalRef.current) return;

    // Note: In React Strict Mode (development), this effect will run twice
    // The cleanup function will properly close the first connection before the second one is created
    // This is intentional behavior to help detect side effect issues
    // In production builds, Strict Mode is disabled and this will only run once

    const terminal = terminalRef.current;
    let socket: WebSocket | null = null;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    let isCleaningUp = false;

    // Parse the ttyd URL and construct WebSocket URL
    // Important: Must preserve query parameters (?arg=TOKEN) for ttyd authentication
    const parseUrl = (): { wsFullUrl: string; token: string } | null => {
      try {
        // ttydUrl format: https://xxx.usw.sealos.io?arg=TOKEN
        const url = new URL(wsUrl);
        const token = url.searchParams.get('arg') || '';

        if (!token) {
          console.error('[terminal] No authentication token found in URL');
          return null;
        }

        // Create WebSocket URL: wss://xxx.usw.sealos.io/ws?arg=TOKEN
        // NOTE: Query parameters MUST be included for ttyd -a authentication!
        const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsPath = url.pathname.replace(/\/$/, '') + '/ws';
        const wsFullUrl = `${wsProtocol}//${url.host}${wsPath}${url.search}`;

        console.log('[terminal] Extracted token:', token ? '***' : 'EMPTY');
        console.log('[terminal] Connecting to:', wsFullUrl.replace(token, '***'));

        return { wsFullUrl, token };
      } catch (error) {
        console.error('[terminal] Failed to parse ttyd URL:', error);
        return null;
      }
    };

    const urlInfo = parseUrl();
    if (!urlInfo) {
      onDisconnected?.();
      return;
    }

    const { wsFullUrl, token } = urlInfo;

    // Connect to WebSocket
    const connect = () => {
      if (isCleaningUp) return;

      console.log('[terminal] Connecting to WebSocket...');
      socket = new WebSocket(wsFullUrl, ['tty']);
      socketRef.current = socket;
      socket.binaryType = 'arraybuffer';

      // WebSocket open handler
      socket.onopen = () => {
        console.log('[terminal] WebSocket connected');
        setIsConnected(true);
        onConnected?.();

        // Send initial message with terminal size
        // NOTE: ttyd with -a flag authenticates via URL parameter, not AuthToken
        // But we still send this message for compatibility and terminal size
        const authMsg = JSON.stringify({
          AuthToken: token,
          columns: terminal.cols,
          rows: terminal.rows,
        });

        console.log('[terminal] Sending initial terminal size');
        socket?.send(textEncoder.current.encode(authMsg));

        terminal.focus();
      };

      // WebSocket message handler
      socket.onmessage = (event: MessageEvent) => {
        const rawData = event.data as ArrayBuffer;
        const cmd = String.fromCharCode(new Uint8Array(rawData)[0]);
        const data = rawData.slice(1);

        switch (cmd) {
          case Command.OUTPUT:
            // Smart scroll behavior:
            // 1. Check if user is at bottom BEFORE writing
            const shouldAutoScroll = isAtBottomRef.current;

            // 2. Write output to terminal
            terminal.write(new Uint8Array(data));

            // 3. IMMEDIATELY scroll after write (synchronous)
            // This is critical for interactive prompts (like Claude Code choices)
            // that use cursor control sequences - we must scroll IMMEDIATELY
            if (shouldAutoScroll) {
              // Use requestAnimationFrame to ensure DOM has updated
              requestAnimationFrame(() => {
                terminal.scrollToBottom();

                // Double-check: if we're still not at bottom, force scroll again
                // This handles edge cases with complex control sequences
                requestAnimationFrame(() => {
                  if (!isTerminalAtBottom(terminal)) {
                    terminal.scrollToBottom();
                  }
                });
              });
            }
            break;
          case Command.SET_WINDOW_TITLE:
            // Set window title
            const title = textDecoder.current.decode(data);
            document.title = title;
            break;
          case Command.SET_PREFERENCES:
            // Handle preferences (not implemented yet)
            console.log('[terminal] Preferences received:', textDecoder.current.decode(data));
            break;
          default:
            console.warn('[terminal] Unknown command:', cmd);
            break;
        }
      };

      // WebSocket close handler
      socket.onclose = (event: CloseEvent) => {
        console.log('[terminal] WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        socketRef.current = null;
        onDisconnected?.();

        // Only attempt reconnection if not cleaning up and close was unexpected
        if (!isCleaningUp && event.code !== 1000) {
          terminal.write('\r\n\x1b[33m[Connection lost. Reconnecting in 3 seconds...]\x1b[0m\r\n');

          // Auto-reconnect after 3 seconds
          reconnectTimeoutId = setTimeout(() => {
            if (!isCleaningUp) {
              console.log('[terminal] Attempting to reconnect...');
              connect();
            }
          }, 3000);
        } else {
          terminal.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
        }
      };

      // WebSocket error handler
      socket.onerror = (error) => {
        console.error('[terminal] WebSocket error:', error);
      };
    };

    // Initial connection
    connect();

    // Cleanup function
    return () => {
      console.log('[terminal] Cleaning up WebSocket connection');
      isCleaningUp = true;

      // Clear reconnect timeout if exists
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }

      // Close socket if open
      if (socket) {
        socket.onclose = null; // Remove handler to prevent reconnect
        socket.onerror = null;
        socket.onmessage = null;
        socket.onopen = null;

        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000, 'Component unmounted');
        }
        socket = null;
        socketRef.current = null;
      }

      setIsConnected(false);
    };
  }, [wsUrl, onConnected, onDisconnected]); // Only reconnect when wsUrl or callbacks change

  // Handle scroll to bottom button click
  const handleScrollToBottom = () => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.scrollToBottom();
      isAtBottomRef.current = true;
      setHasNewContent(false);
      setNewLineCount(0);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Terminal container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{
          padding: '5px',
        }}
      />

      {/* Scroll to bottom indicator - shows when new content arrives while viewing history */}
      {hasNewContent && (
        <button
          onClick={handleScrollToBottom}
          className="absolute bottom-4 right-4
                     bg-blue-500 hover:bg-blue-600
                     text-white text-sm font-medium
                     px-4 py-2 rounded-full
                     shadow-lg hover:shadow-xl
                     transition-all duration-200
                     flex items-center gap-2
                     animate-fade-in
                     z-10"
          aria-label={`Scroll to bottom (${newLineCount} new lines)`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
          <span>
            {newLineCount} new {newLineCount === 1 ? 'line' : 'lines'}
          </span>
        </button>
      )}
    </div>
  );
}
