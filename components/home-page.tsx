'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
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
    // Clear previous errors on retry
    setAuthError(null);

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

  const getButtonText = useCallback(() => {
    if (status === 'authenticated') {
      return 'Go to Projects';
    }
    return 'Get Started';
  }, [status]);

  // Show minimal loading during initialization
  const isInitializing = !isInitialized || isLoading;
  const isButtonDisabled = isInitializing || isAuthenticating;

  return (
    <>
      {/* Base marketing page - always visible */}
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-start pt-40">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-4 md:gap-6 mb-6 -ml-8">
            <Image
              src="/icon-transparent.svg"
              alt="Fulling Logo"
              width={80}
              height={80}
              className="w-16 h-16 md:w-20 md:h-20"
            />
            <h1 className="text-4xl md:text-6xl lg:text-8xl font-bold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text leading-normal text-transparent">
              Fulling
            </h1>
          </div>
          <p className="text-xl text-muted-foreground mb-12">AI-Powered Full-Stack Development Platform</p>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Create, develop, and deploy production-ready web applications using natural language.
            Powered by Claude Code in isolated sandbox environments.
          </p>

          {/* Error message - with aria attributes for accessibility */}
          {authError && (
            <div
              className="mb-4 p-3 bg-destructive/10 border border-destructive/50 rounded text-destructive text-sm max-w-md mx-auto"
              role="alert"
              aria-live="polite"
            >
              {authError}
            </div>
          )}

          <div className="flex gap-8 justify-center">
            <Button
              size="lg"
              onClick={handleGetStarted}
              disabled={isButtonDisabled}
              className="bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={isAuthenticating}
            >
              {getButtonText()}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="hover:bg-accent"
              title="Learn more about FullStack Agent (Coming Soon)"
            >
              Learn More
            </Button>
          </div>
        </div>
      </div>

      {/* Authentication overlay - shown during Sealos auth process */}
      {isAuthenticating && (
        <div
          className="fixed inset-0 bg-background/90 flex items-center justify-center z-50"
          role="dialog"
          aria-label="Authentication in progress"
          aria-modal="true"
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
            <p className="text-muted-foreground text-sm">Authenticating with Sealos...</p>
          </div>
        </div>
      )}
    </>
  );
}
