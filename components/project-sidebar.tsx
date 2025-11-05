'use client';

import { useState } from 'react';
import { Project } from '@prisma/client';
import { Circle, FolderOpen, GitBranch, Home, Plus, Settings } from 'lucide-react';
import Link from 'next/link';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ProjectSidebarProps {
  projects: Project[];
  currentProjectId: string;
  userId: string;
}

export default function ProjectSidebar({
  projects,
  currentProjectId,
}: ProjectSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
      case 'DEPLOYED':
        return 'text-green-500';
      case 'INITIALIZING':
      case 'DEPLOYING':
        return 'text-yellow-500';
      case 'ERROR':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div
      className={cn(
        'bg-[#252526] border-r border-[#3e3e42] flex flex-col transition-all duration-200',
        isExpanded ? 'w-52' : 'w-12'
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <TooltipProvider>
        {/* Header */}
        <div className="h-12 flex items-center justify-center border-b border-[#3e3e42]">
          <FolderOpen className="h-5 w-5 text-gray-400" />
          {isExpanded && <span className="ml-2 text-sm font-medium">Projects</span>}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 py-2 overflow-y-auto">
          {/* Home Link */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/projects"
                className="flex items-center h-8 px-3 hover:bg-[#2a2d2e] transition-colors"
              >
                <Home className="h-4 w-4 text-gray-400 shrink-0" />
                {isExpanded && (
                  <span className="ml-3 text-sm text-gray-300 truncate">All Projects</span>
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
                className="flex items-center h-8 px-3 hover:bg-[#2a2d2e] transition-colors mb-2"
              >
                <Plus className="h-4 w-4 text-gray-400 shrink-0" />
                {isExpanded && (
                  <span className="ml-3 text-sm text-gray-300 truncate">New Project</span>
                )}
              </Link>
            </TooltipTrigger>
            {!isExpanded && (
              <TooltipContent side="right">
                <p>New Project</p>
              </TooltipContent>
            )}
          </Tooltip>

          <div className="border-t border-[#3e3e42] my-2" />

          {/* Project List */}
          <div className="space-y-1">
            {projects.map((project) => (
              <Tooltip key={project.id}>
                <TooltipTrigger asChild>
                  <Link
                    href={`/projects/${project.id}`}
                    className={cn(
                      'flex items-center h-8 px-3 hover:bg-[#2a2d2e] transition-colors',
                      currentProjectId === project.id && 'bg-[#37373d]'
                    )}
                  >
                    <div className="flex items-center shrink-0">
                      <Circle
                        className={cn('h-2 w-2 mr-2', getStatusColor(project.status))}
                        fill="currentColor"
                      />
                      <GitBranch className="h-4 w-4 text-gray-400" />
                    </div>
                    {isExpanded && (
                      <span className="ml-3 text-sm text-gray-300 truncate">{project.name}</span>
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
        <div className="border-t border-[#3e3e42] p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className="flex items-center h-8 px-2 hover:bg-[#2a2d2e] rounded transition-colors"
              >
                <Settings className="h-4 w-4 text-gray-400 flex-shrink-0" />
                {isExpanded && <span className="ml-3 text-sm text-gray-300">Settings</span>}
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
