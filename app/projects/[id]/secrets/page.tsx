import { Check, Copy, Eye, EyeOff, Key, Lock, Plus, Shield, Trash2 } from 'lucide-react';
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
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Header */}
      <div className="border-b border-[#3e3e42] bg-[#252526]">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-400" />
            Secret Configuration
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage sensitive environment variables and API keys
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Project Secrets */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium text-white flex items-center gap-2">
                  <Lock className="h-5 w-5 text-yellow-400" />
                  Project Secrets
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Project-specific secrets (can be edited)
                </p>
              </div>
              <button className="px-3 py-1.5 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded flex items-center gap-1.5 transition-colors">
                <Plus className="h-4 w-4" />
                Add Secret
              </button>
            </div>

            {project.environments.length > 0 ? (
              <div className="space-y-3">
                {project.environments.map((secret) => (
                  <div
                    key={secret.id}
                    className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-yellow-400" />
                        <code className="text-sm font-mono text-gray-300">{secret.key}</code>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Last updated: {new Date(secret.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-red-400 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No secrets configured yet</p>
                <p className="text-xs mt-1">Add secrets to securely store sensitive data</p>
              </div>
            )}
          </div>

          {/* User-level Secrets (e.g., ANTHROPIC_API_KEY) */}
          <SystemSecretsList systemSecrets={userConfigs} />

          {/* Security Best Practices */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Best Practices
            </h2>

            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Never commit secrets to version control</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Use environment-specific secrets for different stages</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Rotate secrets regularly to maintain security</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Limit access to secrets on a need-to-know basis</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Use strong, randomly generated values for API keys</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
