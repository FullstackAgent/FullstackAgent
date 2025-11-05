'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { authenticateWithSealos } from '@/app/actions/sealos-auth';
import { Button } from '@/components/ui/button';
import { useSealos } from '@/provider/sealos';

/**
 * Home page client component with unified rendering.
 *
 * Get Started Button Behavior:
 * - Non-Sealos + Authenticated: Go to /projects
 * - Non-Sealos + Unauthenticated: Go to /login
 * - Sealos + Authenticated: Go to /projects
 * - Sealos + Unauthenticated: Trigger Sealos auth → then go to /projects
 */
export function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const { isInitialized, isLoading, isSealos, sealosToken, sealosKubeconfig } = useSealos();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Determine button action based on environment and auth status
  const handleGetStarted = async () => {
    // Already authenticated - go to projects
    if (status === 'authenticated') {
      router.push('/projects');
      return;
    }

    // Non-Sealos environment - go to login
    if (!isSealos) {
      router.push('/login');
      return;
    }

    // Sealos environment + unauthenticated - trigger Sealos auth
    if (!sealosToken || !sealosKubeconfig) {
      setAuthError('Missing Sealos credentials');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const result = await authenticateWithSealos(sealosToken, sealosKubeconfig);

      if (result.success) {
        // Authentication successful - redirect to projects
        router.push('/projects');
        router.refresh();
      } else {
        setAuthError(result.error || 'Authentication failed');
        setIsAuthenticating(false);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unknown error');
      setIsAuthenticating(false);
    }
  };

  const getButtonText = () => {
    if (status === 'authenticated') {
      return 'Go to Projects';
    }
    return 'Get Started';
  };

  // Show minimal loading during initialization
  const isInitializing = !isInitialized || isLoading;
  const isButtonDisabled = isInitializing || isAuthenticating;

  return (
    <>
      {/* Base marketing page - always visible */}
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-6xl font-bold mb-6 bg-linear-to-r from-white to-gray-500 bg-clip-text text-transparent">
            FullStack Agent
          </h1>
          <p className="text-xl text-gray-400 mb-12">AI-Powered Full-Stack Development Platform</p>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Create, develop, and deploy production-ready web applications through natural language.
            Powered by Claude Code in isolated sandbox environments.
          </p>

          {/* Error message */}
          {authError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm max-w-md mx-auto">
              {authError}
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              onClick={handleGetStarted}
              disabled={isButtonDisabled}
              className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {getButtonText()}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/about')}
              className="border-gray-700 text-white hover:bg-gray-900"
            >
              Learn More
            </Button>
          </div>
        </div>
      </div>

      {/* Authentication overlay - shown during Sealos auth process */}
      {isAuthenticating && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400 text-sm">Authenticating with Sealos...</p>
          </div>
        </div>
      )}
    </>
  );
}
