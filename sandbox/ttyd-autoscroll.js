/**
 * Force Auto-Scroll for ttyd/xterm.js
 *
 * This script is injected into ttyd's HTML page to override xterm.js scroll behavior.
 * It ensures the terminal always scrolls to bottom when new content arrives,
 * even if the user has scrolled up to view history.
 *
 * Strategy:
 * 1. Wait for xterm.js instance (window.term)
 * 2. Hook into data/write events
 * 3. Force scroll to bottom during active streaming
 * 4. Report status to parent window via postMessage
 */

(function() {
    'use strict';

    const DEBUG = true;
    const log = (...args) => DEBUG && console.log('[AutoScroll]', ...args);

    log('Initializing...');

    // Configuration
    const CONFIG = {
        // Time window to consider "active streaming" (ms)
        STREAMING_WINDOW: 800,
        // Scroll check interval during streaming (ms)
        SCROLL_INTERVAL: 100,
        // Idle timeout before stopping scroll checks (ms)
        IDLE_TIMEOUT: 2000,
    };

    /**
     * Wait for xterm.js instance to be available
     */
    function waitForTerminal() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (window.term && window.term.element) {
                    clearInterval(checkInterval);
                    log(`✓ Terminal found after ${Date.now() - startTime}ms`);
                    resolve(window.term);
                }

                // Timeout after 10 seconds
                if (Date.now() - startTime > 10000) {
                    clearInterval(checkInterval);
                    log('✗ Terminal not found (timeout)');
                    resolve(null);
                }
            }, 50);
        });
    }

    /**
     * Check if terminal is at bottom
     */
    function isAtBottom(term) {
        try {
            const viewport = term.element.querySelector('.xterm-viewport');
            if (!viewport) return true;

            const scrollTop = viewport.scrollTop;
            const scrollHeight = viewport.scrollHeight;
            const clientHeight = viewport.clientHeight;

            // Consider "at bottom" if within 50px
            return scrollTop + clientHeight >= scrollHeight - 50;
        } catch (e) {
            return true;
        }
    }

    /**
     * Force scroll to bottom
     */
    function forceScrollToBottom(term) {
        try {
            term.scrollToBottom();
        } catch (e) {
            log('Error scrolling:', e);
        }
    }

    /**
     * Notify parent window about scroll status
     */
    function notifyParent(status) {
        try {
            window.parent.postMessage({
                type: 'ttyd-scroll-status',
                status: status,
                timestamp: Date.now(),
            }, '*');
        } catch (e) {
            // Ignore postMessage errors
        }
    }

    /**
     * Main auto-scroll logic
     */
    async function initAutoScroll() {
        const term = await waitForTerminal();
        if (!term) {
            log('✗ Failed to initialize - terminal not found');
            return;
        }

        log('✓ Terminal instance detected');

        let lastActivityTime = 0;
        let scrollInterval = null;
        let isStreaming = false;

        /**
         * Start aggressive auto-scroll during streaming
         */
        function startScrolling() {
            if (scrollInterval) return;

            isStreaming = true;
            notifyParent('streaming');
            log('→ Streaming detected, starting auto-scroll');

            scrollInterval = setInterval(() => {
                const timeSinceActivity = Date.now() - lastActivityTime;

                // Active streaming: force scroll
                if (timeSinceActivity < CONFIG.STREAMING_WINDOW) {
                    forceScrollToBottom(term);
                }
                // Idle for too long: stop scrolling
                else if (timeSinceActivity > CONFIG.IDLE_TIMEOUT) {
                    stopScrolling();
                }
            }, CONFIG.SCROLL_INTERVAL);
        }

        /**
         * Stop auto-scroll when idle
         */
        function stopScrolling() {
            if (!scrollInterval) return;

            clearInterval(scrollInterval);
            scrollInterval = null;
            isStreaming = false;
            notifyParent('idle');
            log('→ Streaming stopped, auto-scroll disabled');
        }

        /**
         * Record activity and trigger scrolling
         */
        function recordActivity() {
            lastActivityTime = Date.now();

            // Start scrolling if not already active
            if (!isStreaming) {
                startScrolling();
            }
        }

        // Hook 1: Monitor data events (keyboard input, etc.)
        try {
            term.onData(() => {
                recordActivity();
            });
            log('✓ Hooked into onData');
        } catch (e) {
            log('⚠ Failed to hook onData:', e);
        }

        // Hook 2: Override write method (terminal output)
        try {
            const originalWrite = term.write.bind(term);
            const originalWriteln = term.writeln.bind(term);

            term.write = function(...args) {
                recordActivity();
                return originalWrite(...args);
            };

            term.writeln = function(...args) {
                recordActivity();
                return originalWriteln(...args);
            };

            log('✓ Hooked into write/writeln');
        } catch (e) {
            log('⚠ Failed to hook write methods:', e);
        }

        // Hook 3: Monitor terminal buffer changes (fallback)
        try {
            let lastBufferLength = term.buffer.active.length;

            setInterval(() => {
                const currentBufferLength = term.buffer.active.length;
                if (currentBufferLength !== lastBufferLength) {
                    recordActivity();
                    lastBufferLength = currentBufferLength;
                }
            }, 200);

            log('✓ Monitoring buffer changes');
        } catch (e) {
            log('⚠ Failed to monitor buffer:', e);
        }

        log('✓✓✓ Auto-scroll fully initialized ✓✓✓');
        notifyParent('ready');

        // Test: Trigger initial scroll
        setTimeout(() => {
            forceScrollToBottom(term);
        }, 500);
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAutoScroll);
    } else {
        initAutoScroll();
    }

})();
