/**
 * TerminalContainer Component
 *
 * Root container component that manages terminal tabs and combines toolbar with display area.
 * Implements multi-tab functionality where each tab maintains an independent terminal instance.
 *
 * Architecture:
 * - Tab state management (add, close, switch)
 * - Renders all tabs but only shows the active one (maintains state)
 * - Passes project and sandbox data to child components
 * - Each tab gets unique terminal instance with independent WebSocket
 */

'use client';

import { useState } from 'react';
import type { Prisma } from '@prisma/client';

import { TerminalDisplay } from './terminal-display';
import { type Tab, TerminalToolbar } from './terminal-toolbar';

// ============================================================================
// Types
// ============================================================================

type Project = Prisma.ProjectGetPayload<{
  include: {
    sandboxes: true;
    databases: true;
    environments: true;
  };
}>;

type Sandbox = Prisma.SandboxGetPayload<object>;

export interface TerminalContainerProps {
  project: Project;
  sandbox: Sandbox | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function TerminalContainer({ project, sandbox }: TerminalContainerProps) {
  // =========================================================================
  // Tab State Management
  // =========================================================================

  const [tabs, setTabs] = useState<Tab[]>([{ id: '1', name: 'Terminal 1' }]);
  const [activeTabId, setActiveTabId] = useState('1');

  // =========================================================================
  // Extract FileBrowser Credentials
  // =========================================================================

  const fileBrowserCredentials = (() => {
    const username = project.environments?.find((env) => env.key === 'FILE_BROWSER_USERNAME')
      ?.value;
    const password = project.environments?.find((env) => env.key === 'FILE_BROWSER_PASSWORD')
      ?.value;

    if (username && password) {
      return { username, password };
    }
    return undefined;
  })();

  // =========================================================================
  // Tab Operations
  // =========================================================================

  /**
   * Create and activate a new terminal tab
   */
  const handleTabAdd = () => {
    const newId = Date.now().toString();
    const newTab: Tab = {
      id: newId,
      name: `Terminal ${tabs.length + 1}`,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  /**
   * Close a terminal tab
   * Maintains at least one tab and switches to first tab if closing active tab
   */
  const handleTabClose = (id: string) => {
    if (tabs.length === 1) return;

    const remainingTabs = tabs.filter((t) => t.id !== id);
    setTabs(remainingTabs);

    // Switch to first tab if we're closing the active tab
    if (activeTabId === id) {
      setActiveTabId(remainingTabs[0].id);
    }
  };

  /**
   * Switch to a different tab
   */
  const handleTabSelect = (id: string) => {
    setActiveTabId(id);
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Toolbar with tabs and operations */}
      <TerminalToolbar
        project={project}
        sandbox={sandbox}
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onTabAdd={handleTabAdd}
        fileBrowserCredentials={fileBrowserCredentials}
      />

      {/* Terminal display area with tab switching */}
      <div className="flex-1 bg-black relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{
              display: tab.id === activeTabId ? 'block' : 'none',
            }}
          >
            {/* Each tab maintains its own terminal instance */}
            <TerminalDisplay
              key={tab.id}
              ttydUrl={sandbox?.ttydUrl}
              status={sandbox?.status ?? 'CREATING'}
              tabId={tab.id}
              fileBrowserUrl={sandbox?.fileBrowserUrl}
              fileBrowserUsername={fileBrowserCredentials?.username}
              fileBrowserPassword={fileBrowserCredentials?.password}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
