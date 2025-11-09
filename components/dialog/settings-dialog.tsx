'use client';

import { useEffect, useState } from 'react';
import { Code, Database, Save, Terminal } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import * as fetchClient from '@/lib/fetch-client';
import { useSealos } from '@/provider/sealos';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'system-prompt' | 'kubeconfig' | 'anthropic';
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI full-stack developer working in a Next.js environment.

## Environment Information
- Framework: Next.js 15 with App Router
- Language: TypeScript
- Database: PostgreSQL with Prisma ORM
- UI Framework: Shadcn/UI with Tailwind CSS
- Authentication: NextAuth v5

## Available Environment Variables
- DATABASE_URL: PostgreSQL connection string
- ANTHROPIC_API_KEY: Claude API key
- ANTHROPIC_BASE_URL: Claude API base URL

## Instructions
- Follow Next.js 15 App Router conventions
- Use TypeScript for type safety
- Implement proper error handling and loading states
- Follow responsive design principles with Tailwind CSS
- Focus on creating production-ready, maintainable code

## Development Guidelines
- Write clean, readable code with proper documentation
- Implement proper error boundaries and validation
- Use semantic HTML and accessibility best practices
- Optimize for performance and SEO
- Follow modern React patterns and best practices`;

type TabType = 'system-prompt' | 'kubeconfig' | 'anthropic';

export default function SettingsDialog({
  open,
  onOpenChange,
  defaultTab = 'kubeconfig',
}: SettingsDialogProps) {
  const { isSealos } = useSealos();
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  // System Prompt state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isSystemPromptLoading, setIsSystemPromptLoading] = useState(false);
  const [isSystemPromptInitialLoading, setIsSystemPromptInitialLoading] = useState(true);

  // Kubeconfig state
  const [kubeconfig, setKubeconfig] = useState('');
  const [kubeconfigNamespace, setKubeconfigNamespace] = useState<string | null>(null);
  const [isKubeconfigLoading, setIsKubeconfigLoading] = useState(false);
  const [isKubeconfigInitialLoading, setIsKubeconfigInitialLoading] = useState(true);

  // Anthropic state
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [anthropicApiBaseUrl, setAnthropicApiBaseUrl] = useState('');
  const [isAnthropicLoading, setIsAnthropicLoading] = useState(false);
  const [isAnthropicInitialLoading, setIsAnthropicInitialLoading] = useState(true);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadSystemPrompt();
      if (!isSealos) {
        loadKubeconfig();
      }
      loadAnthropicConfig();
    }
  }, [open, isSealos]);

  // Set active tab when defaultTab changes
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  const loadSystemPrompt = async () => {
    try {
      const data = await fetchClient.GET<{ systemPrompt: string | null }>(
        '/api/user/config/system-prompt'
      );
      setSystemPrompt(data.systemPrompt || DEFAULT_SYSTEM_PROMPT);
    } catch (error) {
      console.error('Failed to load system prompt:', error);
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    } finally {
      setIsSystemPromptInitialLoading(false);
    }
  };

  const loadKubeconfig = async () => {
    try {
      const data = await fetchClient.GET<{ kubeconfig: string; namespace?: string | null }>(
        '/api/user/config/kc'
      );
      setKubeconfig(data.kubeconfig);
      setKubeconfigNamespace(data.namespace || null);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('404')) {
        setKubeconfig('');
      } else {
        console.error('Failed to load kubeconfig:', error);
      }
    } finally {
      setIsKubeconfigInitialLoading(false);
    }
  };

  const loadAnthropicConfig = async () => {
    try {
      const data = await fetchClient.GET<{ apiKey: string | null; apiBaseUrl: string | null }>(
        '/api/user/config/anthropic'
      );
      setAnthropicApiKey(data.apiKey || '');
      setAnthropicApiBaseUrl(data.apiBaseUrl || '');
    } catch (error) {
      console.error('Failed to load Anthropic config:', error);
    } finally {
      setIsAnthropicInitialLoading(false);
    }
  };

  const handleSaveSystemPrompt = async () => {
    setIsSystemPromptLoading(true);
    try {
      await fetchClient.POST('/api/user/config/system-prompt', {
        systemPrompt,
      });
      toast.success('System prompt saved successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save system prompt:', error);
      toast.error('Failed to save system prompt');
    } finally {
      setIsSystemPromptLoading(false);
    }
  };

  const handleSaveKubeconfig = async () => {
    if (!kubeconfig.trim()) {
      toast.error('Kubeconfig cannot be empty');
      return;
    }

    setIsKubeconfigLoading(true);
    try {
      const result = await fetchClient.POST<{
        success: boolean;
        namespace?: string;
        error?: string;
        valid?: boolean;
      }>('/api/user/config/kc', {
        kubeconfig,
      });

      if (result.success) {
        setKubeconfigNamespace(result.namespace || null);
        toast.success(`Kubeconfig saved successfully (namespace: ${result.namespace})`);
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to save kubeconfig');
      }
    } catch (error: unknown) {
      console.error('Failed to save kubeconfig:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save kubeconfig');
    } finally {
      setIsKubeconfigLoading(false);
    }
  };

  const handleSaveAnthropicConfig = async () => {
    if (!anthropicApiKey.trim() || !anthropicApiBaseUrl.trim()) {
      toast.error('Both API key and base URL are required');
      return;
    }

    setIsAnthropicLoading(true);
    try {
      await fetchClient.POST('/api/user/config/anthropic', {
        apiKey: anthropicApiKey,
        apiBaseUrl: anthropicApiBaseUrl,
      });
      toast.success('Anthropic configuration saved successfully');
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Failed to save Anthropic config:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save Anthropic configuration'
      );
    } finally {
      setIsAnthropicLoading(false);
    }
  };

  const handleResetSystemPrompt = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    toast.success('Reset to default system prompt');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl! h-[85vh] bg-[#252526] border-[#3e3e42] text-white p-0 flex flex-col rounded"
        showCloseButton={true}
      >
        <DialogHeader className="px-6 py-4 border-b border-[#3e3e42]">
          <DialogTitle className="text-xl text-white">Settings</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 py-4">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabType)}
            className="h-full flex flex-col"
          >
            <TabsList
              className={`shrink-0 grid w-full ${isSealos ? 'grid-cols-2' : 'grid-cols-3'} bg-[#1e1e1e] border-[#3e3e42] rounded-lg`}
            >
              <TabsTrigger
                value="system-prompt"
                className="data-[state=active]:bg-[#0e639c] data-[state=active]:text-white text-gray-400 hover:text-white"
              >
                <Code className="mr-2 h-4 w-4" />
                System Prompt
              </TabsTrigger>
              {!isSealos && (
                <TabsTrigger
                  value="kubeconfig"
                  className="data-[state=active]:bg-[#0e639c] data-[state=active]:text-white text-gray-400 hover:text-white"
                >
                  <Database className="mr-2 h-4 w-4" />
                  Kubeconfig
                </TabsTrigger>
              )}
              <TabsTrigger
                value="anthropic"
                className="data-[state=active]:bg-[#0e639c] data-[state=active]:text-white text-gray-400 hover:text-white"
              >
                <Terminal className="mr-2 h-4 w-4" />
                Anthropic
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-4 min-h-0">
              {/* System Prompt Tab */}
              <TabsContent value="system-prompt" className="mt-0 h-full flex flex-col">
                <div className="space-y-4 pb-4 flex-1 flex flex-col min-h-0">
                  <div className="space-y-2 shrink-0">
                    <Label
                      htmlFor="system-prompt-dialog"
                      className="text-white text-sm font-medium"
                    >
                      System Prompt Template
                    </Label>
                  </div>
                  <Textarea
                    id="system-prompt-dialog"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    disabled={isSystemPromptInitialLoading}
                    className="flex-1 min-h-[300px] bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 font-mono text-sm disabled:opacity-50 resize-none overflow-y-auto rounded-md"
                    placeholder={
                      isSystemPromptInitialLoading
                        ? 'Loading...'
                        : 'Enter your system prompt here...'
                    }
                  />
                  <p className="text-xs text-gray-500 shrink-0">
                    This prompt will be used as context for Claude Code to understand your project
                    environment and coding preferences.
                  </p>

                  <div className="flex gap-2 pt-2 shrink-0">
                    <Button
                      onClick={handleSaveSystemPrompt}
                      disabled={isSystemPromptLoading || isSystemPromptInitialLoading}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isSystemPromptLoading ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleResetSystemPrompt}
                      disabled={isSystemPromptInitialLoading}
                      className="border-[#3e3e42] text-gray-400 hover:text-white hover:bg-[#3e3e42]"
                    >
                      Reset to Default
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Kubeconfig Tab */}
              {!isSealos && (
                <TabsContent value="kubeconfig" className="mt-0 h-full flex flex-col">
                  <div className="space-y-4 pb-4 flex-1 flex flex-col min-h-0">
                    <div className="space-y-2 shrink-0">
                      <Label htmlFor="kubeconfig-dialog" className="text-white text-sm font-medium">
                        Kubeconfig Content
                      </Label>
                      {kubeconfigNamespace && (
                        <p className="text-xs text-green-500 mt-1">
                          Current namespace: {kubeconfigNamespace}
                        </p>
                      )}
                    </div>
                    <Textarea
                      id="kubeconfig-dialog"
                      value={kubeconfig}
                      onChange={(e) => setKubeconfig(e.target.value)}
                      disabled={isKubeconfigInitialLoading}
                      className="flex-1 min-h-[300px] bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 font-mono text-sm disabled:opacity-50 resize-none overflow-y-auto rounded-md"
                      placeholder={
                        isKubeconfigInitialLoading
                          ? 'Loading...'
                          : 'Paste your kubeconfig content here...'
                      }
                    />
                    <p className="text-xs text-gray-500 shrink-0">
                      The system will validate your kubeconfig before saving.
                    </p>
                    <div className="flex gap-2 pt-2 shrink-0">
                      <Button
                        onClick={handleSaveKubeconfig}
                        disabled={
                          isKubeconfigLoading || isKubeconfigInitialLoading || !kubeconfig.trim()
                        }
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isKubeconfigLoading ? 'Validating & Saving...' : 'Validate & Save'}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* Anthropic Tab */}
              <TabsContent value="anthropic" className="mt-0">
                <div className="space-y-4 pb-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="anthropic-api-base-url-dialog"
                      className="text-white text-sm font-medium"
                    >
                      API Base URL
                    </Label>
                    <Input
                      id="anthropic-api-base-url-dialog"
                      type="url"
                      value={anthropicApiBaseUrl}
                      onChange={(e) => setAnthropicApiBaseUrl(e.target.value)}
                      disabled={isAnthropicInitialLoading}
                      className="bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 disabled:opacity-50 rounded-md"
                      placeholder="https://api.anthropic.com"
                    />
                    <p className="text-xs text-gray-500">
                      The base URL for Anthropic API (e.g., https://api.anthropic.com or your proxy
                      URL)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="anthropic-api-key-dialog"
                      className="text-white text-sm font-medium"
                    >
                      API Key
                    </Label>
                    <Input
                      id="anthropic-api-key-dialog"
                      type="password"
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                      disabled={isAnthropicInitialLoading}
                      className="bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 font-mono disabled:opacity-50 rounded-md"
                      placeholder="sk-ant-..."
                    />
                    <p className="text-xs text-gray-500">
                      Your Anthropic API key. This will be stored securely and injected as
                      ANTHROPIC_AUTH_TOKEN in sandboxes.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveAnthropicConfig}
                      disabled={
                        isAnthropicLoading ||
                        isAnthropicInitialLoading ||
                        !anthropicApiKey.trim() ||
                        !anthropicApiBaseUrl.trim()
                      }
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isAnthropicLoading ? 'Saving...' : 'Save Configuration'}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
