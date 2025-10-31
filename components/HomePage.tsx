'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { SealosAutoAuth } from '@/components/SealosAutoAuth';
import { Button } from '@/components/ui/button';
import { useSealos } from '@/provider/sealos';

/**
 * Home page client component with environment-aware rendering.
 *
 * Rendering logic:
 * 1. Authenticated users: Redirect to /projects (via useEffect to avoid render errors)
 * 2. During initialization: Show minimal loading
 * 3. Sealos environment: Show SealosAutoAuth for auto-login
 * 4. Non-Sealos environment: Show marketing page
 */
export function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const { isInitialized, isLoading, isSealos } = useSealos();

  // ========== Handle Authenticated Redirect ==========

  // Use useEffect to redirect authenticated users (avoid setState during render)
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/projects');
    }
  }, [status, router]);

  // ========== Wait for Sealos Initialization ==========

  // During initialization, we don't know if we're in Sealos environment yet
  // Show minimal loading without revealing environment
  if (!isInitialized || isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // ========== Sealos Environment: Auto-login ==========

  // After initialization, if in Sealos environment,
  // show only SealosAutoAuth component for auto-login flow
  if (isSealos) {
    return <SealosAutoAuth />;
  }

  // ========== Non-Sealos Environment: Marketing Page ==========

  // Only show marketing page when confirmed NOT in Sealos environment
  return (
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
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg" className="bg-white text-black hover:bg-gray-200">
              Get Started
            </Button>
          </Link>
          <Link href="/about">
            <Button
              size="lg"
              variant="outline"
              className="border-gray-700 text-white hover:bg-gray-900"
            >
              Learn More
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
