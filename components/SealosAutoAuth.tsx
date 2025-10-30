'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { authenticateWithSealos } from '@/app/actions/sealos-auth';
import { useSealos } from '@/provider/sealos';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

export function SealosAutoAuth() {
  const router = useRouter();
  const { status } = useSession();
  const { isInitialized, isLoading, isSealos, sealosToken, sealosKubeconfig } = useSealos();
  const [retryCount, setRetryCount] = useState(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authAttempted = useRef(false);

  useEffect(() => {
    // Wait for Sealos and NextAuth initialization to complete
    if (!isInitialized || isLoading || status === 'loading') {
      return;
    }

    // If already authenticated, redirect to /projects
    if (status === 'authenticated') {
      router.push('/projects');
      return;
    }

    // If in Sealos environment and unauthenticated, auto-initiate Sealos authentication
    if (
      isSealos &&
      status === 'unauthenticated' &&
      sealosToken &&
      sealosKubeconfig &&
      !authAttempted.current &&
      !isAuthenticating &&
      retryCount < MAX_RETRY_ATTEMPTS
    ) {
      authAttempted.current = true;
      setIsAuthenticating(true);
      console.log(
        `[Sealos Auth] Attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS} - Auto-initiating authentication (iframe mode)...`
      );

      // Use server action for authentication in iframe environment
      // This bypasses client-side CSRF token issues
      authenticateWithSealos(sealosToken, sealosKubeconfig)
        .then((result) => {
          if (!result.success) {
            console.error('[Sealos Auth] Authentication failed:', result.error);

            // Retry with delay if under max attempts
            if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
              console.log(`[Sealos Auth] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
              setTimeout(() => {
                authAttempted.current = false;
                setIsAuthenticating(false);
                setRetryCount((prev) => prev + 1);
              }, RETRY_DELAY_MS);
            } else {
              console.error('[Sealos Auth] Max retry attempts reached, giving up');
              setIsAuthenticating(false);
            }
          } else {
            console.log('[Sealos Auth] Authentication successful, redirecting...');
            // Authentication successful, redirect to projects page
            router.push('/projects');
            router.refresh();
          }
        })
        .catch((error) => {
          console.error('[Sealos Auth] Error during authentication:', error);

          // Retry with delay if under max attempts
          if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
            console.log(`[Sealos Auth] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            setTimeout(() => {
              authAttempted.current = false;
              setIsAuthenticating(false);
              setRetryCount((prev) => prev + 1);
            }, RETRY_DELAY_MS);
          } else {
            console.error('[Sealos Auth] Max retry attempts reached, giving up');
            setIsAuthenticating(false);
          }
        });
    }
  }, [
    isInitialized,
    isLoading,
    isSealos,
    status,
    sealosToken,
    sealosKubeconfig,
    router,
    retryCount,
    isAuthenticating,
  ]);

  // Display loading state
  if (isLoading || status === 'loading') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">
            {isSealos ? 'Authenticating with Sealos...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // If in Sealos environment and authenticating, display loading state with retry info
  if (isSealos && isAuthenticating) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Authenticating with Sealos...</p>
          {retryCount > 0 && (
            <p className="text-gray-500 text-sm mt-2">
              Retry attempt {retryCount}/{MAX_RETRY_ATTEMPTS}
            </p>
          )}
        </div>
      </div>
    );
  }

  // If max retries reached, show error message
  if (isSealos && retryCount >= MAX_RETRY_ATTEMPTS && !isAuthenticating) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Sealos Authentication Failed</h2>
          <p className="text-gray-400 mb-4">
            Unable to authenticate with Sealos after {MAX_RETRY_ATTEMPTS} attempts.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return null;
}
