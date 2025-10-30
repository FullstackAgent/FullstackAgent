'use client';

import { SessionProvider } from 'next-auth/react';

import { SealosProvider } from './sealos';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SealosProvider>{children}</SealosProvider>
    </SessionProvider>
  );
}
