/**
 * Projects Page
 *
 * Displays list of user projects with automatic polling
 * Uses React Query for state management
 */

'use client';

import NoProject from '@/components/features/projectList/NoProject';
import PageHeader from '@/components/features/projectList/PageHeader';
import ProjectCard from '@/components/features/projectList/ProjectCard';
import { Spinner } from '@/components/ui/spinner';
import { useProjects } from '@/hooks/use-projects';

export default function ProjectsPage() {
  // Fetch projects with automatic polling (every 3 seconds)
  const { data: projects, isLoading } = useProjects();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Spinner className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">Loading projects...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar */}
      <PageHeader projectsCount={projects?.length || 0} />

      {/* Content */}
      <div className="p-6">
        {!projects || projects.length === 0 ? (
          <NoProject />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}