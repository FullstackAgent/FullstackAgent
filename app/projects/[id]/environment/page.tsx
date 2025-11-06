'use client';

import { useEffect, useState } from 'react';
import { Key, Plus, Save, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Environment Variables</h1>
          <p className="text-muted-foreground">
            Configure custom environment variables for your application
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Key className="h-5 w-5" />
              Custom Environment Variables
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Add your application-specific environment variables. For authentication and payment
              configurations, use their dedicated pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {envVars.map((env, index) => (
              <div key={index} className="grid grid-cols-12 gap-2">
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
                  className="bg-background border-input text-foreground font-mono col-span-4"
                />
                <Input
                  placeholder="Value"
                  value={env.value}
                  onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                  className="bg-background border-input text-foreground col-span-7"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeEnvVar(index)}
                  className="border-border text-foreground hover:bg-accent col-span-1"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {envVars.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No custom environment variables configured yet
              </div>
            )}
            <Button
              onClick={addEnvVar}
              variant="outline"
              className="border-border text-foreground hover:bg-accent"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Variable
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8 flex gap-4">
          <Button
            onClick={saveEnvironment}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Environment'}
          </Button>
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="border-border text-foreground hover:bg-accent"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
