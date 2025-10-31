import { redirect } from 'next/navigation';

import { HomePage } from '@/components/HomePage';
import { auth } from '@/lib/auth';

export default async function Page() {
  // Server-side authentication check
  const session = await auth();

  // Already authenticated users should go directly to projects
  // Use server-side redirect (no React render issues)
  if (session) {
    redirect('/projects');
  }

  // Render client component for environment-aware display
  // - During initialization: Minimal loading
  // - Sealos environment: Auto-login flow
  // - Non-Sealos environment: Marketing page
  return <HomePage />;
}
