import { Copy, Eye, Key, Lock, Plus, Shield, Trash2 } from 'lucide-react';
import { notFound } from 'next/navigation';

import { SystemSecretsList } from '@/components/secrets-list';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function SecretsConfigurationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: id,
      userId: session?.user.id,
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
      userId: session?.user.id,
      isSecret: true,
    },
    orderBy: {
      key: 'asc',
    },
  });

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
          <div className="bg-card rounded-lg border border-border shadow-sm">
            <div className="border-b border-border p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-medium text-foreground">Project Secrets</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-accent transition-colors w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Secret
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Project-specific secrets that can be edited and deleted
              </p>
            </div>

            <div className="p-6">
              {project.environments.length > 0 ? (
                <div className="space-y-3">
                  {project.environments.map((secret) => (
                    <div
                      key={secret.id}
                      className="flex items-center justify-between p-3 bg-accent rounded-lg border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Shield className="h-4 w-4 text-primary shrink-0" />
                          <code className="text-sm font-mono text-foreground">{secret.key}</code>
                        </div>
                        <div className="text-xs text-muted-foreground ml-6">
                          Last updated: {new Date(secret.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors sm:w-auto w-8 h-8"
                          title="View secret"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors sm:w-auto w-8 h-8"
                          title="Copy to clipboard"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors sm:w-auto w-8 h-8"
                          title="Delete secret"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                    <Key className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No secrets configured yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add your first secret to securely store sensitive data
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* User-level Secrets (e.g., ANTHROPIC_API_KEY) */}
          <SystemSecretsList systemSecrets={userConfigs} />

          {/* Security Best Practices */}
          <div className="bg-card rounded-lg border border-border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-medium text-foreground">Security Best Practices</h2>
            </div>

            <ul className="text-sm text-muted-foreground space-y-3">
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
          </div>
        </div>
      </div>
    </div>
  );
}
