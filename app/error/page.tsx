'use client';

import { Suspense } from 'react';
import { AlertCircle, ArrowLeft, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorDetails = () => {
    switch (error) {
      case 'Configuration':
        return {
          title: 'Configuration Error',
          message: 'There was a problem with the authentication configuration.',
          code: 'AUTH_CONFIG_ERROR',
        };
      case 'AccessDenied':
        return {
          title: 'Access Denied',
          message: 'You do not have permission to sign in.',
          code: 'AUTH_ACCESS_DENIED',
        };
      case 'Verification':
        return {
          title: 'Verification Failed',
          message: 'The verification token has expired or has already been used.',
          code: 'AUTH_VERIFICATION_FAILED',
        };
      default:
        return {
          title: 'Authentication Error',
          message: 'An unexpected error occurred during authentication.',
          code: 'AUTH_UNKNOWN_ERROR',
        };
    }
  };

  const errorDetails = getErrorDetails();

  return (
    <div className="w-full max-w-2xl px-4">
      {/* Error Header - VSCode style */}
      <div className="mb-8 flex items-start gap-4">
        <div className="shrink-0 mt-1">
          <AlertCircle className="h-12 w-12 text-red-400" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h1 className="text-4xl font-semibold text-white mb-2">{errorDetails.title}</h1>
          <p className="text-lg text-gray-400 leading-relaxed">{errorDetails.message}</p>
        </div>
      </div>

      {/* Error Code Box - VSCode terminal style */}
      <div className="mb-8 bg-[#1e1e1e] border border-gray-800 rounded-lg p-6 font-mono">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
          <span className="text-red-400">✗</span>
          <span>Error Code</span>
        </div>
        <div className="text-red-400 text-sm">{errorDetails.code}</div>
      </div>

      {/* Actions - VSCode button style */}
      <div className="space-y-3">
        <Link href="/login" className="block">
          <Button
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-start gap-3"
          >
            <RefreshCw className="h-5 w-5" />
            <span>Try Again</span>
          </Button>
        </Link>
        <Link href="/" className="block">
          <Button
            size="lg"
            variant="outline"
            className="w-full border-gray-700 text-gray-300 hover:bg-gray-900 hover:text-white justify-start gap-3"
          >
            <Home className="h-5 w-5" />
            <span>Go to Home</span>
          </Button>
        </Link>
        <Link href="/projects" className="block">
          <Button
            size="lg"
            variant="ghost"
            className="w-full text-gray-400 hover:text-white hover:bg-gray-900 justify-start gap-3"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Projects</span>
          </Button>
        </Link>
      </div>

      {/* Help Text */}
      <div className="mt-8 pt-8 border-t border-gray-800">
        <p className="text-sm text-gray-500 text-center">
          If this problem persists, please contact support or check your authentication
          configuration.
        </p>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex items-center justify-center py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-2xl px-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-1">
                <AlertCircle className="h-12 w-12 text-gray-600 animate-pulse" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <div className="h-10 bg-gray-800 rounded mb-3 animate-pulse"></div>
                <div className="h-6 bg-gray-800 rounded w-3/4 animate-pulse"></div>
              </div>
            </div>
          </div>
        }
      >
        <ErrorContent />
      </Suspense>
    </div>
  );
}
