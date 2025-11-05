'use client';

import { useEffect, useState } from 'react';
import { Project } from '@prisma/client';
import { Check, Copy, Database, Eye, EyeOff, Info, Server } from 'lucide-react';

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  category?: string | null;
  isSecret: boolean;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DatabaseConfigurationProps {
  project: Project;
  environmentVariables: EnvironmentVariable[];
}

export default function DatabaseConfiguration({
  environmentVariables,
}: DatabaseConfigurationProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Avoid hydration mismatch by only rendering client-specific content after mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get database connection info from environment variables
  const dbUrl = environmentVariables.find((env) => env.key === 'DATABASE_URL');

  // Parse database URL to extract components
  let dbHost = '';
  let dbPort = '';
  let dbName = '';
  let dbUser = '';
  let dbPassword = '';

  if (dbUrl && dbUrl.value) {
    try {
      // Parse PostgreSQL connection string
      // Format: postgresql://username:password@host:port/database
      const match = dbUrl.value.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (match) {
        dbUser = match[1];
        dbPassword = match[2];
        dbHost = match[3];
        dbPort = match[4];
        dbName = match[5]?.split('?')[0]; // Remove query parameters
      }
    } catch (error) {
      console.error('Failed to parse database URL:', error);
    }
  }

  // Debug logging
  useEffect(() => {
    console.log('DatabaseConfiguration - Environment Variables:', environmentVariables);
    console.log('DatabaseConfiguration - DATABASE_URL found:', dbUrl);
    console.log('DatabaseConfiguration - Parsed values:', { dbHost, dbPort, dbName, dbUser });
  }, [environmentVariables, dbUrl, dbHost, dbPort, dbName, dbUser]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const ConnectionField = ({
    label,
    value,
    envVar,
    isSecret = false,
    id,
  }: {
    label: string;
    value: string;
    envVar?: string;
    isSecret?: boolean;
    id: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        {envVar && (
          <div className="flex items-center gap-2">
            <code className="text-xs bg-[#1e1e1e] px-2 py-1 rounded text-blue-400">{envVar}</code>
            <button
              onClick={() => copyToClipboard(envVar, `env-${id}`)}
              className="p-1 text-gray-400 hover:text-gray-200"
            >
              {copiedId === `env-${id}` ? (
                <Check className="h-3 w-3 text-green-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type={isSecret && !showPassword ? 'password' : 'text'}
          value={value}
          readOnly
          className="flex-1 px-3 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-sm text-gray-300 font-mono"
        />
        {isSecret && (
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="p-2 text-gray-400 hover:text-gray-200"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        <button
          onClick={() => copyToClipboard(value, `value-${id}`)}
          className="p-2 text-gray-400 hover:text-gray-200"
        >
          {copiedId === `value-${id}` ? (
            <Check className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Header */}
      <div className="border-b border-[#3e3e42] bg-[#252526]">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-400" />
            Database Configuration
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage your project&apos;s database connection and settings
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Connection Info */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Server className="h-5 w-5" />
              PostgreSQL Connection Details
            </h2>

            {dbUrl ? (
              <div className="space-y-4">
                {/* Database Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Database Type</label>
                  <div className="px-3 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-sm text-gray-300">
                    PostgreSQL 14
                  </div>
                </div>

                {/* Host */}
                <ConnectionField
                  label="Host"
                  value={dbHost || 'Loading...'}
                  envVar="PGHOST"
                  id="host"
                />

                {/* Port */}
                <ConnectionField label="Port" value={dbPort || '5432'} envVar="PGPORT" id="port" />

                {/* Database Name */}
                <ConnectionField
                  label="Database Name"
                  value={dbName || 'Loading...'}
                  envVar="PGDATABASE"
                  id="database"
                />

                {/* Username */}
                <ConnectionField
                  label="Username"
                  value={dbUser || 'Loading...'}
                  envVar="PGUSER"
                  id="username"
                />

                {/* Password */}
                <ConnectionField
                  label="Password"
                  value={dbPassword || 'Loading...'}
                  envVar="PGPASSWORD"
                  id="password"
                  isSecret
                />

                {/* Full Connection String */}
                <div className="pt-4 border-t border-[#3e3e42]">
                  <ConnectionField
                    label="Full Connection String"
                    value={dbUrl.value}
                    envVar="DATABASE_URL"
                    id="connection-string"
                    isSecret
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Use this connection string in your application to connect to the database
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between pt-4 border-t border-[#3e3e42]">
                  <div>
                    <label className="text-sm font-medium text-gray-300">Connection Status</label>
                    <div className="flex items-center gap-2 mt-2">
                      {isClient && (
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      )}
                      <span className="text-sm text-gray-300">Connected</span>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 text-sm text-gray-300 border border-[#3e3e42] rounded hover:bg-[#2a2d2e] transition-colors">
                    Test Connection
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Database className="h-12 w-12 mx-auto mb-3 text-gray-500" />
                <p className="text-sm text-gray-400">No database configured</p>
                <p className="text-xs text-gray-500 mt-1">
                  Database will be automatically provisioned when sandbox is created
                </p>
              </div>
            )}
          </div>

          {/* Database Info */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Info className="h-5 w-5" />
              Database Information
            </h2>

            <div className="p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
              <div className="space-y-2 text-sm text-gray-400">
                <p>• Database is automatically provisioned with your sandbox</p>
                <p>• Managed by KubeBlocks with high availability</p>
                <p>• SSL encryption enabled by default</p>
                <p>• Connection string available via DATABASE_URL environment variable</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
