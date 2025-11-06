import { Github as GithubIcon, Link2 } from 'lucide-react';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

import { GitHubRepositorySelector } from '@/components/github-repository-selector';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function GitHubRepositoryPage({
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
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <GithubIcon className="h-5 w-5 text-blue-600 dark:text-blue-500" />
            GitHub Repository
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Connect and manage your GitHub repository</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Connection Status */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Repository Connection
            </h2>

            <GitHubRepositorySelector projectId={id} currentRepo={project.githubRepo} />
          </div>

          {/* GitHub Integration Features */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
              <GithubIcon className="h-5 w-5" />
              GitHub Features
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-600 dark:bg-green-500 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-sm text-foreground">Version Control</p>
                  <p className="text-xs text-muted-foreground">Track changes and collaborate with Git</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-600 dark:bg-green-500 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-sm text-foreground">Automatic Commits</p>
                  <p className="text-xs text-muted-foreground">
                    AI commits changes with descriptive messages
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-600 dark:bg-green-500 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-sm text-foreground">Pull Request Integration</p>
                  <p className="text-xs text-muted-foreground">Create and manage pull requests</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-muted rounded-full mt-1.5"></div>
                <div>
                  <p className="text-sm text-muted-foreground">GitHub Actions (Coming Soon)</p>
                  <p className="text-xs text-muted-foreground">Automated CI/CD workflows</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
