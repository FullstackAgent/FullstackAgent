'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider } from 'next-auth/react';

import { SealosProvider } from './sealos';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000, // 5 seconds
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <SealosProvider>{children}</SealosProvider>
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
      </QueryClientProvider>
    </SessionProvider>
  );
}
