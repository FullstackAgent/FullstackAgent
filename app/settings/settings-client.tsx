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

interface SettingsClientProps {
  user: any;
  projects: any[];
}

export default function SettingsClient({ user, projects }: SettingsClientProps) {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [kubeconfig, setKubeconfig] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const defaultSystemPrompt = `You are an AI full-stack developer working in a Next.js environment.

## Environment Information
- Framework: Next.js 15.5.4 with App Router
- Language: TypeScript
- Database: PostgreSQL with Prisma ORM
- UI Framework: Shadcn/UI with Tailwind CSS v4
- Authentication: NextAuth v5 with GitHub OAuth

## Available Environment Variables
The following environment variables are available for your use:
- DATABASE_URL: PostgreSQL connection string
- NEXTAUTH_URL: Authentication base URL
- NEXTAUTH_SECRET: Authentication secret
- GITHUB_CLIENT_ID: GitHub OAuth client ID
- GITHUB_CLIENT_SECRET: GitHub OAuth client secret
- ANTHROPIC_API_KEY: Claude Code API key

## Project Context
You are working on project: ${projects[0]?.name || 'Unknown'}
Description: ${projects[0]?.description || 'No description available'}

## Instructions
- Follow Next.js 15 App Router conventions
- Use TypeScript for type safety
- Implement proper error handling and loading states
- Follow responsive design principles with Tailwind CSS
- Use the provided environment variables for configuration
- Focus on creating production-ready, maintainable code

## Development Guidelines
- Write clean, readable code with proper documentation
- Implement proper error boundaries and validation
- Use semantic HTML and accessibility best practices
- Optimize for performance and SEO
- Follow modern React patterns and best practices`;

  // Load existing settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load system prompt
        const systemPromptResponse = await fetch('/api/settings/system-prompt');
        if (systemPromptResponse.ok) {
          const data = await systemPromptResponse.json();
          setSystemPrompt(data.systemPrompt || defaultSystemPrompt);
        } else {
          setSystemPrompt(defaultSystemPrompt);
        }

        // Load kubeconfig
        const kubeconfigResponse = await fetch('/api/settings/kubeconfig');
        if (kubeconfigResponse.ok) {
          const data = await kubeconfigResponse.json();
          setKubeconfig(data.kubeconfig || '');
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        setSystemPrompt(defaultSystemPrompt);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadSettings();
  }, [projects]);

  const handleSaveSystemPrompt = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/system-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ systemPrompt }),
      });

      if (response.ok) {
        toast.success('System prompt saved successfully');
      } else {
        throw new Error('Failed to save system prompt');
      }
    } catch (error) {
      toast.error('Failed to save system prompt');
      console.error('Error saving system prompt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveKubeconfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/kubeconfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kubeconfig }),
      });

      if (response.ok) {
        toast.success('Kubeconfig saved successfully');
      } else {
        throw new Error('Failed to save kubeconfig');
      }
    } catch (error) {
      toast.error('Failed to save kubeconfig');
      console.error('Error saving kubeconfig:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDefault = () => {
    setSystemPrompt(defaultSystemPrompt);
    toast.success('Reset to default system prompt');
  };

  const handleLoadDefaultKubeconfig = async () => {
    try {
      const response = await fetch('/api/settings/kubeconfig');
      if (response.ok) {
        const data = await response.json();
        if (data.isDefault) {
          setKubeconfig(data.kubeconfig);
          toast.success('Loaded default kubeconfig');
        } else {
          toast.info('No default kubeconfig available');
        }
      } else {
        toast.error('Failed to load default kubeconfig');
      }
    } catch (error) {
      toast.error('Failed to load default kubeconfig');
      console.error('Error loading default kubeconfig:', error);
    }
  };

  return (
    <Tabs defaultValue="system-prompt" className="w-full">
      <TabsList className="grid w-full grid-cols-3 bg-[#252526] border-[#3e3e42]">
        <TabsTrigger
          value="system-prompt"
          className="data-[state=active]:bg-[#0e639c] data-[state=active]:text-white text-gray-400 hover:text-white"
        >
          <Code className="mr-2 h-4 w-4" />
          System Prompt
        </TabsTrigger>
        <TabsTrigger
          value="kubeconfig"
          className="data-[state=active]:bg-[#0e639c] data-[state=active]:text-white text-gray-400 hover:text-white"
        >
          <Database className="mr-2 h-4 w-4" />
          Kubeconfig
        </TabsTrigger>
        <TabsTrigger
          value="account"
          className="data-[state=active]:bg-[#0e639c] data-[state=active]:text-white text-gray-400 hover:text-white"
        >
          <Shield className="mr-2 h-4 w-4" />
          Account
        </TabsTrigger>
      </TabsList>

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
                disabled={isInitialLoading}
                className="min-h-[400px] bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 font-mono text-sm disabled:opacity-50"
                placeholder={isInitialLoading ? 'Loading...' : 'Enter your system prompt here...'}
              />
              <p className="text-xs text-gray-500">
                This prompt will be used as context for Claude Code to understand your project
                environment and coding preferences.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSaveSystemPrompt}
                disabled={isLoading}
                className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
              >
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? 'Saving...' : 'Save System Prompt'}
              </Button>
              <Button
                variant="outline"
                onClick={handleResetToDefault}
                className="border-[#3e3e42] text-gray-400 hover:text-white hover:bg-[#3e3e42]"
              >
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="kubeconfig" className="mt-6">
        <Card className="bg-[#252526] border-[#3e3e42]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Database className="h-5 w-5" />
              Kubeconfig Configuration
            </CardTitle>
            <CardDescription className="text-gray-400">
              Configure your Kubernetes cluster settings. The system automatically fetches Sealos
              kubeconfig settings, but you can customize them here if needed.
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
                className="min-h-[300px] bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 font-mono text-sm"
                placeholder="Paste your kubeconfig content here..."
              />
              <p className="text-xs text-gray-500">
                Your kubeconfig file contains cluster connection information and credentials. Leave
                empty to use the default Sealos configuration.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSaveKubeconfig}
                disabled={isLoading}
                className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
              >
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? 'Saving...' : 'Save Kubeconfig'}
              </Button>
              <Button
                variant="outline"
                onClick={handleLoadDefaultKubeconfig}
                className="border-[#3e3e42] text-gray-400 hover:text-white hover:bg-[#3e3e42]"
              >
                Load Default
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="account" className="mt-6">
        <Card className="bg-[#252526] border-[#3e3e42]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5" />
              Account Settings
            </CardTitle>
            <CardDescription className="text-gray-400">
              Manage your account preferences and security settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded-lg border border-[#3e3e42]">
                <div>
                  <h3 className="text-white font-medium">GitHub Integration</h3>
                  <p className="text-sm text-gray-400">Connected as {user.name || user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-500">Connected</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded-lg border border-[#3e3e42]">
                <div>
                  <h3 className="text-white font-medium">Authentication Method</h3>
                  <p className="text-sm text-gray-400">Sign in with GitHub OAuth</p>
                </div>
                <Key className="h-5 w-5 text-gray-400" />
              </div>

              <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded-lg border border-[#3e3e42]">
                <div>
                  <h3 className="text-white font-medium">Account Status</h3>
                  <p className="text-sm text-gray-400">Active with {projects.length} projects</p>
                </div>
                <Globe className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
