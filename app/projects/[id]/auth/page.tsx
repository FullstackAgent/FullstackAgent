import { notFound } from 'next/navigation';

import AuthConfiguration from '@/components/auth-configuration';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function AuthConfigurationPage({
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
      sandboxes: true,
      environments: true,
    },
  });

  if (!project) {
    notFound();
  }

  const sandbox = project.sandboxes[0];
  // Get the main application URL (port 3000)
  const projectUrl = sandbox?.publicUrl || `https://sandbox-${id}.dgkwlntjskms.usw.sealos.io`;

  return (
    <AuthConfiguration
      project={project}
      projectUrl={projectUrl}
      environmentVariables={project.environments}
    />
  );
}
