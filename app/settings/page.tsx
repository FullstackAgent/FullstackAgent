import { Settings } from 'lucide-react';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

import SettingsClient from './settings-client';

export default async function SettingsPage() {
  const session = await auth();

  if (!session || !session.user?.id) {
    redirect('/login');
  }

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
    },
  });

  if (!user) {
    redirect('/login');
  }

  // Get projects count for account info
  const projectsCount = await prisma.project.count({
    where: { userId: user.id },
  });

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>
        <p className="text-sm text-gray-400">
          Configure your development environment and system preferences
        </p>
      </div>

      <SettingsClient user={user} projectsCount={projectsCount} />
    </div>
  );
}
