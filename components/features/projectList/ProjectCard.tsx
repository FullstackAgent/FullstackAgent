import { memo } from 'react';
import { Project } from '@prisma/client';
import { Clock } from 'lucide-react';
import Link from 'next/link';

import { getStatusBgClasses } from '@/lib/util/status-colors';
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
            <h3 className="text-sm font-medium text-foreground truncate">{project.name}</h3>
          </div>
          <div
            className={cn(
              'h-2 w-2 rounded-full shrink-0 ml-2 mt-1',
              getStatusBgClasses(project.status)
            )}
          />
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-10">
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
