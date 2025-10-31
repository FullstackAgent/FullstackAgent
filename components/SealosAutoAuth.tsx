'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { authenticateWithSealos } from '@/app/actions/sealos-auth';
import { useSealos } from '@/provider/sealos';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

type AuthState =
  | 'idle'           // Initial state
  | 'authenticating' // Currently authenticating
  | 'success'        // Authentication successful
  | 'failed'         // Authentication failed (max retries reached)
  | 'retrying';      // Retrying after failure

/**
 * Sealos Auto Authentication Component
 *
 * @remarks
 * This component should ONLY be rendered when:
 * 1. Sealos initialization is complete (isInitialized === true)
 * 2. In Sealos environment (isSealos === true)
 *
 * The parent component (page.tsx) handles environment detection and
 * only renders this component in Sealos environments.
 */
export function SealosAutoAuth() {
  const router = useRouter();
  const { status } = useSession();
  const { sealosToken, sealosKubeconfig } = useSealos();

  const [authState, setAuthState] = useState<AuthState>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const hasAttempted = useRef(false);

  useEffect(() => {
    // ========== Early Returns: Check preconditions ==========

    // 1. NextAuth session still loading
    if (status === 'loading') {
      return;
    }

    // 2. Already authenticated - redirect to projects page
    if (status === 'authenticated') {
      setAuthState('success');
      router.push('/projects');
      return;
    }

    // 3. Already attempted authentication - wait for state changes
    if (hasAttempted.current) {
      return;
    }

    // 4. Missing required credentials
    if (!sealosToken || !sealosKubeconfig) {
      console.warn('[Sealos Auth] Missing required credentials (token or kubeconfig)');
      return;
    }

    // 5. Max retry attempts reached
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      setAuthState('failed');
      return;
    }

    // ========== Start Auto Authentication ==========

    hasAttempted.current = true;
    setAuthState('authenticating');

    console.log(
      `[Sealos Auth] Attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS} - Starting authentication (iframe mode)...`
    );

    // Use server action to bypass client-side CSRF token issues in iframe
    authenticateWithSealos(sealosToken, sealosKubeconfig)
      .then((result) => {
        if (result.success) {
          console.log('[Sealos Auth] Authentication successful! Redirecting to projects...');
          setAuthState('success');
          router.push('/projects');
          router.refresh();
        } else {
          handleAuthFailure(result.error);
        }
      })
      .catch((error) => {
        console.error('[Sealos Auth] Unexpected error during authentication:', error);
        handleAuthFailure(error.message);
      });

    // Handle authentication failure with retry logic
    function handleAuthFailure(errorMsg?: string) {
      console.error('[Sealos Auth] Authentication failed:', errorMsg || 'Unknown error');

      if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
        console.log(`[Sealos Auth] Scheduling retry in ${RETRY_DELAY_MS / 1000}s...`);
        setAuthState('retrying');

        setTimeout(() => {
          hasAttempted.current = false;
          setAuthState('idle');
          setRetryCount((prev) => prev + 1);
        }, RETRY_DELAY_MS);
      } else {
        console.error('[Sealos Auth] Max retry attempts reached. Giving up.');
        setAuthState('failed');
      }
    }
  }, [status, sealosToken, sealosKubeconfig, retryCount, router]);

  // ========== UI Rendering Based on State ==========

  // Currently authenticating or retrying
  if (authState === 'authenticating' || authState === 'retrying') {
    return (
      <LoadingOverlay
        message="Authenticating with Sealos..."
        retry={retryCount > 0 ? { current: retryCount, max: MAX_RETRY_ATTEMPTS } : undefined}
      />
    );
  }

  // Authentication failed after max retries
  if (authState === 'failed') {
    return <FailedOverlay maxAttempts={MAX_RETRY_ATTEMPTS} />;
  }

  // Other states (idle, success): no overlay needed
  return null;
}

// ========== UI Components ==========

interface LoadingOverlayProps {
  message: string;
  retry?: {
    current: number;
    max: number;
  };
}

function LoadingOverlay({ message, retry }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-gray-400">{message}</p>
        {retry && (
          <p className="text-gray-500 text-sm mt-2">
            Retry attempt {retry.current}/{retry.max}
          </p>
        )}
      </div>
    </div>
  );
}

interface FailedOverlayProps {
  maxAttempts: number;
}

function FailedOverlay({ maxAttempts }: FailedOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="text-red-500 text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white mb-2">
          Sealos Authentication Failed
        </h2>
        <p className="text-gray-400 mb-4">
          Unable to authenticate with Sealos after {maxAttempts} attempts.
          Please check your credentials and try again.
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
