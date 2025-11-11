'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Circle, FolderOpen, GitBranch, Home, Plus, Settings } from 'lucide-react';
import Link from 'next/link';

import CreateProjectDialog from '@/components/dialog/create-project-dialog';
import SettingsDialog from '@/components/dialog/settings-dialog';
import { getStatusTextClasses } from '@/lib/util/status-colors';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}

interface PrimarySidebarProps {
  currentProjectId: string;
  userId: string;
}

export default function PrimarySidebar({ currentProjectId }: PrimarySidebarProps) {
  // Fetch projects list with TanStack Query, polling every 5 seconds
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      return response.json();
    },
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 4000, // Data is fresh for 4 seconds
    retry: 2,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  return (
    <div
      className={cn(
        'bg-sidebar-background border-r border-sidebar-border flex flex-col transition-all duration-200',
        isExpanded ? 'w-52' : 'w-12'
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-center border-b border-sidebar-border">
        <FolderOpen className="h-5 w-5 text-muted-foreground" />
        {isExpanded && <span className="ml-2 text-sm font-medium text-foreground">Projects</span>}
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-2 overflow-y-auto">
        {/* Home Link */}
        <Link
          href="/projects"
          className="group flex items-center h-8 px-3 hover:bg-sidebar-accent transition-colors"
        >
          <Home className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-foreground shrink-0 transition-colors" />
          {isExpanded && (
            <span className="ml-3 text-sm text-foreground truncate">All Projects</span>
          )}
        </Link>

        {/* New Project */}
        <button
          onClick={() => setShowCreateProject(true)}
          className="group flex items-center h-8 px-3 hover:bg-sidebar-accent transition-colors mb-2 w-full"
        >
          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-foreground shrink-0 transition-colors" />
          {isExpanded && <span className="ml-3 text-sm text-foreground truncate">New Project</span>}
        </button>

        <div className="border-t border-border my-2" />

        {/* Project List */}
        <div className="space-y-1">
          {projects?.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={cn(
                'group flex items-center h-8 px-3 hover:bg-sidebar-accent transition-colors',
                currentProjectId === project.id && 'bg-sidebar-accent'
              )}
            >
              <div className="flex items-center shrink-0">
                <Circle
                  className={cn('h-2 w-2 mr-2', getStatusTextClasses(project.status))}
                  fill="currentColor"
                />
                <GitBranch className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-foreground transition-colors" />
              </div>
              {isExpanded && (
                <span className="ml-3 text-sm text-foreground truncate">{project.name}</span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="p-2">
        <button
          onClick={() => setShowSettings(true)}
          className="group flex items-center h-8 px-2 hover:bg-sidebar-accent rounded transition-colors w-full"
        >
          <Settings className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-foreground shrink-0 transition-colors" />
          {isExpanded && <span className="ml-3 text-sm text-foreground">Settings</span>}
        </button>
      </div>

      {/* Create Project Dialog */}
      <CreateProjectDialog open={showCreateProject} onOpenChange={setShowCreateProject} />

      {/* Settings Dialog */}
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
