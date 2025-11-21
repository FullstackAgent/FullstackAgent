import React from 'react';
import { Prisma } from '@prisma/client';
import { AlertCircle, Bell, Box, Check, Database, GitBranch, XCircle } from 'lucide-react';

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: {
    sandboxes: true;
    databases: true;
    environments: true;
  };
}>;

interface StatusBarProps {
  project?: ProjectWithRelations;
}

import { getStatusIconColor } from '@/lib/util/status-colors';

export function StatusBar({ project }: StatusBarProps) {
  const database = project?.databases?.[0];
  const dbStatus = database?.status || 'CREATING';
  const sandbox = project?.sandboxes?.[0];
  const sbStatus = sandbox?.status || 'CREATING';

  return (
    <div className="h-6 bg-primary text-card-foreground [&_span]:text-card-foreground flex items-center justify-between px-2 text-xs select-none z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 hover:bg-card-foreground/10 px-1 rounded cursor-pointer transition-colors">
          <GitBranch className="w-3 h-3" />
          <span>main</span>
        </div>
        <div className="flex items-center gap-2 hover:bg-card-foreground/10 px-1 rounded cursor-pointer transition-colors">
          <div className="flex items-center gap-0.5">
            <XCircle className="w-3 h-3" />
            <span>0</span>
          </div>
          <div className="flex items-center gap-0.5">
            <AlertCircle className="w-3 h-3" />
            <span>0</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 hover:bg-card-foreground/10 px-1 rounded cursor-pointer transition-colors">
          <span>Ln 42, Col 1</span>
        </div>
        <div className="flex items-center gap-1 hover:bg-card-foreground/10 px-1 rounded cursor-pointer transition-colors">
          <Box className={`w-3 h-3 ${getStatusIconColor(sbStatus)}`} />
          <span>Sandbox: {sbStatus}</span>
        </div>
        <div className="flex items-center gap-1 hover:bg-card-foreground/10 px-1 rounded cursor-pointer transition-colors">
          <Database className={`w-3 h-3 ${getStatusIconColor(dbStatus)}`} />
          <span>Database: {dbStatus}</span>
        </div>
        <div className="flex items-center gap-1 hover:bg-card-foreground/10 px-1 rounded cursor-pointer transition-colors">
          <Check className="w-3 h-3" />
          <span>Prettier</span>
        </div>
        <div className="flex items-center gap-1 hover:bg-card-foreground/10 px-1 rounded cursor-pointer transition-colors">
          <Bell className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}
