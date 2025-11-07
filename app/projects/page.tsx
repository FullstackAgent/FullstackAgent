'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import NoProject from '@/components/features/projectList/NoProject';
import PageHeader from '@/components/features/projectList/PageHeader';
import ProjectCard from '@/components/features/projectList/ProjectCard';
import { GET } from '@/lib/fetch-client';
import { Project } from '@/types/project';

// TODO: convert this page to ssr, add loading and error status, add a ProjectGrid UI, and handle data fetching there

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch projects list with AbortController support
  const fetchProjects = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await GET<Project[]>('/api/projects', { signal });
      setProjects(data);
    } catch (error) {
      // Ignore AbortError (component was unmounted)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and polling with proper cleanup
  useEffect(() => {
    const abortController = new AbortController();

    // Initial fetch
    fetchProjects(abortController.signal);

    // Set up polling
    const interval = setInterval(() => {
      fetchProjects(abortController.signal);
    }, 3000);

    // Cleanup function
    return () => {
      abortController.abort(); // Cancel all ongoing requests
      clearInterval(interval); // Clear polling interval
    };
  }, [fetchProjects]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          <p className="text-xs text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar */}
      <PageHeader projectsCount={projects.length} />

      {/* Content */}
      <div className="p-6">
        {projects.length === 0 ? (
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
