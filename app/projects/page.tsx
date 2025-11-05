'use client';

import { useEffect, useState } from 'react';
import { Clock, Folder, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';

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
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
          <p className="text-xs text-gray-500">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e1e1e]">
      {/* Header Bar */}
      <div className="h-12 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Folder className="h-4 w-4 text-gray-400" />
          <h1 className="text-sm font-medium text-white">Projects</h1>
          <span className="text-xs text-gray-500">({projects.length})</span>
        </div>
        <Link href="/projects/new">
          <Button
            size="sm"
            className="h-7 bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs px-3"
          >
            <Plus className="mr-1 h-3 w-3" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Content */}
      <div className="p-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Folder className="h-12 w-12 text-gray-600 mb-4" />
            <h2 className="text-sm font-medium text-gray-300 mb-1">No projects yet</h2>
            <p className="text-xs text-gray-500 mb-4">
              Create your first project to get started
            </p>
            <Link href="/projects/new">
              <Button
                size="sm"
                className="h-7 bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs px-3"
              >
                <Plus className="mr-1 h-3 w-3" />
                Create Project
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}/terminal`}>
                <div className="group bg-[#252526] border border-[#3e3e42] hover:border-[#007acc] rounded transition-all cursor-pointer p-3">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">
                        {project.name}
                      </h3>
                    </div>
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full shrink-0 ml-2 mt-1',
                        project.status === 'RUNNING' && 'bg-green-500',
                        project.status === 'STOPPED' && 'bg-gray-500',
                        project.status === 'STARTING' && 'bg-yellow-500 animate-pulse',
                        project.status === 'STOPPING' && 'bg-yellow-500 animate-pulse',
                        project.status === 'CREATING' && 'bg-blue-500 animate-pulse',
                        project.status === 'TERMINATING' && 'bg-red-500 animate-pulse',
                        project.status === 'ERROR' && 'bg-red-500',
                        project.status === 'PARTIAL' && 'bg-orange-500'
                      )}
                    />
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3 min-h-[2.5rem]">
                    {project.description || 'No description'}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#3e3e42]">
                    <span className="text-xs text-gray-500">{project.status}</span>
                    <div className="flex items-center gap-1 text-xs text-gray-600">
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
