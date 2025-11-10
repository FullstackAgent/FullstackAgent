'use client';

import { useEffect, useState } from 'react';
import { Project } from '@prisma/client';
import {
  AlertCircle,
  Check,
  Chrome as ChromeIcon,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Github as GithubIcon,
  Key,
  RefreshCw,
} from 'lucide-react';

import { POST, PUT } from '@/lib/fetch-client';
import { cn } from '@/lib/utils';

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

interface AuthConfigurationProps {
  project: Project;
  projectUrl: string;
  environmentVariables: EnvironmentVariable[];
}

export default function AuthConfiguration({
  project,
  projectUrl,
  environmentVariables,
}: AuthConfigurationProps) {
  const [activeTab, setActiveTab] = useState('github');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());

  // Environment variables state
  const [envVars, setEnvVars] = useState<{ [key: string]: string }>({});

  // Initialize environment variables
  useEffect(() => {
    const vars: { [key: string]: string } = {};
    environmentVariables.forEach((env) => {
      vars[env.key] = env.value;
    });
    setEnvVars(vars);
  }, [environmentVariables]);

  const tabs = [
    { id: 'github', label: 'GitHub OAuth', icon: GithubIcon },
    { id: 'google', label: 'Google OAuth', icon: ChromeIcon },
    { id: 'nextauth', label: 'NextAuth Settings', icon: Key },
  ];

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const generateSecret = () => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    saveEnvVar('NEXTAUTH_SECRET', secret);
  };

  const saveEnvVar = async (key: string, value: string) => {
    try {
      const existingVar = environmentVariables.find((env) => env.key === key);

      if (existingVar) {
        // Update existing variable
        await PUT(`/api/projects/${project.id}/environment/${existingVar.id}`, { value });

        setEnvVars((prev) => ({ ...prev, [key]: value }));
        setSavedFields((prev) => new Set([...prev, key]));
        setTimeout(() => {
          setSavedFields((prev) => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
          });
        }, 2000);
      } else if (value) {
        // Create new variable
        await POST(`/api/projects/${project.id}/environment`, {
          key,
          value,
          category: 'auth',
          isSecret: key.includes('SECRET') || key.includes('CLIENT_SECRET'),
        });

        setEnvVars((prev) => ({ ...prev, [key]: value }));
        setSavedFields((prev) => new Set([...prev, key]));
        setTimeout(() => {
          setSavedFields((prev) => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
          });
        }, 2000);
        // Reload to get the new environment variable ID
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to save environment variable:', error);
    }
  };

  const EnvVarField = ({
    label,
    envKey,
    placeholder,
    isSecret = false,
    readOnly = false,
    helpText,
  }: {
    label: string;
    envKey: string;
    placeholder?: string;
    isSecret?: boolean;
    readOnly?: boolean;
    helpText?: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-accent px-2 py-1 rounded text-primary">{envKey}</code>
          <button
            onClick={() => copyToClipboard(envKey, `env-${envKey}`)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            {copiedId === `env-${envKey}` ? (
              <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
          {savedFields.has(envKey) && <Check className="h-3 w-3 text-green-600 dark:text-green-500" />}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type={isSecret && !showSecrets[envKey] ? 'password' : 'text'}
          value={envVars[envKey] || ''}
          onChange={(e) => saveEnvVar(envKey, e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className="flex-1 px-3 py-2 bg-input border-border rounded text-sm text-foreground font-mono focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
        />
        {isSecret && (
          <button
            onClick={() => toggleSecret(envKey)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSecrets[envKey] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {helpText && <p className="text-xs text-muted-foreground mt-0">{helpText}</p>}
    </div>
  );

  const CallbackUrlField = ({ provider }: { provider: string }) => {
    const callbackUrl = `${projectUrl}/api/auth/callback/${provider}`;
    const envVarName = provider === 'github' ? 'GITHUB_CALLBACK_URL' : 'GOOGLE_CALLBACK_URL';

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Authorization Callback URL</label>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
              {envVarName}
            </code>
            <button
              onClick={() => copyToClipboard(envVarName, `env-callback-${provider}`)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {copiedId === `env-callback-${provider}` ? (
                <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={callbackUrl}
            readOnly
            className="flex-1 px-3 py-2 bg-input border-border rounded text-sm text-muted-foreground font-mono"
          />
          <button
            onClick={() => copyToClipboard(callbackUrl, `callback-${provider}`)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {copiedId === `callback-${provider}` ? (
              <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-0">
          Copy this URL and add it to your OAuth app&apos;s callback URLs
        </p>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-content-background">
      {/* VSCode-style Header Panel */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">Authentication Configuration</h1>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              Configure authentication providers for your application
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-3 flex items-center gap-2 text-sm border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'text-foreground border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* GitHub OAuth */}
        {activeTab === 'github' && (
          <div className="mx-auto space-y-6">
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
                  <GithubIcon className="h-5 w-5" />
                  GitHub OAuth Configuration
                </h2>
                <a
                  href="https://github.com/settings/developers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  GitHub Developer Settings
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-4">
                <EnvVarField
                  label="Client ID"
                  envKey="GITHUB_CLIENT_ID"
                  placeholder="Enter your GitHub OAuth App Client ID"
                  helpText="Get this from your GitHub OAuth App settings"
                />

                <EnvVarField
                  label="Client Secret"
                  envKey="GITHUB_CLIENT_SECRET"
                  placeholder="Enter your GitHub OAuth App Client Secret"
                  isSecret
                  helpText="Keep this secret! Get it from your GitHub OAuth App settings"
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Homepage URL</label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                        NEXTAUTH_URL
                      </code>
                      <button
                        onClick={() => copyToClipboard('NEXTAUTH_URL', 'env-homepage-github')}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === 'env-homepage-github' ? (
                          <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={projectUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-input border-border rounded text-sm text-muted-foreground font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(projectUrl, 'homepage-github')}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedId === 'homepage-github' ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <CallbackUrlField provider="github" />
              </div>

              <div className="mt-6 p-4 rounded border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">Setup Instructions:</h3>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Go to GitHub Settings → Developer settings → OAuth Apps</li>
                  <li>Click &quot;New OAuth App&quot; or select an existing app</li>
                  <li>Set the Homepage URL and Authorization callback URL from above</li>
                  <li>Copy the Client ID and Client Secret to the fields above</li>
                  <li>Save your changes</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Google OAuth */}
        {activeTab === 'google' && (
          <div className="mx-auto space-y-6">
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
                  <ChromeIcon className="h-5 w-5" />
                  Google OAuth Configuration
                </h2>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  Google Cloud Console
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-4">
                <EnvVarField
                  label="Client ID"
                  envKey="GOOGLE_CLIENT_ID"
                  placeholder="Enter your Google OAuth 2.0 Client ID"
                  helpText="Get this from Google Cloud Console → APIs & Services → Credentials"
                />

                <EnvVarField
                  label="Client Secret"
                  envKey="GOOGLE_CLIENT_SECRET"
                  placeholder="Enter your Google OAuth 2.0 Client Secret"
                  isSecret
                  helpText="Keep this secret! Get it from your OAuth 2.0 Client ID settings"
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      Authorized JavaScript Origins
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                        NEXTAUTH_URL
                      </code>
                      <button
                        onClick={() => copyToClipboard('NEXTAUTH_URL', 'env-origin-google')}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === 'env-origin-google' ? (
                          <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={projectUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-input border-border rounded text-sm text-muted-foreground font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(projectUrl, 'origin-google')}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedId === 'origin-google' ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <CallbackUrlField provider="google" />
              </div>

              <div className="mt-6 p-4 rounded border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">Setup Instructions:</h3>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Go to Google Cloud Console → APIs & Services → Credentials</li>
                  <li>Click &quot;Create Credentials&quot; → &quot;OAuth client ID&quot;</li>
                  <li>Choose &quot;Web application&quot; as the application type</li>
                  <li>Add the Authorized JavaScript origins and redirect URIs from above</li>
                  <li>Copy the Client ID and Client Secret to the fields above</li>
                  <li>Enable the Google+ API in your project</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* NextAuth Settings */}
        {activeTab === 'nextauth' && (
          <div className="mx-auto space-y-6">
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  NextAuth Configuration
                </h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">NextAuth URL</label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                        NEXTAUTH_URL
                      </code>
                      <button
                        onClick={() => copyToClipboard('NEXTAUTH_URL', 'env-NEXTAUTH_URL')}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === 'env-NEXTAUTH_URL' ? (
                          <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      {savedFields.has('NEXTAUTH_URL') && (
                        <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={projectUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-input border-border rounded text-sm text-muted-foreground font-mono"
                    />
                    <button
                      onClick={() => saveEnvVar('NEXTAUTH_URL', projectUrl)}
                      className="px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded transition-colors"
                    >
                      Set URL
                    </button>
                  </div>
                  {/*TODO: nextauth not wrapped in a reusable component*/}
                  <p className="text-xs text-muted-foreground mt-0">
                    The URL of your application (automatically set to your project URL)
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">NextAuth Secret</label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                        NEXTAUTH_SECRET
                      </code>
                      <button
                        onClick={() => copyToClipboard('NEXTAUTH_SECRET', 'env-NEXTAUTH_SECRET')}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === 'env-NEXTAUTH_SECRET' ? (
                          <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      {savedFields.has('NEXTAUTH_SECRET') && (
                        <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecrets['NEXTAUTH_SECRET'] ? 'text' : 'password'}
                      value={envVars['NEXTAUTH_SECRET'] || ''}
                      onChange={(e) => saveEnvVar('NEXTAUTH_SECRET', e.target.value)}
                      placeholder="Click Generate to create a secure secret"
                      className="flex-1 px-3 py-2 bg-input border-border rounded text-sm text-foreground font-mono"
                    />
                    <button
                      onClick={() => toggleSecret('NEXTAUTH_SECRET')}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSecrets['NEXTAUTH_SECRET'] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={generateSecret}
                      className="px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Generate
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0">
                    A random string used to hash tokens, sign cookies and generate cryptographic
                    keys
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 rounded border border-border">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-1">Important Notes:</h3>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>The NextAuth URL must match your application&apos;s URL exactly</li>
                      <li>The secret should be a random string at least 32 characters long</li>
                      <li>Never commit your NEXTAUTH_SECRET to version control</li>
                      <li>In production, use a strong, unique secret for security</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional NextAuth Options */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h3 className="text-sm font-medium text-foreground mb-4">
                Additional Settings (Optional)
              </h3>
              <div className="space-y-4">
                <EnvVarField
                  label="Database URL (for NextAuth database sessions)"
                  envKey="DATABASE_URL"
                  placeholder="postgresql://..."
                  helpText="Already configured if you're using the project database"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}