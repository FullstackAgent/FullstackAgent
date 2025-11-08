'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Circle, FolderOpen, GitBranch, Home, Plus, Settings } from 'lucide-react';
import Link from 'next/link';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

export default function PrimarySidebar({
  currentProjectId,
}: PrimarySidebarProps) {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
      case 'DEPLOYED':
        return 'text-green-600 dark:text-green-500';
      case 'INITIALIZING':
      case 'DEPLOYING':
        return 'text-yellow-600 dark:text-yellow-500';
      case 'ERROR':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div
      className={cn(
        'bg-sidebar-background border-r border-sidebar-border flex flex-col transition-all duration-200',
        isExpanded ? 'w-52' : 'w-12'
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <TooltipProvider>
        {/* Header */}
        <div className="h-12 flex items-center justify-center border-b border-sidebar-border">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          {isExpanded && <span className="ml-2 text-sm font-medium text-foreground">Projects</span>}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 py-2 overflow-y-auto">
          {/* Home Link */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/projects"
                className="group flex items-center h-8 px-3 hover:bg-sidebar-accent transition-colors"
              >
                <Home className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-foreground shrink-0 transition-colors" />
                {isExpanded && (
                  <span className="ml-3 text-sm text-foreground truncate">All Projects</span>
                )}
              </Link>
            </TooltipTrigger>
            {!isExpanded && (
              <TooltipContent side="right">
                <p>All Projects</p>
              </TooltipContent>
            )}
          </Tooltip>

          {/* New Project */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/projects/new"
                className="group flex items-center h-8 px-3 hover:bg-sidebar-accent transition-colors mb-2"
              >
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-foreground shrink-0 transition-colors" />
                {isExpanded && (
                  <span className="ml-3 text-sm text-foreground truncate">New Project</span>
                )}
              </Link>
            </TooltipTrigger>
            {!isExpanded && (
              <TooltipContent side="right">
                <p>New Project</p>
              </TooltipContent>
            )}
          </Tooltip>

          <div className="border-t border-border my-2" />

          {/* Project List */}
          <div className="space-y-1">
            {projects?.map((project) => (
              <Tooltip key={project.id}>
                <TooltipTrigger asChild>
                  <Link
                    href={`/projects/${project.id}`}
                    className={cn(
                      'group flex items-center h-8 px-3 hover:bg-sidebar-accent transition-colors',
                      currentProjectId === project.id && 'bg-sidebar-accent'
                    )}
                  >
                    <div className="flex items-center shrink-0">
                      <Circle
                        className={cn('h-2 w-2 mr-2', getStatusColor(project.status))}
                        fill="currentColor"
                      />
                      <GitBranch className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-foreground transition-colors" />
                    </div>
                    {isExpanded && (
                      <span className="ml-3 text-sm text-foreground truncate">{project.name}</span>
                    )}
                  </Link>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right">
                    <p>{project.name}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className="group flex items-center h-8 px-2 hover:bg-sidebar-accent rounded transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-foreground flex-shrink-0 transition-colors" />
                {isExpanded && <span className="ml-3 text-sm text-foreground">Settings</span>}
              </Link>
            </TooltipTrigger>
            {!isExpanded && (
              <TooltipContent side="right">
                <p>Settings</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
