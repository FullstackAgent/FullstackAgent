/**
 * CreateProjectDialog Component
 *
 * Dialog for creating new projects
 * Handles project creation with kubeconfig validation
 */

'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import SettingsDialog from '@/components/dialog/settings-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FetchError, POST } from '@/lib/fetch-client';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
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

      toast.success('Creating project...');

      // Reset form
      setProjectName('');
      setDescription('');

      // Close dialog
      onOpenChange(false);

      // Async creation - project list will show latest status via polling
      router.refresh();
    } catch (error) {
      console.error('Error creating project:', error);

      // Check if error is due to missing kubeconfig
      if (error instanceof FetchError && error.body) {
        const errorBody = error.body as { errorCode?: string; message?: string };
        if (errorBody.errorCode === 'KUBECONFIG_MISSING') {
          toast.error(errorBody.message || 'Kubeconfig is not configured', {
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl bg-[#252526] border-[#3e3e42] text-white p-0 flex flex-col rounded"
          showCloseButton={true}
        >
          <DialogHeader className="px-6 py-4 border-b border-[#3e3e42]">
            <DialogTitle className="text-xl text-white">Create New Project</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateProject} className="px-6 py-6 space-y-6">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="project-name" className="text-white text-sm font-medium">
                Project Name
              </Label>
              <Input
                id="project-name"
                placeholder="my-awesome-app"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={isCreating}
                className="bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 disabled:opacity-50"
                autoFocus
              />
              <p className="text-xs text-gray-500">
                Use lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="project-description" className="text-white text-sm font-medium">
                Description (Optional)
              </Label>
              <Input
                id="project-description"
                placeholder="A brief description of your project"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
                className="bg-[#1e1e1e] border-[#3e3e42] text-white placeholder:text-gray-500 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500">
                Optional. Add a brief description to help identify this project.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isCreating || !projectName.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
              >
                <Save className="mr-2 h-4 w-4" />
                {isCreating ? 'Creating...' : 'Create Project'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
                className="border-[#3e3e42] text-gray-400 hover:text-white hover:bg-[#3e3e42]"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog for kubeconfig configuration */}
      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        defaultTab="kubeconfig"
      />
    </>
  );
}
