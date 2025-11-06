import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

import ContentWrapper from '@/components/content-wrapper';
import PersistentTerminal from '@/components/persistent-terminal';
import ProjectSecondarySidebar from '@/components/project-secondary-sidebar';
import ProjectSidebar from '@/components/project-sidebar';
import { TerminalProvider } from '@/components/terminal-provider';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
      sandboxes: true,
      databases: true,
      environments: true,
    },
  });

  if (!project) {
    notFound();
  }

  // Get all user projects for sidebar
  const projects = await prisma.project.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <TerminalProvider>
      <div className="h-screen flex bg-background text-foreground overflow-hidden">
        {/* Primary Sidebar - VSCode style */}
        <ProjectSidebar projects={projects} currentProjectId={id} userId={session.user.id} />

        {/* Secondary Sidebar - Project Settings */}
        <ProjectSecondarySidebar
          project={project}
          sandboxes={project.sandboxes}
          envVars={project.environments}
        />

        {/* Main Content Area */}
        <ContentWrapper projectId={id}>
          <div className="flex-1 flex flex-col min-w-0 relative">
            {/* Regular Page Content */}
            {children}
          </div>
        </ContentWrapper>

        {/* Persistent Terminal (hidden by default) - separate from main content */}
        <PersistentTerminal projectId={id} />
      </div>
    </TerminalProvider>
  );
}
