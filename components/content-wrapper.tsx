'use client';

import { useTerminal } from './terminal-provider';

interface ContentWrapperProps {
  children: React.ReactNode;
  projectId: string;
}

export default function ContentWrapper({ children, projectId }: ContentWrapperProps) {
  const { isTerminalVisible, currentProjectId } = useTerminal();

  // Hide content when terminal is visible for this project
  const shouldHide = isTerminalVisible && currentProjectId === projectId;

  if (shouldHide) {
    return null;
  }

  return <>{children}</>;
}
