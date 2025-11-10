import { DollarSign, ExternalLink, Zap } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function PaymentConfigurationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: id,
      userId: session?.user.id,
    },
    include: {
      environments: {
        where: {
          category: 'payment',
        },
      },
    },
  });

  if (!project) {
    notFound();
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
              <div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Publishable Key</label>
                    <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                    </code>
                  </div>
                  <Input
                    type="text"
                    placeholder="pk_test_..."
                    className="bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-0">Public key used in client-side code</p>
              </div>

              <div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Secret Key</label>
                    <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                      STRIPE_SECRET_KEY
                    </code>
                  </div>
                  <Input
                    type="password"
                    placeholder="sk_test_..."
                    className="bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-0">Secret key for server-side operations</p>
              </div>

              <div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Webhook Secret</label>
                    <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                      STRIPE_WEBHOOK_SECRET
                    </code>
                  </div>
                  <Input
                    type="password"
                    placeholder="whsec_..."
                    className="bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-0">Secret for verifying webhook signatures</p>
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors">
                  Save Stripe Configuration
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
              <div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Client ID</label>
                    <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                      PAYPAL_CLIENT_ID
                    </code>
                  </div>
                  <Input
                    type="text"
                    placeholder="Enter PayPal Client ID"
                    className="bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-0">PayPal client identifier for your application</p>
              </div>

              <div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Client Secret</label>
                    <code className="text-xs bg-accent px-2 py-1 rounded text-primary">
                      PAYPAL_CLIENT_SECRET
                    </code>
                  </div>
                  <Input
                    type="password"
                    placeholder="Enter PayPal Client Secret"
                    className="bg-input border-border text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-0">Secret key for PayPal API authentication</p>
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors">
                  Save PayPal Configuration
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
