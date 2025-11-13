/**
 * Payment Configuration Page
 * Configure payment providers (Stripe, PayPal)
 * VSCode Dark Modern style
 */

'use client';

import { CreditCard, DollarSign, ExternalLink } from 'lucide-react';
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
              <CreditCard className="h-5 w-5 text-[#3794ff]" />
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
              <DollarSign className="h-5 w-5 text-[#3794ff]" />
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
