"use client";

import { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, Copy, Check, Shield, Key, Settings, ChevronRight } from "lucide-react";

interface SystemSecret {
  key: string;
  value: string;
  category?: string | null;
}

interface SecretsListProps {
  systemSecrets: SystemSecret[];
}

// Helper functions
function maskSecret(value: string): string {
  if (!value || value.length < 8) return '••••••••';
  return '••••' + value.slice(-4);
}

function isEmptyValue(value: string): boolean {
  return !value || value.trim() === '';
}

export function SystemSecretsList({ systemSecrets }: SecretsListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedSecrets, setCopiedSecrets] = useState<Set<string>>(new Set());
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Calculate content height when expanded
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [systemSecrets, isExpanded]);

  const toggleVisibility = (key: string) => {
    setVisibleSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSecrets(prev => new Set(prev).add(key));
      setTimeout(() => {
        setCopiedSecrets(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (systemSecrets.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#252526] rounded-lg border border-[#3e3e42] overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#2a2d2e] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="transition-transform duration-300 ease-in-out" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
          <Settings className="h-5 w-5 text-blue-400" />
          <div className="text-left">
            <h2 className="text-lg font-medium text-white">
              Claude Code Secrets
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              System-wide secrets ({systemSecrets.length} variable{systemSecrets.length !== 1 ? 's' : ''})
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {isExpanded ? 'Click to collapse' : 'Click to expand'}
        </div>
      </button>

      {/* Collapsible Content with Smooth Animation */}
      <div
        style={{
          maxHeight: isExpanded ? `${contentHeight}px` : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
        className="transition-all duration-300 ease-in-out overflow-hidden"
      >
        <div ref={contentRef} className="px-6 pb-6 space-y-4 border-t border-[#3e3e42]">
          <p className="text-xs text-gray-400 pt-4">
            System-wide secrets shared across all projects (read-only)
          </p>

          <div className="space-y-3">
            {systemSecrets.map((secret) => {
              const isVisible = visibleSecrets.has(secret.key);
              const isCopied = copiedSecrets.has(secret.key);
              const isEmpty = isEmptyValue(secret.value);

              return (
                <div
                  key={secret.key}
                  className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <code className="text-sm font-mono text-gray-300 font-medium">
                        {secret.key}
                      </code>
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                        System
                      </span>
                    </div>

                    {secret.description && (
                      <p className="text-xs text-gray-400 ml-6 mb-2">
                        {secret.description}
                      </p>
                    )}

                    <div className="ml-6">
                      <code className="text-sm font-mono text-gray-200">
                        {isEmpty ? (
                          <span className="text-gray-500 italic">(empty - uses default)</span>
                        ) : isVisible ? (
                          secret.value
                        ) : (
                          <span className="text-gray-400">{maskSecret(secret.value)}</span>
                        )}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!isEmpty && (
                      <>
                        <button
                          onClick={() => toggleVisibility(secret.key)}
                          className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors hover:bg-[#2a2d2e] rounded"
                          title={isVisible ? "Hide value" : "Show value"}
                        >
                          {isVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(secret.key, secret.value)}
                          className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors hover:bg-[#2a2d2e] rounded"
                          title="Copy to clipboard"
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4 text-green-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-gray-300">
            <p className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-blue-400" />
              <span>
                To modify these values, edit <code className="text-blue-300 bg-blue-500/20 px-1 py-0.5 rounded">.secret/.env</code> file in the project root
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
