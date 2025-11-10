'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, Eye, EyeOff, Key, Settings, Shield } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
    <Card className="bg-card border-border overflow-hidden gap-0 py-0">
      {/* Collapsible Header */}
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 justify-between hover:bg-accent h-auto py-4"
      >
        <div className="flex items-center gap-3">
          <div
            className="transition-transform duration-300 ease-in-out"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <div className="flex gap-4">
              <h2 className="text-lg font-medium text-foreground">Claude Code Secrets</h2>
              <p className="text-xs text-muted-foreground mt-0">
                ({systemSecrets.length} variable{systemSecrets.length !== 1 ? 's' : ''})
              </p>
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {isExpanded ? 'Click to collapse' : 'Click to expand'}
        </div>
      </Button>

      {/* Collapsible Content with Smooth Animation */}
      <div
        style={{
          maxHeight: isExpanded ? `${contentHeight}px` : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
        className="transition-all duration-300 ease-in-out overflow-hidden"
      >
        <CardContent ref={contentRef} className="px-6 pb-6 space-y-4 border-t border-border">
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
                      <Badge variant="secondary" className="text-xs">
                        System
                      </Badge>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleVisibility(secret.key)}
                          title={isVisible ? 'Hide value' : 'Show value'}
                        >
                          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(secret.key, secret.value)}
                          title="Copy to clipboard"
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
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
        </CardContent>
      </div>
    </Card>
  );
}
