'use client';

import { useEffect, useState } from 'react';
import type { Environment } from '@prisma/client';
import { Check, Copy, Eye, EyeOff, Key, Lock, Plus, Save, Shield, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { SystemSecretsList } from '@/components/secrets-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { GET, POST } from '@/lib/fetch-client';

interface EnvVariable {
  id?: string;
  key: string;
  value: string;
  category?: string;
  isSecret?: boolean;
}

interface SystemSecret {
  key: string;
  value: string;
  category?: string | null;
  description?: string;
}

interface Project {
  id: string;
  name: string;
  environments: Environment[];
}

export default function SecretsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [secrets, setSecrets] = useState<EnvVariable[]>([]);
  const [systemSecrets, setSystemSecrets] = useState<SystemSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedSecrets, setCopiedSecrets] = useState<Set<string>>(new Set());

  // Fetch secrets from project data
  const fetchSecrets = async () => {
    try {
      // Get project data including environments
      const project: Project = await GET(`/api/projects/${projectId}`);

      // Filter for secret category and isSecret true
      const secretEnvs = project.environments
        .filter(env => env.category === 'secret' && env.isSecret)
        .map(env => ({
          id: env.id,
          key: env.key,
          value: env.value,
          category: env.category || undefined,
          isSecret: env.isSecret
        }));

      setSecrets(secretEnvs);

      // Get user-level secrets (like ANTHROPIC_API_KEY)
      // This would come from a different endpoint or be hardcoded
      const userSecrets: SystemSecret[] = [
        // Add system secrets here if needed
      ];
      setSystemSecrets(userSecrets);
    } catch (error) {
      console.error('Error fetching secrets:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to load secrets: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecrets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Helper functions
  // const maskSecret = (value: string): string => {
  //   if (!value || value.length < 8) return '••••••••';
  //   return '••••' + value.slice(-4);
  // };

  const toggleVisibility = (index: number) => {
    const key = `secret-${index}`;
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

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      const key = `secret-${index}`;
      setCopiedSecrets((prev) => new Set(prev).add(key));
      setTimeout(() => {
        setCopiedSecrets((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }, 2000);
      toast.success('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Validation function
  const validateSecrets = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const keys = new Set<string>();

    // Check for duplicate keys
    secrets.forEach((secret) => {
      if (secret.key) {
        if (keys.has(secret.key)) {
          errors.push(`Duplicate secret key: ${secret.key}`);
        } else {
          keys.add(secret.key);
        }
      }
    });

    // Check for valid key format
    secrets.forEach((secret) => {
      if (secret.key && !/^[A-Z][A-Z0-9_]*$/.test(secret.key)) {
        errors.push(`Secret key "${secret.key}" must start with an uppercase letter and contain only uppercase letters, numbers, and underscores`);
      }
    });

    // Check for empty values
    secrets.forEach((secret) => {
      if (secret.key && !secret.value.trim()) {
        errors.push(`Secret key "${secret.key}" cannot have an empty value`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // CRUD operations
  const addSecret = () => {
    setSecrets([...secrets, { key: '', value: '', category: 'secret', isSecret: true }]);
  };

  const removeSecret = (index: number) => {
    const secret = secrets[index];
    if (secret.key) {
      // Only ask for confirmation if the secret has a key (non-empty)
      if (window.confirm(`Are you sure you want to delete the secret "${secret.key}"? This action cannot be undone.`)) {
        setSecrets(secrets.filter((_, i) => i !== index));
        toast.success('Secret removed');
      }
    } else {
      // Remove empty secrets without confirmation
      setSecrets(secrets.filter((_, i) => i !== index));
    }
  };

  const updateSecret = (index: number, field: keyof EnvVariable, value: string) => {
    const updated = [...secrets];
    updated[index] = { ...updated[index], [field]: value };
    setSecrets(updated);
  };

  const saveSecrets = async () => {
    // Validate before saving
    const validation = validateSecrets();
    if (!validation.isValid) {
      validation.errors.forEach(error => toast.error(error));
      return;
    }

    setSaving(true);

    // Only save secrets with both key and value
    const validSecrets = secrets.filter(secret => secret.key && secret.value);

    try {
      await POST(`/api/projects/${projectId}/environment`, {
        variables: validSecrets.map(secret => ({
          key: secret.key,
          value: secret.value,
          category: 'secret',
          isSecret: true
        }))
      });

      toast.success(`Successfully saved ${validSecrets.length} secret${validSecrets.length !== 1 ? 's' : ''}`);
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error('Error saving secrets:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to save secrets: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-content-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Spinner className="h-5 w-5" />
          <span>Loading secrets...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-content-background">
      {/* VSCode-style Header Panel */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">Secret Configuration</h1>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              Manage sensitive environment variables and API keys for your project
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto space-y-6">
          {/* Project Secrets Card */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Project Secrets
                </CardTitle>
                <Button
                  onClick={addSecret}
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-accent transition-colors w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Secret
                </Button>
              </div>
              <CardDescription className="text-muted-foreground">
                Project-specific secrets that can be edited and deleted
                <br />
                <span className="text-xs">Press Ctrl+S to save • Press Escape to cancel</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              {secrets.length > 0 ? (
                <div className="space-y-3">
                  {secrets.map((secret, index) => {
                    const isVisible = visibleSecrets.has(`secret-${index}`);
                    const isCopied = copiedSecrets.has(`secret-${index}`);

                    return (
                      <div key={index} className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-12 md:col-span-4">
                          <Input
                            placeholder="SECRET_KEY"
                            value={secret.key}
                            onChange={(e) =>
                              updateSecret(
                                index,
                                'key',
                                e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')
                              )
                            }
                            className="bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-6 relative">
                          <Input
                            type={isVisible ? 'text' : 'password'}
                            placeholder="Secret value"
                            value={secret.value}
                            onChange={(e) => updateSecret(index, 'value', e.target.value)}
                            className="bg-input border-border text-foreground text-sm pr-20 focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleVisibility(index)}
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title={isVisible ? 'Hide secret' : 'Show secret'}
                            >
                              {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(secret.value, index)}
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title="Copy to clipboard"
                            >
                              {isCopied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                        <div className="col-span-12 md:col-span-2 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSecret(index)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors md:w-auto w-full"
                            title="Remove secret"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto w-10 h-10 bg-muted rounded-full flex items-center justify-center mb-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No secrets configured yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add your first secret to securely store sensitive data
                  </p>
                </div>
              )}

              {secrets.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex gap-3">
                      <Button
                        onClick={saveSecrets}
                        disabled={saving || secrets.length === 0}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        onClick={() => router.back()}
                        variant="outline"
                        className="border-border text-foreground hover:bg-accent transition-colors"
                      >
                        Cancel
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {secrets.filter(s => s.key && s.value).length > 0 && (
                        <span>{secrets.filter(s => s.key && s.value).length} secret{secrets.filter(s => s.key && s.value).length !== 1 ? 's' : ''} configured</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User-level Secrets (e.g., ANTHROPIC_API_KEY) */}
          <SystemSecretsList systemSecrets={systemSecrets} />

          {/* Security Best Practices */}
          <Card className="bg-card border-border shadow-sm p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-medium text-foreground">Security Best Practices</h2>
            </div>

            <ul className="text-sm text-muted-foreground space-y-3 mt-4">
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5 shrink-0">✓</span>
                <span>Never commit secrets to version control systems</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5 shrink-0">✓</span>
                <span>Use environment-specific secrets for different deployment stages</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5 shrink-0">✓</span>
                <span>Rotate secrets regularly to maintain security hygiene</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5 shrink-0">✓</span>
                <span>Limit access to secrets on a need-to-know basis</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5 shrink-0">✓</span>
                <span>Use strong, randomly generated values for API keys and tokens</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}