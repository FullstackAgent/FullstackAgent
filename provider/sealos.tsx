'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createSealosApp, sealosApp } from '@zjy365/sealos-desktop-sdk/app';

interface SealosUserInfo {
  id: string;
  name: string;
  avatar: string;
  k8sUsername: string;
  nsid: string;
}

let sealosInitPromise: Promise<void> | null = null;

interface SealosContextType {
  isInitialized: boolean;
  isLoading: boolean;
  isSealos: boolean;
  error: string | null;
  sealosToken: string | null;
  sealosKubeconfig: string | null;
  sealosUser: SealosUserInfo | null;
  sealosNs: string | null;
}

const SealosContext = createContext<SealosContextType | null>(null);

export function SealosProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SealosContextType>({
    isInitialized: false,
    isLoading: true,
    isSealos: false,
    error: null,
    sealosToken: null,
    sealosKubeconfig: null,
    sealosUser: null,
    sealosNs: null,
  });

  const initializationRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // prevent multiple initialization
    if (initializationRef.current) return;
    initializationRef.current = true;

    const initializeSealos = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const cleanupApp = createSealosApp();

        // get session info
        console.info('Getting Sealos session...');
        const sealosSession = await sealosApp.getSession();
        const sealosToken = sealosSession.token as unknown as string;
        const sealosNs = sealosSession.user.nsid;

        setState({
          isInitialized: true,
          isLoading: false,
          isSealos: true,
          error: null,
          sealosToken,
          sealosKubeconfig: sealosSession.kubeconfig,
          sealosUser: sealosSession.user,
          sealosNs,
        });

        // cleanup
        cleanupRef.current = () => {
          cleanupApp?.();
        };
      } catch (error) {
        console.info(
          'Maybe not in Sealos environment, Sealos initialization failed, error info:',
          error
        );
        setState((prev) => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          isSealos: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    sealosInitPromise = initializeSealos().finally(() => {
      console.info('##### sealos app and sealos info init completed #####');
    });

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return <SealosContext.Provider value={state}>{children}</SealosContext.Provider>;
}

export function useSealos() {
  const context = useContext(SealosContext);
  if (!context) {
    throw new Error('useSealos must be used within a SealosProvider');
  }
  return context;
}

export async function waitForSealosInit(): Promise<void> {
  if (!sealosInitPromise) {
    // if not initialized, return a resolved promise (maybe server-side rendering or test environment)
    console.warn('Sealos initialization promise not found, resolving immediately');
    return Promise.resolve();
  }
  return sealosInitPromise.catch((error) => {
    console.error('Sealos initialization failed:', error);
    // even if initialization fails, do not throw an error, let the application continue running
    return Promise.resolve();
  });
}
