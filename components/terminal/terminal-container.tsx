/**
 * TerminalContainer Component
 *
 * Main container that combines toolbar and display
 * Manages tab state and renders separate terminal instances for each tab
 * Each tab gets its own iframe with independent WebSocket connection
 */

'use client';

import { useState } from 'react';
import type { Prisma } from '@prisma/client';

import { TerminalDisplay } from './terminal-display';
import { type Tab, TerminalToolbar } from './terminal-toolbar';

type Project = Prisma.ProjectGetPayload<{
  include: {
    sandboxes: true;
    databases: true;
  };
}>;

type Sandbox = Prisma.SandboxGetPayload<object>;

export interface TerminalContainerProps {
  /** Project data */
  project: Project;
  /** Sandbox data */
  sandbox: Sandbox | undefined;
}

/**
 * Terminal container with toolbar and display
 * Renders separate terminal instances for each tab to ensure independent WebSocket connections
 */
export function TerminalContainer({ project, sandbox }: TerminalContainerProps) {
  // Tab management
  const [tabs, setTabs] = useState<Tab[]>([{ id: '1', name: 'Terminal 1' }]);
  const [activeTabId, setActiveTabId] = useState('1');

  // Tab operations
  const handleTabAdd = () => {
    const newId = Date.now().toString(); // Use timestamp for unique ID
    const newTab: Tab = {
      id: newId,
      name: `Terminal ${tabs.length + 1}`,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const handleTabClose = (id: string) => {
    if (tabs.length === 1) return; // Keep at least one terminal

    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);

    if (activeTabId === id) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const handleTabSelect = (id: string) => {
    setActiveTabId(id);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Toolbar */}
      <TerminalToolbar
        project={project}
        sandbox={sandbox}
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onTabAdd={handleTabAdd}
      />

      {/* Terminal Displays - render all tabs but only show active one */}
      <div className="flex-1 bg-black relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{
              display: tab.id === activeTabId ? 'block' : 'none',
            }}
          >
            <TerminalDisplay
              key={tab.id}
              ttydUrl={sandbox?.ttydUrl}
              status={project.status}
              tabId={tab.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
