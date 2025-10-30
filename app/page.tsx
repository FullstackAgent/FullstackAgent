import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SealosAutoAuth } from '@/components/SealosAutoAuth';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth();

  if (session) {
    redirect('/projects');
  }

  return (
    <>
      {/* Sealos Auto Authentication */}
      <SealosAutoAuth />

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
    </>
  );
}
