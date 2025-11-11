import { memo } from 'react';
import { Project } from '@prisma/client';
import { Clock } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
}

const ProjectCard = memo(({ project }: ProjectCardProps) => {
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="group bg-card border border-border hover:border-primary rounded-lg transition-all cursor-pointer p-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate">
              {project.name}
            </h3>
          </div>
          <div
            className={cn(
              'h-2 w-2 rounded-full shrink-0 ml-2 mt-1',
              project.status === 'RUNNING' && 'bg-green-600 dark:bg-green-500',
              project.status === 'STOPPED' && 'bg-muted-foreground',
              project.status === 'STARTING' && 'bg-yellow-600 dark:bg-yellow-500 animate-pulse',
              project.status === 'STOPPING' && 'bg-yellow-600 dark:bg-yellow-500 animate-pulse',
              project.status === 'CREATING' && 'bg-blue-600 dark:bg-blue-500 animate-pulse',
              project.status === 'UPDATING' && 'bg-cyan-600 dark:bg-cyan-500 animate-pulse',
              project.status === 'TERMINATING' && 'bg-red-600 dark:bg-red-500 animate-pulse',
              project.status === 'ERROR' && 'bg-destructive',
              project.status === 'PARTIAL' && 'bg-orange-600 dark:bg-orange-500'
            )}
          />
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2.5rem]">
          {project.description || 'No description'}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">{project.status}</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {new Date(project.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
});

ProjectCard.displayName = 'ProjectCard';

export default ProjectCard;