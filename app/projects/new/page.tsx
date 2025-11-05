'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import SettingsDialog from '@/components/settings-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FetchError, POST } from '@/lib/fetch-client';

export default function NewProjectPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    setIsCreating(true);

    try {
      await POST<{ id: string; name: string }>('/api/projects', {
        name: projectName,
        description: description,
      });

      toast.success('Project is being created! Redirecting...');

      // Async creation - redirect immediately to projects list
      // Project list page will show latest status via polling
      router.push('/projects');
    } catch (error) {
      console.error('Error creating project:', error);

      // Check if error is due to missing kubeconfig
      if (error instanceof FetchError && error.body) {
        const errorBody = error.body as { errorCode?: string; message?: string };
        if (errorBody.errorCode === 'KUBECONFIG_MISSING') {
          toast.error(errorBody.message || 'Kubeconfig not configured', {
            duration: 6000,
          });
          setShowSettingsDialog(true);
          setIsCreating(false);
          return;
        }
      }

      toast.error('Failed to create project. Please try again.', {
        duration: 6000,
      });
      setIsCreating(false);
    }
  };

  return (
    <>
      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        defaultTab="kubeconfig"
      />
      <div className="min-h-screen bg-[#1e1e1e] text-white flex items-center justify-center">
        <Card className="w-full max-w-2xl bg-[#252526] border-[#3e3e42] rounded">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Create New Project</CardTitle>
            <CardDescription className="text-gray-400">
              Start building your AI-powered application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white text-sm">
                  Project Name
                </Label>
                <Input
                  id="name"
                  placeholder="my-awesome-app"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={isCreating}
                  className="bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-white text-sm">
                  Description (Optional)
                </Label>
                <Input
                  id="description"
                  placeholder="A brief description of your project"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isCreating}
                  className="bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
                >
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCreating ? 'Creating...' : 'Create Project'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isCreating}
                  className="border-[#3e3e42] text-gray-400 hover:text-white hover:bg-[#3e3e42]"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
