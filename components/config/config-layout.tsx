/**
 * Shared configuration page layout
 * VSCode Dark Modern style with clean line-based design
 */

'use client';

import type { ReactNode } from 'react';

import { Spinner } from '@/components/ui/spinner';

interface ConfigLayoutProps {
  /** Page title */
  title: string;
  /** Page description */
  description: string;
  /** Main content */
  children: ReactNode;
  /** Loading state */
  loading?: boolean;
}

/**
 * Configuration page layout with VSCode Dark Modern styling
 */
export function ConfigLayout({ title, description, children, loading }: ConfigLayoutProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
        <div className="flex items-center gap-3">
          <Spinner className="h-5 w-5 text-[#3794ff]" />
          <span className="text-sm text-[#cccccc]">Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
      {/* Header - Clean VSCode style */}
      <div className="shrink-0 border-b border-[#3e3e42] bg-[#1e1e1e] px-6 py-4">
        <div>
          <h1 className="text-base font-medium text-[#cccccc]">{title}</h1>
          <p className="text-xs text-[#858585] mt-0.5">{description}</p>
        </div>
      </div>

      {/* Content - Scrollable area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">{children}</div>
      </div>
    </div>
  );
}
