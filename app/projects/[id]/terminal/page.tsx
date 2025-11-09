/**
 * Terminal Page
 *
 * Displays terminal interface for project sandbox
 * Uses React Query for automatic state synchronization
 */

'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

import { TerminalContainer } from '@/components/terminal/terminal-container';
import { Spinner } from '@/components/ui/spinner';
import { useProject } from '@/hooks/use-project';

export default function TerminalPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Fetch project with automatic polling (every 3 seconds)
  const { data: project, isLoading, error } = useProject(projectId);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <div className="flex items-center gap-3">
          <Spinner className="h-5 w-5 text-[#3794ff]" />
          <span className="text-sm text-[#cccccc]">Loading project...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-[#f48771]" />
          <span className="text-sm text-[#cccccc]">
            {error ? 'Failed to load project' : 'Project not found'}
          </span>
        </div>
      </div>
    );
  }

  const sandbox = project.sandboxes[0];

  return (
    <div className="flex flex-col h-full">
      <TerminalContainer project={project} sandbox={sandbox} />
    </div>
  );
}