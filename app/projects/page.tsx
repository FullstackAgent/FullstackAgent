'use client';

import { useEffect, useState } from 'react';
import { Clock, Folder, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';

import NoProject from '@/components/features/projectList/NoProject';
import { Button } from '@/components/ui/button';
import { GET } from '@/lib/fetch-client';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updatedAt: string;
  githubRepo: string | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch projects list
  const fetchProjects = async () => {
    try {
      const data = await GET<Project[]>('/api/projects');
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchProjects();
  }, []);

  // Polling: refresh project status every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProjects();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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
      <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Folder className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-sm font-medium text-foreground">Projects</h1>
          <span className="text-xs text-muted-foreground">({projects.length})</span>
        </div>
        <Link href="/projects/new">
          <Button
            size="sm"
            className="h-7 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3"
          >
            <Plus className="mr-1 h-3 w-3" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Content */}
      <div className="p-6">
        {projects.length === 0 ? (
          <NoProject />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}/terminal`}>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
