import { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import ProjectSidebar from '@/components/project-sidebar';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function SettingsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await auth();

  if (!session || !session.user?.id) {
    redirect('/login');
  }

  // Get user's projects for sidebar
  const projects = await prisma.project.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="h-screen flex bg-[#1e1e1e] text-white overflow-hidden">
      {/* Primary Sidebar - VSCode style */}
      <ProjectSidebar
        projects={projects}
        currentProjectId="" // No current project in settings
        userId={session.user.id}
      />

      {/* Main Content Area with Settings */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">{children}</div>
    </div>
  );
}
