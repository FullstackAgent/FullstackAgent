/**
 * PageHeader Component
 *
 * Header bar for projects page with avatar and settings
 */

'use client';

import { memo, useState } from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import { useSession } from 'next-auth/react';

import CreateProjectDialog from '@/components/dialog/create-project-dialog';
import SettingsDialog from '@/components/dialog/settings-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
        className={`h-14 bg-card border-b border-border flex items-center justify-between px-8 ${className || ''}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-mono font-semibold text-foreground uppercase">Projects</h1>
          </div>

          <Badge variant="secondary" className="bg-accent px-2">
            {projectsCount}
          </Badge>
        </div>

        <div className="flex items-center space-x-3">
          {/* New Project Button */}
          <Button
            size="sm"
            onClick={() => setShowCreateProject(true)}
            className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs rounded-none h-8 px-3"
          >
            <Plus className="mr-1 h-4 w-4" />
            New Project
          </Button>

          {/* Vertical Divider */}
          <div className="h-6 w-px bg-border" />

          {/* User Avatar */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="relative rounded-full hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-all p-0 w-8 h-8"
            title="Settings"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
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
