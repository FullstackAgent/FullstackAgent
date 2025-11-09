import { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import PrimarySidebar from '@/components/sidebars/primary-sidebar';
import { auth } from '@/lib/auth';

export default async function SettingsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await auth();

  if (!session || !session.user?.id) {
    redirect('/login');
  }

  return (
    <div className="h-screen flex bg-[#1e1e1e] text-white overflow-hidden">
      {/* Primary Sidebar - VSCode style */}
      <PrimarySidebar
        currentProjectId="" // No current project in settings
        userId={session.user.id}
      />

      {/* Main Content Area with Settings */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">{children}</div>
    </div>
  );
}
