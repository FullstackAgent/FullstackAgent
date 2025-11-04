import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

import ProjectOperations from '@/components/project-operations';
import ProjectTerminalView from '@/components/project-terminal-view';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: id,
      userId: session.user.id,
    },
    include: {
      sandboxes: true,
      environments: true,
      databases: true,
    },
  });

  if (!project) {
    notFound();
  }

  const sandbox = project.sandboxes[0];

  return (
    <div className="flex flex-col h-full">
      {/* Project Operations Header */}
      <div className="h-12 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-white">{project.name}</h1>
          {project.description && (
            <span className="text-xs text-gray-400">{project.description}</span>
          )}
        </div>
        <ProjectOperations project={project} />
      </div>

      {/* Terminal View */}
      <div className="flex-1 min-h-0">
        <ProjectTerminalView sandbox={sandbox} />
      </div>
    </div>
  );
}
