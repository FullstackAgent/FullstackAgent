/**
 * Authentication Configuration Page
 * Configure OAuth providers and NextAuth settings
 * VSCode Dark Modern style
 */

'use client';

import { ExternalLink, Key } from 'lucide-react';
import { Github } from 'lucide-react';
import { useParams } from 'next/navigation';

import { ConfigLayout } from '@/components/config/config-layout';
import { EnvVarSection } from '@/components/config/env-var-section';
import {
  useBatchUpdateEnvironmentVariables,
  useEnvironmentVariables,
} from '@/hooks/use-environment-variables';
import { useProject } from '@/hooks/use-project';

/**
 * Generate a secure random secret
 */
function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

function AuthPageContent() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: envData, isLoading: envLoading } = useEnvironmentVariables(projectId);
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const batchUpdate = useBatchUpdateEnvironmentVariables(projectId);

  const authVars = envData?.auth || [];

  const handleSave = async (
    variables: Array<{ key: string; value: string; isSecret?: boolean }>
  ) => {
    await batchUpdate.mutateAsync({
      category: 'auth',
      variables,
    });
  };

  // GitHub OAuth templates
  const githubTemplates = [
    {
      key: 'GITHUB_CLIENT_ID',
      label: 'Client ID',
      placeholder: 'Enter your GitHub OAuth App Client ID',
      isSecret: false,
      description: 'Get this from GitHub Developer Settings → OAuth Apps',
    },
    {
      key: 'GITHUB_CLIENT_SECRET',
      label: 'Client Secret',
      placeholder: 'Enter your GitHub OAuth App Client Secret',
      isSecret: true,
      description: 'Keep this secret! Get it from your GitHub OAuth App settings',
    },
  ];

  // NextAuth templates
  const nextAuthTemplates = [
    {
      key: 'NEXTAUTH_URL',
      label: 'Application URL',
      placeholder: 'https://your-app.example.com',
      isSecret: false,
      description: 'The public URL of your application',
    },
    {
      key: 'NEXTAUTH_SECRET',
      label: 'NextAuth Secret',
      placeholder: 'Click Generate to create a secure secret',
      isSecret: true,
      description: 'A random string used to hash tokens and sign cookies (min 32 characters)',
      generateValue: generateSecret,
    },
  ];

  return (
    <ConfigLayout
      title="Authentication Configuration"
      description="Configure OAuth providers and authentication settings"
      loading={envLoading || projectLoading}
    >
      <div className="space-y-8">
        {/* GitHub OAuth Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Github className="h-5 w-5 text-[#3794ff]" />
              <h2 className="text-base font-medium text-[#cccccc]">GitHub OAuth</h2>
            </div>
            <a
              href="https://github.com/settings/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#3794ff] hover:text-[#4fc1ff] flex items-center gap-1.5 transition-colors"
            >
              GitHub Developer Settings
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <EnvVarSection
            title=""
            variables={authVars}
            templates={githubTemplates}
            sandboxes={project?.sandboxes || []}
            onSave={handleSave}
            saving={batchUpdate.isPending}
          />

          {/* Setup Instructions */}
          <div className="mt-4 p-4 bg-[#252526] border border-[#3e3e42] rounded">
            <h3 className="text-xs font-medium text-[#cccccc] mb-2">Setup Instructions</h3>
            <ol className="text-xs text-[#858585] space-y-1 list-decimal list-inside">
              <li>Go to GitHub Settings → Developer settings → OAuth Apps</li>
              <li>Click &quot;New OAuth App&quot; or select an existing app</li>
              <li>Set the Homepage URL and Authorization callback URL</li>
              <li>Copy the Client ID and Client Secret to the fields above</li>
              <li>Save your changes</li>
            </ol>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[#3e3e42]" />

        {/* NextAuth Configuration Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-5 w-5 text-[#3794ff]" />
            <h2 className="text-base font-medium text-[#cccccc]">NextAuth Configuration</h2>
          </div>

          <EnvVarSection
            title=""
            variables={authVars}
            templates={nextAuthTemplates}
            sandboxes={project?.sandboxes || []}
            onSave={handleSave}
            saving={batchUpdate.isPending}
          />

          {/* Important Notes */}
          <div className="mt-4 p-4 bg-[#252526] border border-[#3e3e42] rounded">
            <h3 className="text-xs font-medium text-[#cccccc] mb-2">Important Notes</h3>
            <ul className="text-xs text-[#858585] space-y-1 list-disc list-inside">
              <li>The NextAuth URL must match your application URL exactly</li>
              <li>The secret should be at least 32 characters long</li>
              <li>Never commit your NEXTAUTH_SECRET to version control</li>
              <li>Use a strong, unique secret for production</li>
            </ul>
          </div>
        </div>
      </div>
    </ConfigLayout>
  );
}

export default AuthPageContent;
