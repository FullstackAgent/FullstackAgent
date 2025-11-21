import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

import { StatusBar } from '@/components/layout/status-bar';
import PrimarySidebar from '@/components/sidebars/primary-sidebar';
import ProjectSidebar from '@/components/sidebars/project-sidebar-new';
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


  return (
    <div className="h-screen flex flex-col text-foreground overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Primary Sidebar - VSCode style */}
        <PrimarySidebar currentProjectId={id} userId={session.user.id} />

        {/* Secondary Sidebar - Project Settings */}
        <ProjectSidebar
          project={project}
          sandboxes={project.sandboxes}
          envVars={project.environments}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
          {children}
        </div>
      </div>
      
      <StatusBar project={project} />
    </div>
  );
}
