import { Copy, Eye, Key, Lock, Plus, Shield, Trash2 } from 'lucide-react';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

import { SystemSecretsList } from '@/components/secrets-list';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function SecretsConfigurationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: id,
      userId: session.user.id,
    },
    include: {
      environments: {
        where: {
          isSecret: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  // Get user-level configuration (like ANTHROPIC_API_KEY)
  const userConfigs = await prisma.userConfig.findMany({
    where: {
      userId: session.user.id,
      isSecret: true,
    },
    orderBy: {
      key: 'asc',
    },
  });

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-600 dark:text-blue-500" />
            Secret Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage sensitive environment variables and API keys
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Project Secrets */}
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
                  <Lock className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                  Project Secrets
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Project-specific secrets (can be edited)
                </p>
              </div>
              <button className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded flex items-center gap-1.5 transition-colors">
                <Plus className="h-4 w-4" />
                Add Secret
              </button>
            </div>

            {project.environments.length > 0 ? (
              <div className="space-y-3">
                {project.environments.map((secret) => (
                  <div
                    key={secret.id}
                    className="flex items-center justify-between p-3 bg-accent rounded border border-border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                        <code className="text-sm font-mono text-foreground">{secret.key}</code>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Last updated: {new Date(secret.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No secrets configured yet</p>
                <p className="text-xs mt-1">Add secrets to securely store sensitive data</p>
              </div>
            )}
          </div>

          {/* User-level Secrets (e.g., ANTHROPIC_API_KEY) */}
          <SystemSecretsList systemSecrets={userConfigs} />

          {/* Security Best Practices */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Best Practices
            </h2>

            <ul className="text-sm text-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5">✓</span>
                <span>Never commit secrets to version control</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5">✓</span>
                <span>Use environment-specific secrets for different stages</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5">✓</span>
                <span>Rotate secrets regularly to maintain security</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5">✓</span>
                <span>Limit access to secrets on a need-to-know basis</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5">✓</span>
                <span>Use strong, randomly generated values for API keys</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
