'use client';

import { useState } from 'react';
import { Environment, Project, Sandbox } from '@prisma/client';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  Github,
  Key,
  Package,
  Settings,
  Shield,
  Terminal,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { useTerminal } from '@/components/terminal-provider';
import { cn } from '@/lib/utils';

interface ProjectSecondarySidebarProps {
  project: Project;
  sandboxes: Sandbox[];
  envVars: Environment[];
}

export default function ProjectSecondarySidebar({ project }: ProjectSecondarySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(true);
  const { hideTerminal, isTerminalVisible } = useTerminal();
  const pathname = usePathname();
  const router = useRouter();

  const handleSectionClick = (e: React.MouseEvent, sectionId: string, href: string) => {
    e.preventDefault();

    if (sectionId === 'terminal') {
      // For terminal, navigate without hiding (terminal page will show it)
      router.push(href);
    } else {
      // For other sections, hide terminal and navigate
      hideTerminal();
      router.push(href);
    }
  };

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

  const bottomSections = [
    {
      id: 'github',
      label: 'GitHub Repository',
      icon: Github,
      href: `/projects/${project.id}/github`,
    },
  ];

  // Check if any config section is active
  const isConfigActive = configSections.some((section) => pathname === section.href);

  return (
    <div
      className={cn(
        'bg-[#181818] border-r border-[#3e3e42] flex flex-col transition-all duration-200',
        isCollapsed ? 'w-10' : 'w-72'
      )}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-[#3e3e42]">
        {!isCollapsed && (
          <span className="text-sm font-medium text-gray-300">Project {project.name}</span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-400 hover:text-gray-200 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
          {/* Top sections */}
          {topSections.map((section) => {
            const Icon = section.icon;
            const isActive =
              pathname === section.href || (section.id === 'terminal' && isTerminalVisible);

            return (
              <a
                key={section.id}
                href={section.href}
                onClick={(e) => handleSectionClick(e, section.id, section.href)}
                className={cn(
                  'w-full flex items-center px-3 py-2 text-sm transition-colors min-h-[32px]',
                  isActive ? 'bg-[#2a2d2e]' : 'hover:bg-[#2a2d2e]'
                )}
              >
                <Icon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="text-gray-300 truncate flex-1">{section.label}</span>
              </a>
            );
          })}

          {/* Configuration Group */}
          <div>
            <button
              onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              className={cn(
                'w-full flex items-center px-3 py-2 text-sm transition-colors min-h-[32px]',
                isConfigActive ? 'bg-[#2a2d2e]' : 'hover:bg-[#2a2d2e]'
              )}
            >
              <Settings className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
              <span className="text-gray-300 flex-1 text-left truncate">Configuration</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-gray-400 transition-transform flex-shrink-0',
                  !isConfigExpanded && '-rotate-90'
                )}
              />
            </button>

            {isConfigExpanded && (
              <div className="bg-[#1e1e1e]">
                {configSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = pathname === section.href;

                  return (
                    <a
                      key={section.id}
                      href={section.href}
                      onClick={(e) => handleSectionClick(e, section.id, section.href)}
                      className={cn(
                        'w-full flex items-center pl-9 pr-3 py-2 text-sm transition-colors min-h-[32px]',
                        isActive ? 'bg-[#2a2d2e]' : 'hover:bg-[#2a2d2e]'
                      )}
                    >
                      <Icon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-300 truncate flex-1">{section.label}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom sections */}
          {bottomSections.map((section) => {
            const Icon = section.icon;
            const isActive = pathname === section.href;

            return (
              <a
                key={section.id}
                href={section.href}
                onClick={(e) => handleSectionClick(e, section.id, section.href)}
                className={cn(
                  'w-full flex items-center px-3 py-2 text-sm transition-colors min-h-[32px]',
                  isActive ? 'bg-[#2a2d2e]' : 'hover:bg-[#2a2d2e]'
                )}
              >
                <Icon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="text-gray-300 truncate flex-1">{section.label}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
