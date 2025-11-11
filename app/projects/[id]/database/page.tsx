/**
 * Database Information Page
 * Display-only page showing database connection details
 * VSCode Dark Modern style
 */

import { Info } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

import { ConnectionString } from './connection-string';

export default async function DatabasePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: { databases: true, environments: true },
  });

  if (!project) notFound();

  const database = project.databases[0];
  const dbUrlEnv = project.environments.find((env) => env.key === 'DATABASE_URL');

  const connectionString = dbUrlEnv?.value || database?.connectionUrl || '';
  let host = '';
  let port = '';
  let dbName = '';
  let username = '';
  let password = '';

  // Parse connection string
  if (connectionString) {
    try {
      const match = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
      if (match) {
        [, username, password, host, port, dbName] = match;
      }
    } catch (e) {
      console.error('Failed to parse database URL:', e);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
      {/* Header */}
      <div className="shrink-0 border-b border-[#3e3e42] bg-[#1e1e1e] px-6 py-4">
        <div>
          <h1 className="text-base font-medium text-[#cccccc]">Database Information</h1>
          <p className="text-xs text-[#858585] mt-0.5">View database connection details</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {connectionString ? (
            <>
              {/* Connection Details */}
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-[#cccccc] mb-3">PostgreSQL Connection</h2>

                {/* Host */}
                <div>
                  <label className="text-xs text-[#858585] mb-1 block">Host</label>
                  <div className="p-2.5 bg-[#3c3c3c] border border-[#3e3e42] rounded font-mono text-sm text-[#cccccc]">
                    {host}
                  </div>
                </div>

                {/* Port */}
                <div>
                  <label className="text-xs text-[#858585] mb-1 block">Port</label>
                  <div className="p-2.5 bg-[#3c3c3c] border border-[#3e3e42] rounded font-mono text-sm text-[#cccccc]">
                    {port}
                  </div>
                </div>

                {/* Database Name */}
                <div>
                  <label className="text-xs text-[#858585] mb-1 block">Database</label>
                  <div className="p-2.5 bg-[#3c3c3c] border border-[#3e3e42] rounded font-mono text-sm text-[#cccccc]">
                    {dbName}
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="text-xs text-[#858585] mb-1 block">Username</label>
                  <div className="p-2.5 bg-[#3c3c3c] border border-[#3e3e42] rounded font-mono text-sm text-[#cccccc]">
                    {username}
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="text-xs text-[#858585] mb-1 block">Password</label>
                  <div className="p-2.5 bg-[#3c3c3c] border border-[#3e3e42] rounded font-mono text-sm text-[#cccccc]">
                    {'•'.repeat(Math.min(password.length, 20))}
                  </div>
                </div>

                {/* Full Connection String */}
                <ConnectionString connectionString={connectionString} />
              </div>

              {/* Info Panel */}
              <div className="p-4 bg-[#252526] border border-[#3e3e42] rounded">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-[#3794ff] mt-0.5 shrink-0" />
                  <div className="space-y-1 text-xs text-[#858585]">
                    <p>• Database is automatically provisioned with your sandbox</p>
                    <p>• Managed by KubeBlocks with high availability</p>
                    <p>• SSL encryption enabled by default</p>
                    <p>• Connection string available via DATABASE_URL environment variable</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-[#858585]">No database configured</p>
              <p className="text-xs text-[#858585] mt-1">
                Database will be automatically provisioned when sandbox is created
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
