/**
 * XtermTerminal Component
 *
 * Terminal component built with xterm.js, supporting WebSocket connection to ttyd backend.
 * Implements dynamic imports for SSR compatibility and proper lifecycle management.
 *
 * Features:
 * - SSR-safe dynamic module loading
 * - WebSocket auto-reconnection
 * - Smart scroll behavior with indicator
 * - Multiple renderer support (WebGL, Canvas, DOM)
 * - Proper cleanup and memory management
 * - Seamless file upload via drag & drop or paste (Ctrl+V)
 * - Integration with FileBrowser
 *
 * File Upload UX:
 * - Global paste support (works even when terminal has focus)
 * - Background upload without blocking terminal interaction
 * - Toast notifications for progress and status
 * - No intrusive overlays
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ITerminalOptions, Terminal as ITerminal } from '@xterm/xterm';

import { useFileDrop } from './hooks/use-file-drop';
import { useFileUpload } from './hooks/use-file-upload';

import '@xterm/xterm/css/xterm.css';

// ============================================================================
// Type Definitions
// ============================================================================

type FitAddon = import('@xterm/addon-fit').FitAddon;
type WebglAddon = import('@xterm/addon-webgl').WebglAddon;
type CanvasAddon = import('@xterm/addon-canvas').CanvasAddon;

enum Command {
  OUTPUT = '0',
  SET_WINDOW_TITLE = '1',
  SET_PREFERENCES = '2',
}

enum ClientCommand {
  INPUT = '0',
  RESIZE_TERMINAL = '1',
  PAUSE = '2',
  RESUME = '3',
}

export interface XtermTerminalProps {
  wsUrl: string;
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
  fontSize?: number;
  fontFamily?: string;
  rendererType?: 'dom' | 'canvas' | 'webgl';
  onReady?: () => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  // FileBrowser upload support
  fileBrowserUrl?: string;
  fileBrowserUsername?: string;
  fileBrowserPassword?: string;
  enableFileUpload?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function XtermTerminal({
  wsUrl,
  theme,
  fontSize = 14,
  fontFamily = 'Consolas, Liberation Mono, Menlo, Courier, monospace',
  rendererType = 'webgl',
  onReady,
  onConnected,
  onDisconnected,
  fileBrowserUrl,
  fileBrowserUsername,
  fileBrowserPassword,
  enableFileUpload = true,
}: XtermTerminalProps) {
  // =========================================================================
  // State & Refs
  // =========================================================================

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<ITerminal | null>(null);
  const hasNewContentRef = useRef(false);
  const newLineCountRef = useRef(0);

  const [hasNewContent, setHasNewContent] = useState(false);
  const [newLineCount, setNewLineCount] = useState(0);

  // =========================================================================
  // File Upload Integration
  // =========================================================================

  // Setup file upload hook
  const { uploadFiles, isUploading, isConfigured } = useFileUpload({
    fileBrowserUrl,
    fileBrowserUsername,
    fileBrowserPassword,
    enabled: enableFileUpload,
  });

  // Handle file drop and paste events
  const handleFilesReceived = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      // Upload in background (uploadFiles will show toast with progress)
      try {
        await uploadFiles(files, {
          showToast: true,
          copyToClipboard: true,
        });
      } catch (error) {
        console.error('[XtermTerminal] Upload failed:', error);
      }
    },
    [uploadFiles]
  );

  // Setup drag and drop / paste event handling
  useFileDrop({
    enabled: isConfigured && !isUploading,
    onFilesDropped: handleFilesReceived,
    onFilesPasted: handleFilesReceived,
  });

  // =========================================================================
  // Memoized Configuration
  // =========================================================================

  const terminalOptions: ITerminalOptions = useMemo(
    () => ({
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
    }),
    [fontSize, fontFamily, theme]
  );

  // =========================================================================
  // Callbacks
  // =========================================================================

  const handleScrollToBottom = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.scrollToBottom();
      console.log('[XtermTerminal] User scrolled to bottom');
    }
    setHasNewContent(false);
    setNewLineCount(0);
  }, []);

  // Wrap callbacks to ensure stability
  const stableOnReady = useCallback(() => {
    onReady?.();
  }, [onReady]);

  const stableOnConnected = useCallback(() => {
    onConnected?.();
  }, [onConnected]);

  const stableOnDisconnected = useCallback(() => {
    onDisconnected?.();
  }, [onDisconnected]);

  // =========================================================================
  // Main Effect - Terminal Lifecycle Management
  // =========================================================================

  useEffect(() => {
    if (!containerRef.current || !wsUrl) return;

    let terminal: ITerminal | null = null;
    let fitAddon: FitAddon | null = null;
    let socket: WebSocket | null = null;
    let webglAddon: WebglAddon | null = null;
    let canvasAddon: CanvasAddon | null = null;
    let isMounted = true;
    let isAtBottom = true;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    // -----------------------------------------------------------------------
    // Helper: Check if at bottom
    // -----------------------------------------------------------------------

    const isTerminalAtBottom = (): boolean => {
      if (!terminal) return true;
      try {
        const buffer = terminal.buffer.active;
        const threshold = 2;
        return buffer.viewportY >= buffer.baseY - threshold;
      } catch {
        return true;
      }
    };

    // -----------------------------------------------------------------------
    // Helper: Parse WebSocket URL
    // -----------------------------------------------------------------------

    const parseUrl = (): { wsFullUrl: string; token: string } | null => {
      try {
        const url = new URL(wsUrl);
        const token = url.searchParams.get('arg') || '';

        if (!token) {
          console.error('[XtermTerminal] No authentication token found in URL');
          return null;
        }

        const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsPath = url.pathname.replace(/\/$/, '') + '/ws';
        const wsFullUrl = `${wsProtocol}//${url.host}${wsPath}${url.search}`;

        console.log('[XtermTerminal] Connecting to:', wsFullUrl.replace(token, '***'));
        return { wsFullUrl, token };
      } catch (error) {
        console.error('[XtermTerminal] Failed to parse URL:', error);
        return null;
      }
    };

    // -----------------------------------------------------------------------
    // Helper: Send data to server
    // -----------------------------------------------------------------------

    const sendData = (data: string | Uint8Array) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      if (typeof data === 'string') {
        // Allocate buffer for UTF-8 encoding: each character may take up to 3 bytes in UTF-8.
        // The extra byte (+1) is for the command code at the start of the buffer.
        const payload = new Uint8Array(data.length * 3 + 1);
        payload[0] = ClientCommand.INPUT.charCodeAt(0);
        const stats = textEncoder.encodeInto(data, payload.subarray(1));
        socket.send(payload.subarray(0, (stats.written as number) + 1));
      } else {
        const payload = new Uint8Array(data.length + 1);
        payload[0] = ClientCommand.INPUT.charCodeAt(0);
        payload.set(data, 1);
        socket.send(payload);
      }
    };

    // -----------------------------------------------------------------------
    // Helper: Apply renderer
    // -----------------------------------------------------------------------

    const applyRenderer = async (type: 'dom' | 'canvas' | 'webgl') => {
      if (!terminal) return;

      // Cleanup existing renderers
      try {
        webglAddon?.dispose();
        webglAddon = null;
      } catch {}
      try {
        canvasAddon?.dispose();
        canvasAddon = null;
      } catch {}

      // Apply new renderer
      switch (type) {
        case 'webgl':
          try {
            const { WebglAddon: WebglAddonClass } = await import('@xterm/addon-webgl');
            webglAddon = new WebglAddonClass();
            terminal.loadAddon(webglAddon);
            console.log('[XtermTerminal] WebGL renderer loaded');
          } catch (e) {
            console.log('[XtermTerminal] WebGL failed, falling back to canvas', e);
            await applyRenderer('canvas');
          }
          break;
        case 'canvas':
          try {
            const { CanvasAddon: CanvasAddonClass } = await import('@xterm/addon-canvas');
            canvasAddon = new CanvasAddonClass();
            terminal.loadAddon(canvasAddon);
            console.log('[XtermTerminal] Canvas renderer loaded');
          } catch (e) {
            console.log('[XtermTerminal] Canvas failed, using DOM', e);
          }
          break;
        case 'dom':
          console.log('[XtermTerminal] DOM renderer loaded');
          break;
      }
    };

    // -----------------------------------------------------------------------
    // Helper: Connect WebSocket
    // -----------------------------------------------------------------------

    const connectWebSocket = () => {
      if (!terminal || !isMounted) return;

      const urlInfo = parseUrl();
      if (!urlInfo) {
        stableOnDisconnected();
        return;
      }

      const { wsFullUrl, token } = urlInfo;

      console.log('[XtermTerminal] Creating WebSocket connection...');
      socket = new WebSocket(wsFullUrl, ['tty']);
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        if (!isMounted) return;
        console.log('[XtermTerminal] WebSocket connected');
        stableOnConnected();

        const authMsg = JSON.stringify({
          AuthToken: token,
          columns: terminal!.cols,
          rows: terminal!.rows,
        });
        socket?.send(textEncoder.encode(authMsg));
        terminal!.focus();
      };

      socket.onmessage = (event: MessageEvent) => {
        if (!terminal || !isMounted) return;

        const rawData = event.data as ArrayBuffer;
        const cmd = String.fromCharCode(new Uint8Array(rawData)[0]);
        const data = rawData.slice(1);

        switch (cmd) {
          case Command.OUTPUT:
            const shouldAutoScroll = isAtBottom;
            terminal.write(new Uint8Array(data));

            if (shouldAutoScroll) {
              requestAnimationFrame(() => {
                terminal?.scrollToBottom();
                requestAnimationFrame(() => {
                  if (terminal && !isTerminalAtBottom()) {
                    terminal.scrollToBottom();
                  }
                });
              });
            }
            break;
          case Command.SET_WINDOW_TITLE:
            document.title = textDecoder.decode(data);
            break;
          case Command.SET_PREFERENCES:
            console.log('[XtermTerminal] Preferences:', textDecoder.decode(data));
            break;
          default:
            console.warn('[XtermTerminal] Unknown command:', cmd);
        }
      };

      socket.onclose = (event: CloseEvent) => {
        if (!isMounted) return;

        console.log('[XtermTerminal] WebSocket closed:', event.code, event.reason);
        socket = null;
        stableOnDisconnected();

        if (event.code !== 1000) {
          terminal?.write('\r\n\x1b[33m[Connection lost. Reconnecting in 3s...]\x1b[0m\r\n');
          reconnectTimeout = setTimeout(() => {
            if (isMounted) connectWebSocket();
          }, 3000);
        } else {
          terminal?.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
        }
      };

      socket.onerror = (error) => {
        console.error('[XtermTerminal] WebSocket error:', error);
      };
    };

    // -----------------------------------------------------------------------
    // Main initialization
    // -----------------------------------------------------------------------

    const init = async () => {
      try {
        const [xtermModule, fitAddonModule, webLinksModule] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
          import('@xterm/addon-web-links'),
        ]);

        if (!isMounted || !containerRef.current) return;

        terminal = new xtermModule.Terminal(terminalOptions);
        terminalRef.current = terminal;

        fitAddon = new fitAddonModule.FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(new webLinksModule.WebLinksAddon());

        terminal.open(containerRef.current);

        requestAnimationFrame(() => {
          if (!isMounted) return;
          fitAddon?.fit();
        });

        requestAnimationFrame(() => {
          if (!isMounted) return;
          applyRenderer(rendererType);
        });

        // Setup event handlers
        terminal.onData((data) => {
          if (!isAtBottom) {
            terminal?.scrollToBottom();
            isAtBottom = true;
          }
          if (hasNewContentRef.current) {
            hasNewContentRef.current = false;
            newLineCountRef.current = 0;
            setHasNewContent(false);
            setNewLineCount(0);
          }
          sendData(data);
        });

        terminal.onBinary((data) => {
          if (!isAtBottom) {
            terminal?.scrollToBottom();
            isAtBottom = true;
          }
          if (hasNewContentRef.current) {
            hasNewContentRef.current = false;
            newLineCountRef.current = 0;
            setHasNewContent(false);
            setNewLineCount(0);
          }
          sendData(Uint8Array.from(data, (v) => v.charCodeAt(0)));
        });

        terminal.onResize(({ cols, rows }) => {
          if (socket?.readyState === WebSocket.OPEN) {
            const msg = JSON.stringify({ columns: cols, rows });
            socket.send(textEncoder.encode(ClientCommand.RESIZE_TERMINAL + msg));
          }
        });

        terminal.onScroll(() => {
          const wasAtBottom = isAtBottom;
          const nowAtBottom = isTerminalAtBottom();

          if (wasAtBottom !== nowAtBottom) {
            isAtBottom = nowAtBottom;
            if (nowAtBottom && hasNewContentRef.current) {
              hasNewContentRef.current = false;
              newLineCountRef.current = 0;
              setHasNewContent(false);
              setNewLineCount(0);
            }
          }
        });

        let lineFeedTimeout: NodeJS.Timeout | null = null;
        terminal.onLineFeed(() => {
          if (lineFeedTimeout) clearTimeout(lineFeedTimeout);
          lineFeedTimeout = setTimeout(() => {
            if (isAtBottom) {
              terminal?.scrollToBottom();
            } else {
              hasNewContentRef.current = true;
              newLineCountRef.current += 1;
              setHasNewContent(true);
              setNewLineCount(newLineCountRef.current);
            }
          }, 10);
        });

        const handleResize = () => fitAddon?.fit();
        window.addEventListener('resize', handleResize);

        stableOnReady();
        connectWebSocket();

        console.log('[XtermTerminal] Initialization complete');
      } catch (error) {
        console.error('[XtermTerminal] Initialization failed:', error);
      }
    };

    init();

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return () => {
      console.log('[XtermTerminal] Cleaning up');
      isMounted = false;

      if (reconnectTimeout) clearTimeout(reconnectTimeout);

      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.onopen = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000, 'Component unmounted');
        }
      }

      try {
        webglAddon?.dispose();
      } catch {}
      try {
        canvasAddon?.dispose();
      } catch {}

      terminal?.dispose();
      terminalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" style={{ padding: '5px' }} />

      {/* Scroll to bottom button */}
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
