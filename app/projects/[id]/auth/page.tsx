'use client';

import { useEffect, useState } from 'react';
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
  Save,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { GET, POST } from '@/lib/fetch-client';
import { cn } from '@/lib/utils';

interface AuthVariable {
  id?: string;
  key: string;
  value: string;
}

const AUTH_VARIABLES = {
  github: [
    { key: 'GITHUB_CLIENT_ID', label: 'Client ID', placeholder: 'Enter your GitHub OAuth App Client ID', type: 'text', description: 'Get this from your GitHub OAuth App settings' },
    { key: 'GITHUB_CLIENT_SECRET', label: 'Client Secret', placeholder: 'Enter your GitHub OAuth App Client Secret', type: 'password', description: 'Keep this secret! Get it from your GitHub OAuth App settings' },
  ],
  google: [
    { key: 'GOOGLE_CLIENT_ID', label: 'Client ID', placeholder: 'Enter your Google OAuth 2.0 Client ID', type: 'text', description: 'Get this from Google Cloud Console → APIs & Services → Credentials' },
    { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', placeholder: 'Enter your Google OAuth 2.0 Client Secret', type: 'password', description: 'Keep this secret! Get it from your OAuth 2.0 Client ID settings' },
  ],
  nextauth: [
    { key: 'NEXTAUTH_URL', label: 'NextAuth URL', placeholder: 'Your application URL', type: 'text', description: 'The URL of your application (automatically set to your project URL)' },
    { key: 'NEXTAUTH_SECRET', label: 'NextAuth Secret', placeholder: 'Click Generate to create a secure secret', type: 'password', description: 'A random string used to hash tokens, sign cookies and generate cryptographic keys' },
    { key: 'DATABASE_URL', label: 'Database URL', placeholder: 'postgresql://...', type: 'text', description: 'Already configured if you\'re using the project database' },
  ]
};

export default function AuthConfigurationPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [authVars, setAuthVars] = useState<AuthVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('github');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [projectUrl, setProjectUrl] = useState('');

  const tabs = [
    { id: 'github', label: 'GitHub OAuth', icon: GithubIcon },
    { id: 'google', label: 'Google OAuth', icon: ChromeIcon },
    { id: 'nextauth', label: 'NextAuth Settings', icon: Key },
  ];

  const fetchAuthVariables = async () => {
    try {
      const data = await GET<{
        auth: AuthVariable[];
      }>(`/api/projects/${projectId}/environment`);

      // Load auth environment variables
      const authVariables = data.auth || [];
      setAuthVars(authVariables);

      // Set project URL from NEXTAUTH_URL or generate default
      const nextauthUrl = authVariables.find(v => v.key === 'NEXTAUTH_URL')?.value;
      if (nextauthUrl) {
        setProjectUrl(nextauthUrl);
      } else {
        // Generate default project URL if not set
        setProjectUrl(`https://sandbox-${projectId}.dgkwlntjskms.usw.sealos.io`);
      }
    } catch (error) {
      console.error('Error fetching auth variables:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to load auth configuration: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthVariables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
    updateAuthVar('NEXTAUTH_SECRET', secret);
  };

  const updateAuthVar = (key: string, value: string) => {
    setAuthVars(prev => {
      const existing = prev.find(v => v.key === key);
      if (existing) {
        return prev.map(v => v.key === key ? { ...v, value } : v);
      } else {
        return [...prev, { key, value }];
      }
    });
  };

  const getAuthVarValue = (key: string) => {
    const variable = authVars.find(v => v.key === key);
    return variable?.value || '';
  };

  const saveAuthConfiguration = async () => {
    setSaving(true);

    try {
      // Ensure NEXTAUTH_URL is set
      if (!getAuthVarValue('NEXTAUTH_URL')) {
        updateAuthVar('NEXTAUTH_URL', projectUrl);
      }

      await POST(`/api/projects/${projectId}/environment`, {
        variables: authVars.filter((env) => env.key && env.value).map(env => ({
          ...env,
          category: 'auth',
          isSecret: env.key.includes('SECRET') || env.key.includes('CLIENT_SECRET')
        }))
      });

      toast.success('Auth configuration saved successfully');
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error('Error saving auth configuration:', error);
      toast.error('Failed to save auth configuration');
    } finally {
      setSaving(false);
    }
  };

  const copyCallbackUrl = (provider: string) => {
    const callbackUrl = `${projectUrl}/api/auth/callback/${provider}`;
    copyToClipboard(callbackUrl, `callback-${provider}`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-content-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Spinner className="h-5 w-5" />
          <span>Loading auth configuration...</span>
        </div>
      </div>
    );
  }

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
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
                    <GithubIcon className="h-5 w-5" />
                    GitHub OAuth Configuration
                  </CardTitle>
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
                <CardDescription className="text-muted-foreground">
                  Configure GitHub OAuth authentication for your application
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                {AUTH_VARIABLES.github.map((variable) => (
                  <div key={variable.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">{variable.label}</label>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                          {variable.key}
                        </code>
                        <button
                          onClick={() => copyToClipboard(variable.key, `env-${variable.key}`)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedId === `env-${variable.key}` ? (
                            <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type={variable.type}
                        placeholder={variable.placeholder}
                        value={getAuthVarValue(variable.key)}
                        onChange={(e) => updateAuthVar(variable.key, e.target.value)}
                        className="flex-1 bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                      />
                      {variable.type === 'password' && (
                        <button
                          onClick={() => toggleSecret(variable.key)}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showSecrets[variable.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0">{variable.description}</p>
                  </div>
                ))}

                {/* Callback URL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Authorization Callback URL</label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                        GITHUB_CALLBACK_URL
                      </code>
                      <button
                        onClick={() => copyToClipboard('GITHUB_CALLBACK_URL', 'env-callback-github')}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === 'env-callback-github' ? (
                          <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={`${projectUrl}/api/auth/callback/github`}
                      readOnly
                      className="flex-1 bg-input border-border text-muted-foreground font-mono text-sm"
                    />
                    <Button
                      onClick={() => copyCallbackUrl('github')}
                      variant="outline"
                      size="sm"
                      className="border-border text-foreground hover:bg-accent transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0">
                    Copy this URL and add it to your OAuth app&apos;s callback URLs
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <Button 
                    onClick={saveAuthConfiguration}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Setup Instructions */}
            <Card className="bg-card border-border shadow-sm p-6">
              <h3 className="text-sm font-medium text-foreground mb-4">Setup Instructions:</h3>
              <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
                <li>Go to GitHub Settings → Developer settings → OAuth Apps</li>
                <li>Click &quot;New OAuth App&quot; or select an existing app</li>
                <li>Set the Homepage URL and Authorization callback URL from above</li>
                <li>Copy the Client ID and Client Secret to the fields above</li>
                <li>Save your changes</li>
              </ol>
            </Card>
          </div>
        )}

        {/* Google OAuth */}
        {activeTab === 'google' && (
          <div className="mx-auto space-y-6">
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
                    <ChromeIcon className="h-5 w-5" />
                    Google OAuth Configuration
                  </CardTitle>
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
                <CardDescription className="text-muted-foreground">
                  Configure Google OAuth authentication for your application
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                {AUTH_VARIABLES.google.map((variable) => (
                  <div key={variable.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">{variable.label}</label>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                          {variable.key}
                        </code>
                        <button
                          onClick={() => copyToClipboard(variable.key, `env-${variable.key}`)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedId === `env-${variable.key}` ? (
                            <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type={variable.type}
                        placeholder={variable.placeholder}
                        value={getAuthVarValue(variable.key)}
                        onChange={(e) => updateAuthVar(variable.key, e.target.value)}
                        className="flex-1 bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                      />
                      {variable.type === 'password' && (
                        <button
                          onClick={() => toggleSecret(variable.key)}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showSecrets[variable.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0">{variable.description}</p>
                  </div>
                ))}

                {/* Callback URL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      Authorized Redirect URI
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                        GOOGLE_CALLBACK_URL
                      </code>
                      <button
                        onClick={() => copyToClipboard('GOOGLE_CALLBACK_URL', 'env-callback-google')}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === 'env-callback-google' ? (
                          <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={`${projectUrl}/api/auth/callback/google`}
                      readOnly
                      className="flex-1 bg-input border-border text-muted-foreground font-mono text-sm"
                    />
                    <Button
                      onClick={() => copyCallbackUrl('google')}
                      variant="outline"
                      size="sm"
                      className="border-border text-foreground hover:bg-accent transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0">
                    Copy this URL and add it to your OAuth client&apos;s authorized redirect URIs
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <Button 
                    onClick={saveAuthConfiguration}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Setup Instructions */}
            <Card className="bg-card border-border shadow-sm p-6">
              <h3 className="text-sm font-medium text-foreground mb-4">Setup Instructions:</h3>
              <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
                <li>Go to Google Cloud Console → APIs & Services → Credentials</li>
                <li>Click &quot;Create Credentials&quot; → &quot;OAuth client ID&quot;</li>
                <li>Choose &quot;Web application&quot; as the application type</li>
                <li>Add the Authorized JavaScript origins and redirect URIs from above</li>
                <li>Copy the Client ID and Client Secret to the fields above</li>
                <li>Enable the Google+ API in your project</li>
              </ol>
            </Card>
          </div>
        )}

        {/* NextAuth Settings */}
        {activeTab === 'nextauth' && (
          <div className="mx-auto space-y-6">
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  NextAuth Configuration
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Configure NextAuth.js settings for your application
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                {AUTH_VARIABLES.nextauth.map((variable) => (
                  <div key={variable.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">{variable.label}</label>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                          {variable.key}
                        </code>
                        <button
                          onClick={() => copyToClipboard(variable.key, `env-${variable.key}`)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedId === `env-${variable.key}` ? (
                            <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    {variable.key === 'NEXTAUTH_URL' ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={projectUrl}
                          readOnly
                          className="flex-1 bg-input border-border text-muted-foreground font-mono text-sm"
                        />
                        <Button
                          onClick={() => updateAuthVar('NEXTAUTH_URL', projectUrl)}
                          variant="outline"
                          size="sm"
                          className="border-border text-foreground hover:bg-accent transition-colors"
                        >
                          Set URL
                        </Button>
                      </div>
                    ) : variable.key === 'NEXTAUTH_SECRET' ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type={showSecrets['NEXTAUTH_SECRET'] ? 'text' : 'password'}
                          placeholder={variable.placeholder}
                          value={getAuthVarValue('NEXTAUTH_SECRET')}
                          onChange={(e) => updateAuthVar('NEXTAUTH_SECRET', e.target.value)}
                          className="flex-1 bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                        />
                        <button
                          onClick={() => toggleSecret('NEXTAUTH_SECRET')}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showSecrets['NEXTAUTH_SECRET'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <Button
                          onClick={generateSecret}
                          variant="outline"
                          size="sm"
                          className="border-border text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Generate
                        </Button>
                      </div>
                    ) : (
                      <Input
                        type={variable.type}
                        placeholder={variable.placeholder}
                        value={getAuthVarValue(variable.key)}
                        onChange={(e) => updateAuthVar(variable.key, e.target.value)}
                        className="flex-1 bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                      />
                    )}
                    <p className="text-xs text-muted-foreground mt-0">{variable.description}</p>
                  </div>
                ))}

                <div className="mt-6 pt-4 border-t border-border">
                  <Button 
                    onClick={saveAuthConfiguration}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Important Notes */}
            <Card className="bg-card border-border shadow-sm p-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">Important Notes:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>The NextAuth URL must match your application&apos;s URL exactly</li>
                    <li>The secret should be a random string at least 32 characters long</li>
                    <li>Never commit your NEXTAUTH_SECRET to version control</li>
                    <li>In production, use a strong, unique secret for security</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}