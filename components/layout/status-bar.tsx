import React from 'react';
import { Prisma } from '@prisma/client';
import { Box, Database } from 'lucide-react';

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
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 hover:bg-card-foreground/10 px-1 rounded cursor-pointer transition-colors">
          <Box className={`w-3 h-3 ${getStatusIconColor(sbStatus)}`} />
          <span>Sandbox: {sbStatus}</span>
        </div>
        <div className="w-px h-3 bg-card-foreground/20 mx-1" />
        <div className="flex items-center gap-1 hover:bg-card-foreground/10 px-1 rounded cursor-pointer transition-colors">
          <Database className={`w-3 h-3 ${getStatusIconColor(dbStatus)}`} />
          <span>Database: {dbStatus}</span>
        </div>
      </div>
    </div>
  );
}
