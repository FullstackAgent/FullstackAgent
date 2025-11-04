'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';

import ProjectOperations from '@/components/project-operations';
import ProjectTerminalView from '@/components/project-terminal-view';
import { GET } from '@/lib/fetch-client';

interface Sandbox {
  id: string;
  name: string;
  status: string;
  publicUrl: string | null;
  ttydUrl: string | null;
  sandboxName: string;
}

interface Database {
  id: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sandboxes: Sandbox[];
  databases: Database[];
}

export default function TerminalPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch project data
  const fetchProject = async () => {
    try {
      const data = await GET<Project>(`/api/projects/${projectId}`);
      setProject(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchProject();
  }, [projectId]);

  // Polling: refresh every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProject();
    }, 3000);

    return () => clearInterval(interval);
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-12 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-400">Loading project...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-12 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-center">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="ml-2 text-sm text-red-400">{error || 'Project not found'}</span>
        </div>
      </div>
    );
  }

  const sandbox = project.sandboxes[0];

  return (
    <div className="flex flex-col h-full">
      {/* Project Operations Header */}
      <div className="h-12 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-white">{project.name}</h1>
          {project.description && (
            <span className="text-xs text-gray-400">{project.description}</span>
          )}
        </div>
        <ProjectOperations project={project} />
      </div>

      {/* Conditional Terminal View based on Project Status (aggregated) */}
      <div className="flex-1 min-h-0">
        {project.status === 'RUNNING' ? (
          <ProjectTerminalView sandbox={sandbox} />
        ) : (
          <StatusTransitionView status={project.status} />
        )}
      </div>
    </div>
  );
}

interface StatusTransitionViewProps {
  status: string;
}

function StatusTransitionView({ status }: StatusTransitionViewProps) {
  switch (status) {
    case 'NO_SANDBOX':
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-white">
          <AlertCircle className="h-12 w-12 text-gray-500 mb-3" />
          <h2 className="text-lg font-medium text-gray-300 mb-1">No sandbox found</h2>
          <p className="text-sm text-gray-400">Sandbox is being created. Please wait...</p>
        </div>
      );

    case 'CREATING':
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-white">
          <div className="relative">
            <Loader2 className="h-12 w-12 text-yellow-500 animate-spin" />
            <div className="absolute inset-0 h-12 w-12 border-4 border-yellow-500/20 rounded-full animate-ping" />
          </div>
          <h2 className="text-lg font-medium text-yellow-500 mt-6 mb-1">Creating Sandbox</h2>
          <p className="text-sm text-gray-400">Setting up your development environment...</p>
        </div>
      );

    case 'STARTING':
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-white">
          <div className="relative">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            <div className="absolute inset-0 h-12 w-12 border-4 border-blue-500/20 rounded-full animate-ping" />
          </div>
          <h2 className="text-lg font-medium text-blue-500 mt-6 mb-1">Starting Sandbox</h2>
          <p className="text-sm text-gray-400">Booting up containers and services...</p>
        </div>
      );

    case 'STOPPED':
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-white">
          <div className="h-12 w-12 rounded-full bg-gray-500/20 flex items-center justify-center mb-6">
            <div className="h-6 w-6 rounded-full bg-gray-500" />
          </div>
          <h2 className="text-lg font-medium text-gray-300 mb-1">Sandbox Stopped</h2>
          <p className="text-sm text-gray-400">
            Click the Start button above to resume your sandbox
          </p>
        </div>
      );

    case 'STOPPING':
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-white">
          <div className="relative">
            <Loader2 className="h-12 w-12 text-orange-500 animate-spin" />
            <div className="absolute inset-0 h-12 w-12 border-4 border-orange-500/20 rounded-full animate-ping" />
          </div>
          <h2 className="text-lg font-medium text-orange-500 mt-6 mb-1">Stopping Sandbox</h2>
          <p className="text-sm text-gray-400">Shutting down containers gracefully...</p>
        </div>
      );

    case 'TERMINATING':
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-white">
          <div className="relative">
            <Loader2 className="h-12 w-12 text-red-400 animate-spin" />
            <div className="absolute inset-0 h-12 w-12 border-4 border-red-400/20 rounded-full animate-ping" />
          </div>
          <h2 className="text-lg font-medium text-red-400 mt-6 mb-1">Terminating Sandbox</h2>
          <p className="text-sm text-gray-400">Removing all resources...</p>
        </div>
      );

    case 'ERROR':
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-white">
          <AlertCircle className="h-12 w-12 text-red-500 mb-6" />
          <h2 className="text-lg font-medium text-red-500 mb-1">Sandbox Error</h2>
          <p className="text-sm text-gray-400 mb-4">An error occurred with your sandbox</p>
          <p className="text-xs text-gray-500">
            Try restarting or contact support if the issue persists
          </p>
        </div>
      );

    default:
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-white">
          <Loader2 className="h-12 w-12 text-gray-500 animate-spin mb-6" />
          <h2 className="text-lg font-medium text-gray-300 mb-1">Loading...</h2>
          <p className="text-sm text-gray-400">Status: {status}</p>
        </div>
      );
  }
}
