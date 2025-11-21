'use client';

import { useState } from 'react';
import { Environment, Project, Sandbox } from '@prisma/client';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  Key,
  Package,
  Shield,
  Terminal,
} from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface ProjectSidebarProps {
  project: Project;
  sandboxes: Sandbox[];
  envVars: Environment[];
}

export default function ProjectSidebar({ project }: ProjectSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const topSections = [
    {
      id: 'terminal',
      label: 'Web Terminal',
      icon: Terminal,
      href: `/projects/${project.id}/terminal`,
    },
    { id: 'database', label: 'Database', icon: Database, href: `/projects/${project.id}/database` },
  ];

  const configSections = [
    {
      id: 'environment',
      label: 'Environment Variables',
      icon: Package,
      href: `/projects/${project.id}/environment`,
    },
    {
      id: 'secrets',
      label: 'Secret Configuration',
      icon: Key,
      href: `/projects/${project.id}/secrets`,
    },
    { id: 'auth', label: 'Auth Configuration', icon: Shield, href: `/projects/${project.id}/auth` },
    {
      id: 'payment',
      label: 'Payment Configuration',
      icon: CreditCard,
      href: `/projects/${project.id}/payment`,
    },
  ];

  return (
    <div
      className={cn(
        'bg-sidebar-project-background border-r border-border flex flex-col transition-all duration-200',
        isCollapsed ? 'w-10' : 'w-72'
      )}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border">
        {!isCollapsed && (
          <span className="text-sm font-medium text-foreground">Project {project.name}</span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {/* Top sections */}
          <div>
            <div className="px-3 pt-4 pb-2 text-xs font-semibold text-muted-foreground">WORKSPACE</div>
            {topSections.map((section) => {
              const Icon = section.icon;
              const isActive = pathname === section.href;

              return (
                <a
                  key={section.id}
                  href={section.href}
                  className={cn(
                    'group w-full flex items-center pl-6 pr-3 py-2 text-base transition-colors min-h-[32px]',
                    isActive ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent'
                  )}
                >
                  <Icon className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-sidebar-foreground shrink-0 transition-colors" />
                  <span className={cn("truncate flex-1 font-semibold", isActive ? "text-card-foreground" : "text-foreground")}>{section.label}</span>
                </a>
              );
            })}
          </div>

          {/* Configuration Group */}
          <div>
            <div className="px-3 pt-4 pb-2 text-xs font-semibold text-muted-foreground">CONFIGURATION</div>
            {configSections.map((section) => {
              const Icon = section.icon;
              const isActive = pathname === section.href;

              return (
                <a
                  key={section.id}
                  href={section.href}
                  className={cn(
                    'group w-full flex items-center pl-6 pr-3 py-2 text-base transition-colors min-h-[32px]',
                    isActive ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent'
                  )}
                >
                  <Icon className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-sidebar-foreground shrink-0 transition-colors" />
                  <span className={cn("truncate flex-1 font-semibold", isActive ? "text-card-foreground" : "text-foreground")}>{section.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
