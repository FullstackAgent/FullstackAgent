'use client';

import { useEffect, useState } from 'react';
import { Key, Plus, Save, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { GET, POST } from '@/lib/fetch-client';

interface EnvVariable {
  id?: string;
  key: string;
  value: string;
}

export default function EnvironmentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchEnvironmentVariables = async () => {
    try {
      const data = await GET<{
        general: EnvVariable[];
        auth: EnvVariable[];
        payment: EnvVariable[];
      }>(`/api/projects/${projectId}/environment`);

      // Load all general environment variables
      const generalVars = data.general || [];
      setEnvVars(generalVars);
    } catch (error) {
      console.error('Error fetching environment variables:', error);
      toast.error('Failed to load environment variables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnvironmentVariables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: keyof EnvVariable, value: string) => {
    const updated = [...envVars];
    updated[index] = { ...updated[index], [field]: value };
    setEnvVars(updated);
  };

  const saveEnvironment = async () => {
    setSaving(true);

    // Only save general environment variables
    const allVars: EnvVariable[] = envVars.filter((env) => env.key && env.value);

    try {
      await POST(`/api/projects/${projectId}/environment`, { variables: allVars });

      toast.success('Environment variables saved successfully');
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error('Error saving environment variables:', error);
      toast.error('Failed to save environment variables');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-content-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Spinner className="h-5 w-5" />
          <span>Loading environment variables...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-content-background">
      {/* VSCode-style Header Panel */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">Environment Variables</h1>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              Configure custom environment variables for your application
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto">
          {/* Main Card */}
          <Card className="bg-card border-border shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Custom Environment Variables
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Add your application-specific environment variables. For authentication and payment
              configurations, use their dedicated pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 min-h-[200px] flex flex-col">
            <div className="space-y-3 flex-1">
              {envVars.map((env, index) => (
                <div key={index} className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-12 md:col-span-4">
                    <Input
                      placeholder="KEY"
                      value={env.key}
                      onChange={(e) =>
                        updateEnvVar(
                          index,
                          'key',
                          e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
                        )
                      }
                      className="bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-7">
                    <Input
                      placeholder="Value"
                      value={env.value}
                      onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                      className="bg-input border-border text-foreground text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEnvVar(index)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors md:w-auto w-full"
                      title="Remove variable"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {envVars.length === 0 && (
              <div className="text-center py-4">
                <div className="mx-auto w-10 h-10 bg-muted rounded-full flex items-center justify-center mb-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">No environment variables</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add your first environment variable to get started
                </p>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-border">
              <Button
                onClick={addEnvVar}
                variant="outline"
                className="border-border text-foreground hover:bg-accent transition-colors"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Variable
              </Button>
            </div>
          </CardContent>
        </Card>

          {/* Footer Actions */}
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {envVars.length > 0 && (
                <span>{envVars.length} environment variable{envVars.length !== 1 ? 's' : ''} configured</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => router.back()}
                variant="outline"
                className="border-border text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={saveEnvironment}
                disabled={saving || envVars.length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
