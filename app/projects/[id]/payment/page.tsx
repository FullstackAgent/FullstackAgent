'use client';

import { useEffect, useState } from 'react';
import { DollarSign, ExternalLink, Save, Zap } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { GET, POST } from '@/lib/fetch-client';

interface PaymentVariable {
  id?: string;
  key: string;
  value: string;
}

const PAYMENT_VARIABLES = {
  stripe: [
    { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key', placeholder: 'pk_test_...', type: 'text', description: 'Public key used in client-side code' },
    { key: 'STRIPE_SECRET_KEY', label: 'Secret Key', placeholder: 'sk_test_...', type: 'password', description: 'Secret key for server-side operations' },
    { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', placeholder: 'whsec_...', type: 'password', description: 'Secret for verifying webhook signatures' },
  ],
  paypal: [
    { key: 'PAYPAL_CLIENT_ID', label: 'Client ID', placeholder: 'Enter PayPal Client ID', type: 'text', description: 'PayPal client identifier for your application' },
    { key: 'PAYPAL_CLIENT_SECRET', label: 'Client Secret', placeholder: 'Enter PayPal Client Secret', type: 'password', description: 'Secret key for PayPal API authentication' },
  ]
};

export default function PaymentConfigurationPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [paymentVars, setPaymentVars] = useState<PaymentVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPaymentVariables = async () => {
    try {
      const data = await GET<{
        payment: PaymentVariable[];
      }>(`/api/projects/${projectId}/environment`);

      // Load payment environment variables
      const paymentVariables = data.payment || [];
      setPaymentVars(paymentVariables);
    } catch (error) {
      console.error('Error fetching payment variables:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to load payment configuration: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentVariables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const updatePaymentVar = (key: string, value: string) => {
    setPaymentVars(prev => {
      const existing = prev.find(v => v.key === key);
      if (existing) {
        return prev.map(v => v.key === key ? { ...v, value } : v);
      } else {
        return [...prev, { key, value }];
      }
    });
  };

  const savePaymentConfiguration = async () => {
    setSaving(true);

    try {
      await POST(`/api/projects/${projectId}/environment`, {
        variables: paymentVars.filter((env) => env.key && env.value).map(env => ({
          ...env,
          category: 'payment',
          isSecret: env.key.includes('SECRET')
        }))
      });

      toast.success('Payment configuration saved successfully');
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error('Error saving payment configuration:', error);
      toast.error('Failed to save payment configuration');
    } finally {
      setSaving(false);
    }
  };

  const getPaymentVarValue = (key: string) => {
    const variable = paymentVars.find(v => v.key === key);
    return variable?.value || '';
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-content-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Spinner className="h-5 w-5" />
          <span>Loading payment configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-content-background">
      {/* VSCode-style Header Panel */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">Payment Configuration</h1>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              Configure payment processing for your application
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto space-y-6">
          {/* Stripe Configuration */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Stripe Configuration
                </CardTitle>
                <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  Stripe Dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <CardDescription className="text-muted-foreground">
                Configure Stripe payment processing for your application
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {PAYMENT_VARIABLES.stripe.map((variable) => (
                <div key={variable.key}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">{variable.label}</label>
                      <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                        {variable.key}
                      </code>
                    </div>
                    <Input
                      type={variable.type}
                      placeholder={variable.placeholder}
                      value={getPaymentVarValue(variable.key)}
                      onChange={(e) => updatePaymentVar(variable.key, e.target.value)}
                      className="bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0">{variable.description}</p>
                </div>
              ))}

              <div className="mt-6 pt-4 border-t border-border">
                <Button 
                  onClick={savePaymentConfiguration}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* PayPal Configuration */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  PayPal Configuration
                </CardTitle>
                <a
                  href="https://developer.paypal.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  PayPal Developer
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <CardDescription className="text-muted-foreground">
                Configure PayPal payment processing for your application
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {PAYMENT_VARIABLES.paypal.map((variable) => (
                <div key={variable.key}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">{variable.label}</label>
                      <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                        {variable.key}
                      </code>
                    </div>
                    <Input
                      type={variable.type}
                      placeholder={variable.placeholder}
                      value={getPaymentVarValue(variable.key)}
                      onChange={(e) => updatePaymentVar(variable.key, e.target.value)}
                      className="bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0">{variable.description}</p>
                </div>
              ))}
              <div className="mt-6 pt-4 border-t border-border">
                <Button 
                  onClick={savePaymentConfiguration}
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
            <h3 className="text-sm font-medium text-foreground mb-4">Quick Setup Guide:</h3>
            <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
              <li>Create accounts on Stripe and/or PayPal developer platforms</li>
              <li>Generate API keys from your dashboard</li>
              <li>Add the keys to your environment configuration above</li>
              <li>Configure webhook endpoints for payment events</li>
              <li>Test with sandbox/test mode before going live</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
