/**
 * Payment Configuration Page
 * Configure payment providers (Stripe, PayPal)
 * VSCode Dark Modern style
 */

'use client';

import { ExternalLink } from 'lucide-react';
import { useParams } from 'next/navigation';

import { ConfigLayout } from '@/components/config/config-layout';
import { EnvVarSection } from '@/components/config/env-var-section';
import {
  useBatchUpdateEnvironmentVariables,
  useEnvironmentVariables,
} from '@/hooks/use-environment-variables';
import { useProject } from '@/hooks/use-project';

function PaymentPageContent() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: envData, isLoading: envLoading } = useEnvironmentVariables(projectId);
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const batchUpdate = useBatchUpdateEnvironmentVariables(projectId);

  const paymentVars = envData?.payment || [];

  const handleSave = async (
    variables: Array<{ key: string; value: string; isSecret?: boolean }>
  ) => {
    await batchUpdate.mutateAsync({
      category: 'payment',
      variables,
    });
  };

  // Stripe templates
  const stripeTemplates = [
    {
      key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      label: 'Publishable Key',
      placeholder: 'pk_test_...',
      isSecret: false,
      description: 'Public key used in client-side code (starts with pk_)',
    },
    {
      key: 'STRIPE_SECRET_KEY',
      label: 'Secret Key',
      placeholder: 'sk_test_...',
      isSecret: true,
      description: 'Secret key for server-side operations (starts with sk_)',
    },
    {
      key: 'STRIPE_WEBHOOK_SECRET',
      label: 'Webhook Secret',
      placeholder: 'whsec_...',
      isSecret: true,
      description: 'Secret for verifying webhook signatures (starts with whsec_)',
    },
  ];

  // PayPal templates
  const paypalTemplates = [
    {
      key: 'PAYPAL_CLIENT_ID',
      label: 'Client ID',
      placeholder: 'Enter PayPal Client ID',
      isSecret: false,
      description: 'PayPal client identifier for your application',
    },
    {
      key: 'PAYPAL_CLIENT_SECRET',
      label: 'Client Secret',
      placeholder: 'Enter PayPal Client Secret',
      isSecret: true,
      description: 'Secret key for PayPal API authentication',
    },
  ];

  return (
    <ConfigLayout
      title="Payment Configuration"
      description="Configure payment providers for your application"
      loading={envLoading || projectLoading}
    >
      <div className="space-y-8">
        {/* Stripe Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground"><title>Stripe</title><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" fill="currentColor"/></svg>
              <h2 className="text-base font-medium text-[#cccccc]">Stripe</h2>
            </div>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#3794ff] hover:text-[#4fc1ff] flex items-center gap-1.5 transition-colors"
            >
              Stripe Dashboard
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <EnvVarSection
            title=""
            variables={paymentVars}
            templates={stripeTemplates}
            sandboxes={project?.sandboxes || []}
            onSave={handleSave}
            saving={batchUpdate.isPending}
          />

          {/* Setup Instructions */}
          <div className="mt-4 p-4 bg-[#252526] border border-[#3e3e42] rounded">
            <h3 className="text-xs font-medium text-[#cccccc] mb-2">Setup Instructions</h3>
            <ol className="text-xs text-[#858585] space-y-1 list-decimal list-inside">
              <li>Go to Stripe Dashboard → Developers → API keys</li>
              <li>Copy the Publishable key and Secret key</li>
              <li>For webhooks: Developers → Webhooks → Add endpoint</li>
              <li>Configure webhook endpoint and copy the signing secret</li>
            </ol>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[#3e3e42]" />

        {/* PayPal Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground"><title>PayPal</title><path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z" fill="currentColor"/></svg>
              <h2 className="text-base font-medium text-[#cccccc]">PayPal</h2>
            </div>
            <a
              href="https://developer.paypal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#3794ff] hover:text-[#4fc1ff] flex items-center gap-1.5 transition-colors"
            >
              PayPal Developer
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <EnvVarSection
            title=""
            variables={paymentVars}
            templates={paypalTemplates}
            sandboxes={project?.sandboxes || []}
            onSave={handleSave}
            saving={batchUpdate.isPending}
          />

          {/* Setup Instructions */}
          <div className="mt-4 p-4 bg-[#252526] border border-[#3e3e42] rounded">
            <h3 className="text-xs font-medium text-[#cccccc] mb-2">Setup Instructions</h3>
            <ol className="text-xs text-[#858585] space-y-1 list-decimal list-inside">
              <li>Go to PayPal Developer Dashboard</li>
              <li>Navigate to My Apps & Credentials</li>
              <li>Create a new app or select an existing one</li>
              <li>Copy the Client ID and Secret from the app details</li>
            </ol>
          </div>
        </div>
      </div>
    </ConfigLayout>
  );
}

export default PaymentPageContent;
