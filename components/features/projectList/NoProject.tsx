'use client';

import { useState } from 'react';

import CreateProjectDialog from '@/components/dialog/create-project-dialog';
import { EmptyStateIcon } from '@/components/icons';

export default function NoProject() {
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-center py-20">
        <button
          className="flex h-96 w-full max-w-2xl items-center justify-center cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg transition-all"
          onClick={() => setCreateModalOpen(true)}
          aria-label="Create your first project"
        >
          <div className="flex flex-col items-center space-y-4 w-4/5 text-center">
            {/* Empty State Icon with hover effect */}
            <EmptyStateIcon className="w-24 h-24 [&_*]:transition-colors [&_*]:fill-muted-foreground group-hover:[&_*]:fill-foreground" />

            {/* Text Content */}
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                No projects yet
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md transition-colors group-hover:text-foreground">
                Click to create your first project and start building with Claude Code in isolated
                sandbox environments
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Create Project Dialog */}
      <CreateProjectDialog open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </>
  );
}
