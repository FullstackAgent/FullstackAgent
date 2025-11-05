'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

interface TerminalContextType {
  isTerminalVisible: boolean;
  currentProjectId: string | null;
  showTerminal: (projectId: string) => void;
  hideTerminal: () => void;
  toggleTerminal: () => void;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [isTerminalVisible, setIsTerminalVisible] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const showTerminal = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    setIsTerminalVisible(true);
  }, []);

  const hideTerminal = useCallback(() => {
    setIsTerminalVisible(false);
  }, []);

  const toggleTerminal = useCallback(() => {
    setIsTerminalVisible((prev) => !prev);
  }, []);

  return (
    <TerminalContext.Provider
      value={{
        isTerminalVisible,
        currentProjectId,
        showTerminal,
        hideTerminal,
        toggleTerminal,
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (context === undefined) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
