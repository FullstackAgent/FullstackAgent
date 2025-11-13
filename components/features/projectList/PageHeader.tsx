/**
 * PageHeader Component
 *
 * Header bar for projects page with avatar and settings
 */

'use client';

import { memo, useState } from 'react';
import { Folder, Plus } from 'lucide-react';
import { useSession } from 'next-auth/react';

import CreateProjectDialog from '@/components/dialog/create-project-dialog';
import SettingsDialog from '@/components/dialog/settings-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  projectsCount: number;
  className?: string;
}

const PageHeader = memo(({ projectsCount, className }: PageHeaderProps) => {
  const { data: session } = useSession();
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!session?.user?.name) return 'U';
    const names = session.user.name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return session.user.name[0].toUpperCase();
  };

  return (
    <>
      <div
        className={`h-14 bg-card border-b border-border flex items-center justify-between px-4 ${className || ''}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            <h1 className="text-base font-mono font-bold text-foreground uppercase">Projects</h1>
          </div>

          <span className="text-xs text-foreground bg-[#4D4D4D] rounded-full px-2 py-0.5">
            {projectsCount}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* New Project Button */}
          <Button
            size="sm"
            onClick={() => setShowCreateProject(true)}
            className="h-7 bg-primary hover:bg-primary-hover text-primary-foreground text-xs px-3"
          >
            <Plus className="mr-1 h-3 w-3" />
            New Project
          </Button>

          {/* User Avatar */}
          <button
            onClick={() => setShowSettings(true)}
            className="relative rounded-full hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-all"
            title="Settings"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={undefined} alt={session?.user?.name || 'User'} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>

      {/* Create Project Dialog */}
      <CreateProjectDialog open={showCreateProject} onOpenChange={setShowCreateProject} />

      {/* Settings Dialog */}
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
});

PageHeader.displayName = 'PageHeader';

export default PageHeader;
