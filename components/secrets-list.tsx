'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, Eye, EyeOff, Key, Settings, Shield } from 'lucide-react';

interface SystemSecret {
  key: string;
  value: string;
  category?: string | null;
  description?: string;
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
    setVisibleSecrets((prev) => {
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
      setCopiedSecrets((prev) => new Set(prev).add(key));
      setTimeout(() => {
        setCopiedSecrets((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (systemSecrets.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="transition-transform duration-300 ease-in-out"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <Settings className="h-5 w-5 text-primary" />
          <div className="text-left">
            <h2 className="text-lg font-medium text-foreground">Claude Code Secrets</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              System-wide secrets ({systemSecrets.length} variable
              {systemSecrets.length !== 1 ? 's' : ''})
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
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
        <div ref={contentRef} className="px-6 pb-6 space-y-4 border-t border-border">
          <p className="text-xs text-muted-foreground pt-4">
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
                  className="flex items-center justify-between p-3 bg-accent rounded-lg border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-primary shrink-0" />
                      <code className="text-sm font-mono text-foreground font-medium">
                        {secret.key}
                      </code>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                        System
                      </span>
                    </div>

                    {secret.description && (
                      <p className="text-xs text-muted-foreground ml-6 mb-2">{secret.description}</p>
                    )}

                    <div className="ml-6">
                      <code className="text-sm font-mono text-foreground">
                        {isEmpty ? (
                          <span className="text-muted-foreground italic">(empty - uses default)</span>
                        ) : isVisible ? (
                          secret.value
                        ) : (
                          <span className="text-muted-foreground">{maskSecret(secret.value)}</span>
                        )}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!isEmpty && (
                      <>
                        <button
                          onClick={() => toggleVisibility(secret.key)}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors hover:bg-accent/50 rounded"
                          title={isVisible ? 'Hide value' : 'Show value'}
                        >
                          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(secret.key, secret.value)}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors hover:bg-accent/50 rounded"
                          title="Copy to clipboard"
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
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

          <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-primary" />
              <span>
                To modify these values, edit{' '}
                <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">
                  .secret/.env
                </code>{' '}
                file in the project root
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
