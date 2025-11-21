/**
 * TerminalToolbar Component
 *
 * Toolbar for terminal with tabs, status, and operation controls
 */

'use client';

import { useState } from 'react';
import type { Prisma } from '@prisma/client';
import { Copy, Eye, EyeOff, Network, Plus, Terminal as TerminalIcon, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getStatusBgClasses } from '@/lib/util/status-colors';
import { cn } from '@/lib/utils';

type Project = Prisma.ProjectGetPayload<{
  include: {
    sandboxes: true;
    databases: true;
  };
}>;

type Sandbox = Prisma.SandboxGetPayload<object>;

export interface Tab {
  id: string;
  name: string;
}

export interface TerminalToolbarProps {
  /** Project data */
  project: Project;
  /** Sandbox data */
  sandbox: Sandbox | undefined;
  /** Terminal tabs */
  tabs: Tab[];
  /** Active tab ID */
  activeTabId: string;
  /** Callback when tab is selected */
  onTabSelect: (tabId: string) => void;
  /** Callback when tab is closed */
  onTabClose: (tabId: string) => void;
  /** Callback when new tab is added */
  onTabAdd: () => void;
  /** FileBrowser credentials (optional) */
  fileBrowserCredentials?: {
    username: string;
    password: string;
  };
}

/**
 * Terminal toolbar with tabs and operations
 */
export function TerminalToolbar({
  project,
  sandbox,
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabAdd,
  fileBrowserCredentials,
}: TerminalToolbarProps) {
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Build network endpoints list, filtering out any without URLs
  const allEndpoints = [
    { domain: sandbox?.publicUrl, port: 3000, protocol: 'HTTPS', label: 'Application' },
    { domain: sandbox?.ttydUrl, port: 7681, protocol: 'HTTPS', label: 'Terminal' },
    {
      domain: sandbox?.fileBrowserUrl,
      port: 8080,
      protocol: 'HTTPS',
      label: 'File Browser',
      hasCredentials: true,
    },
  ];

  // Only show endpoints that have a valid domain URL
  const networkEndpoints = allEndpoints.filter(endpoint => endpoint.domain);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <>
      <div className="h-9 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-2">
        {/* Terminal Tabs */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors',
                activeTabId === tab.id
                  ? 'bg-[#1e1e1e] text-white'
                  : 'text-gray-400 hover:bg-[#37373d]'
              )}
              onClick={() => onTabSelect(tab.id)}
            >
              <TerminalIcon className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  className="ml-1 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={onTabAdd}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#37373d] rounded transition-colors"
            title="Add new terminal"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-300">
            <div className={cn('h-1.5 w-1.5 rounded-full', getStatusBgClasses(project.status))} />
            <span>{project.status}</span>
          </div>

          {/* Network Button */}
          <button
            onClick={() => setShowNetworkDialog(true)}
            className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#37373d] rounded transition-colors flex items-center gap-1"
            title="View network endpoints"
          >
            <Network className="h-3 w-3" />
            <span>Network</span>
          </button>
        </div>
      </div>

      {/* Network Dialog */}
      <Dialog open={showNetworkDialog} onOpenChange={setShowNetworkDialog}>
        <DialogContent className="bg-[#252526] border-[#3e3e42] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Network Endpoints</DialogTitle>
            <DialogDescription className="text-gray-400 mt-1">
              All publicly accessible endpoints for this sandbox
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 mt-5">
            {networkEndpoints.map((endpoint, index) => (
              <div
                key={index}
                className="p-3.5 bg-[#1e1e1e] rounded-lg border border-[#3e3e42] hover:border-[#4e4e52] transition-colors"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-white">Port {endpoint.port}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#252526] text-[#858585] border border-[#3e3e42]">
                      {endpoint.label}
                    </span>
                  </div>
                  <span className="text-xs text-[#858585] font-mono">{endpoint.protocol}</span>
                </div>
                <a
                  href={endpoint.domain || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#3794ff] hover:text-[#4fc1ff] break-all underline underline-offset-2 hover:underline-offset-4 transition-all"
                >
                  {endpoint.domain}
                </a>

                {/* Show credentials for File Browser */}
                {endpoint.hasCredentials && fileBrowserCredentials && (
                  <div className="mt-3 pt-3 border-t border-[#3e3e42] space-y-2">
                    <div className="text-xs text-gray-400 mb-1.5">Login Credentials:</div>

                    {/* Username */}
                    <div className="flex items-center gap-2 bg-[#252526] rounded p-2 border border-[#3e3e42]">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-500 mb-0.5">Username</div>
                        <code className="text-xs text-blue-400 break-all">
                          {fileBrowserCredentials.username}
                        </code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(fileBrowserCredentials.username, 'username')}
                        className="p-1.5 hover:bg-[#37373d] rounded transition-colors shrink-0"
                        title="Copy username"
                      >
                        {copiedField === 'username' ? (
                          <span className="text-xs text-green-400">✓</span>
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </button>
                    </div>

                    {/* Password */}
                    <div className="flex items-center gap-2 bg-[#252526] rounded p-2 border border-[#3e3e42]">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-500 mb-0.5">Password</div>
                        <code className="text-xs text-blue-400 break-all">
                          {showPassword
                            ? fileBrowserCredentials.password
                            : '••••••••••••••••'}
                        </code>
                      </div>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 hover:bg-[#37373d] rounded transition-colors shrink-0"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                        ) : (
                          <Eye className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => copyToClipboard(fileBrowserCredentials.password, 'password')}
                        className="p-1.5 hover:bg-[#37373d] rounded transition-colors shrink-0"
                        title="Copy password"
                      >
                        {copiedField === 'password' ? (
                          <span className="text-xs text-green-400">✓</span>
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
