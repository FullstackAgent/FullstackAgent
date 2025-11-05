'use client';

import { useEffect, useState } from 'react';
import { Code, Database, Globe, Key, Save, Shield, Terminal } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import * as fetchClient from '@/lib/fetch-client';
import { useSealos } from '@/provider/sealos';

interface SettingsClientProps {
  user: {
    id: string;
    name: string | null;
  };
  projectsCount: number;
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

export default function SettingsClient({ user, projectsCount }: SettingsClientProps) {
  // Sealos context
  const { isSealos } = useSealos();

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

  // Load system prompt
  useEffect(() => {
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

    loadSystemPrompt();
  }, []);

  // Load kubeconfig
  useEffect(() => {
    const loadKubeconfig = async () => {
      try {
        const data = await fetchClient.GET<{ kubeconfig: string; namespace?: string | null }>(
          '/api/user/config/kubeconfig'
        );
        setKubeconfig(data.kubeconfig);
        setKubeconfigNamespace(data.namespace || null);
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
          // No kubeconfig found, that's ok
          setKubeconfig('');
        } else {
          console.error('Failed to load kubeconfig:', error);
          toast.error('Failed to load kubeconfig');
        }
      } finally {
        setIsKubeconfigInitialLoading(false);
      }
    };

    loadKubeconfig();
  }, []);

  // Load Anthropic config
  useEffect(() => {
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

    loadAnthropicConfig();
  }, []);

  // Save system prompt
  const handleSaveSystemPrompt = async () => {
    setIsSystemPromptLoading(true);
    try {
      await fetchClient.POST('/api/user/config/system-prompt', {
        systemPrompt,
      });
      toast.success('System prompt saved successfully');
    } catch (error) {
      console.error('Failed to save system prompt:', error);
      toast.error('Failed to save system prompt');
    } finally {
      setIsSystemPromptLoading(false);
    }
  };

  // Save kubeconfig
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
      }>('/api/user/config/kubeconfig', {
        kubeconfig,
      });

      if (result.success) {
        setKubeconfigNamespace(result.namespace || null);
        toast.success(`Kubeconfig saved successfully (namespace: ${result.namespace})`);
      } else {
        toast.error(result.error || 'Failed to save kubeconfig');
      }
    } catch (error: unknown) {
      console.error('Failed to save kubeconfig:', error);
      const errorMessage =
        error && typeof error === 'object' && 'body' in error && error.body
          ? (error.body as { error?: string }).error || 'Failed to save kubeconfig'
          : 'Failed to save kubeconfig';
      toast.error(errorMessage);
    } finally {
      setIsKubeconfigLoading(false);
    }
  };

  // Save Anthropic config
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
    } catch (error: unknown) {
      console.error('Failed to save Anthropic config:', error);
      const errorMessage =
        error && typeof error === 'object' && 'body' in error && error.body
          ? (error.body as { error?: string }).error || 'Failed to save Anthropic configuration'
          : 'Failed to save Anthropic configuration';
      toast.error(errorMessage);
    } finally {
      setIsAnthropicLoading(false);
    }
  };

  // Reset system prompt to default
  const handleResetSystemPrompt = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    toast.success('Reset to default system prompt');
  };

  return (
    <Tabs defaultValue="system-prompt" className="w-full">
      <TabsList
        className={`grid w-full ${isSealos ? 'grid-cols-3' : 'grid-cols-4'} bg-[#252526] border-[#3e3e42]`}
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
        <TabsTrigger
          value="account"
          className="data-[state=active]:bg-[#0e639c] data-[state=active]:text-white text-gray-400 hover:text-white"
        >
          <Shield className="mr-2 h-4 w-4" />
          Account
        </TabsTrigger>
      </TabsList>

      {/* System Prompt Tab */}
      <TabsContent value="system-prompt" className="mt-6">
        <Card className="bg-[#252526] border-[#3e3e42]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Terminal className="h-5 w-5" />
              System Prompt Configuration
            </CardTitle>
            <CardDescription className="text-gray-400">
              Define the system instruction set for Claude Code. This helps the AI understand your
              project environment, programming languages, frameworks, and available environment
              variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="system-prompt" className="text-white text-sm font-medium">
                System Prompt Template
              </Label>
              <Textarea
                id="system-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                disabled={isSystemPromptInitialLoading}
                className="min-h-[400px] bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 font-mono text-sm disabled:opacity-50"
                placeholder={
                  isSystemPromptInitialLoading ? 'Loading...' : 'Enter your system prompt here...'
                }
              />
              <p className="text-xs text-gray-500">
                This prompt will be used as context for Claude Code to understand your project
                environment and coding preferences.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSaveSystemPrompt}
                disabled={isSystemPromptLoading || isSystemPromptInitialLoading}
                className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSystemPromptLoading ? 'Saving...' : 'Save System Prompt'}
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
          </CardContent>
        </Card>
      </TabsContent>

      {/* Kubeconfig Tab - Hidden in Sealos environment */}
      {!isSealos && (
        <TabsContent value="kubeconfig" className="mt-6">
          <Card className="bg-[#252526] border-[#3e3e42]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Database className="h-5 w-5" />
                Kubeconfig Configuration
              </CardTitle>
              <CardDescription className="text-gray-400">
                Configure your Kubernetes cluster settings. The system will validate your kubeconfig
                before saving.
                {kubeconfigNamespace && (
                  <span className="block mt-1 text-green-500">
                    Current namespace: {kubeconfigNamespace}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kubeconfig" className="text-white text-sm font-medium">
                  Kubeconfig Content
                </Label>
                <Textarea
                  id="kubeconfig"
                  value={kubeconfig}
                  onChange={(e) => setKubeconfig(e.target.value)}
                  disabled={isKubeconfigInitialLoading}
                  className="min-h-[300px] bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 font-mono text-sm disabled:opacity-50"
                  placeholder={
                    isKubeconfigInitialLoading
                      ? 'Loading...'
                      : 'Paste your kubeconfig content here...'
                  }
                />
                <p className="text-xs text-gray-500">
                  Your kubeconfig file contains cluster connection information and credentials. It
                  will be validated before saving.
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveKubeconfig}
                  disabled={isKubeconfigLoading || isKubeconfigInitialLoading || !kubeconfig.trim()}
                  className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isKubeconfigLoading ? 'Validating & Saving...' : 'Validate & Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {/* Anthropic Tab */}
      <TabsContent value="anthropic" className="mt-6">
        <Card className="bg-[#252526] border-[#3e3e42]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Terminal className="h-5 w-5" />
              Anthropic API Configuration
            </CardTitle>
            <CardDescription className="text-gray-400">
              Configure your Anthropic API settings for Claude Code CLI. These settings will be
              injected into your sandbox environments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="anthropic-api-base-url" className="text-white text-sm font-medium">
                API Base URL
              </Label>
              <Input
                id="anthropic-api-base-url"
                type="url"
                value={anthropicApiBaseUrl}
                onChange={(e) => setAnthropicApiBaseUrl(e.target.value)}
                disabled={isAnthropicInitialLoading}
                className="bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 disabled:opacity-50"
                placeholder="https://api.anthropic.com"
              />
              <p className="text-xs text-gray-500">
                The base URL for Anthropic API (e.g., https://api.anthropic.com or your proxy URL)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="anthropic-api-key" className="text-white text-sm font-medium">
                API Key
              </Label>
              <Input
                id="anthropic-api-key"
                type="password"
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                disabled={isAnthropicInitialLoading}
                className="bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 font-mono disabled:opacity-50"
                placeholder="sk-ant-..."
              />
              <p className="text-xs text-gray-500">
                Your Anthropic API key. This will be stored securely and injected as
                ANTHROPIC_AUTH_TOKEN in sandboxes.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSaveAnthropicConfig}
                disabled={
                  isAnthropicLoading ||
                  isAnthropicInitialLoading ||
                  !anthropicApiKey.trim() ||
                  !anthropicApiBaseUrl.trim()
                }
                className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
              >
                <Save className="mr-2 h-4 w-4" />
                {isAnthropicLoading ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Account Tab */}
      <TabsContent value="account" className="mt-6">
        <Card className="bg-[#252526] border-[#3e3e42]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription className="text-gray-400">
              View your account details and current status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded-lg border border-[#3e3e42]">
                <div>
                  <h3 className="text-white font-medium">User ID</h3>
                  <p className="text-sm text-gray-400 font-mono">{user.id}</p>
                </div>
                <Key className="h-5 w-5 text-gray-400" />
              </div>

              <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded-lg border border-[#3e3e42]">
                <div>
                  <h3 className="text-white font-medium">Username</h3>
                  <p className="text-sm text-gray-400">{user.name || 'Not set'}</p>
                </div>
                <Globe className="h-5 w-5 text-gray-400" />
              </div>

              <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded-lg border border-[#3e3e42]">
                <div>
                  <h3 className="text-white font-medium">Projects</h3>
                  <p className="text-sm text-gray-400">
                    {projectsCount} {projectsCount === 1 ? 'project' : 'projects'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-500">Active</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
