/**
 * ProjectCard Component
 *
 * Displays a single project card with status, metadata, and action menu
 */

import { memo } from 'react';
import type { Prisma } from '@prisma/client';
import { Clock } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getStatusBgClasses, getStatusTextColor } from '@/lib/util/status-colors';
import { cn } from '@/lib/utils';

import ProjectCardDropdown from './ProjectCardDropdown';

type ProjectWithResources = Prisma.ProjectGetPayload<{
  include: {
    sandboxes: true;
    databases: true;
    environments: true;
  };
}>;

interface ProjectCardProps {
  project: ProjectWithResources;
}

const ProjectCard = memo(({ project }: ProjectCardProps) => {
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="rounded-none py-4 gap-4 transition-all hover:border-primary cursor-pointer h-full">
        <CardHeader className="px-4 pb-3">
          <div className="flex flex-row items-center justify-between space-y-0 mb-1">
            <CardTitle className="line-clamp-1 flex-1 text-left">
              {project.name}
            </CardTitle>
            <ProjectCardDropdown project={project} />
          </div>
          
          <CardDescription className="line-clamp-2 min-h-8">
            {project.description || 'No description'}
          </CardDescription>
        </CardHeader>

        {/* Horizontal divider matching content width */}
        <div className="border-t border-border mx-4" />

        <CardFooter className="flex items-center justify-between px-4">
          <div className="flex items-center gap-x-2">
            <Badge
              className={cn(
                "h-2 w-2 p-0 border-0",
                getStatusBgClasses(project.status)
              )}
            />
            <span className={cn('text-xs', getStatusTextColor(project.status))}>
              {project.status}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {new Date(project.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
});

ProjectCard.displayName = 'ProjectCard';

export default ProjectCard;