/**
 * XtermTerminal Component
 *
 * Core xterm.js terminal component with WebSocket connection to ttyd backend
 * Based on ttyd's frontend implementation
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { CanvasAddon } from '@xterm/addon-canvas';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import type { ITerminalOptions, Terminal as ITerminal } from '@xterm/xterm';
import { Terminal } from '@xterm/xterm';

// Import xterm CSS at component level
import '@xterm/xterm/css/xterm.css';

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

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

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
    const terminal = new Terminal(termOptions);
    terminalRef.current = terminal;

    // Create and load fit addon
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);

    // Load web links addon
    terminal.loadAddon(new WebLinksAddon());

    // Open terminal in container
    terminal.open(containerRef.current);
    fitAddon.fit();

    // Apply renderer
    applyRenderer(rendererType);

    // Setup event handlers
    setupTerminalHandlers(terminal, fitAddon);

    // Call onReady callback
    onReady?.();

    // Cleanup
    return () => {
      socketRef.current?.close();
      webglAddonRef.current?.dispose();
      canvasAddonRef.current?.dispose();
      terminal.dispose();
    };
  }, []);

  // Apply renderer (webgl, canvas, or dom)
  const applyRenderer = (type: 'dom' | 'canvas' | 'webgl') => {
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

    // Apply new renderer
    switch (type) {
      case 'webgl':
        try {
          const webglAddon = new WebglAddon();
          webglAddonRef.current = webglAddon;
          terminal.loadAddon(webglAddon);
          console.log('[terminal] WebGL renderer loaded');
        } catch (e) {
          console.log('[terminal] WebGL renderer failed, falling back to canvas', e);
          applyRenderer('canvas');
        }
        break;
      case 'canvas':
        try {
          const canvasAddon = new CanvasAddon();
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
  const setupTerminalHandlers = (terminal: ITerminal, fitAddon: FitAddon) => {
    // Handle data input from user
    terminal.onData((data) => {
      sendData(data);
    });

    // Handle binary input
    terminal.onBinary((data) => {
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

    // Handle window resize
    const handleWindowResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleWindowResize);

    // Cleanup
    return () => {
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
            // Write output to terminal
            terminal.write(new Uint8Array(data));
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

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{
        padding: '5px',
      }}
    />
  );
}
