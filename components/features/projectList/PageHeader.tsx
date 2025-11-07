import { memo } from 'react';
import { Folder, Plus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  projectsCount: number;
  className?: string;
}

const PageHeader = memo(({ projectsCount, className }: PageHeaderProps) => {
  return (
    <div className={`h-12 bg-card border-b border-border flex items-center justify-between px-4 ${className || ''}`}>
      <div className="flex items-center gap-3">
        <Folder className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-medium text-foreground">Projects</h1>
        <span className="text-xs text-muted-foreground">({projectsCount})</span>
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
  );
});

PageHeader.displayName = 'PageHeader';

export default PageHeader;