import { CreditCard, DollarSign, ExternalLink, Zap } from 'lucide-react';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function PaymentConfigurationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: id,
      userId: session.user.id,
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
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Header */}
      <div className="border-b border-[#3e3e42] bg-[#252526]">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-400" />
            Payment Configuration
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure payment processing for your application
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Stripe Configuration */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-400" />
                Stripe Configuration
              </h2>
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Stripe Dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Publishable Key</label>
                  <code className="text-xs bg-[#1e1e1e] px-2 py-1 rounded text-blue-400">
                    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                  </code>
                </div>
                <input
                  type="text"
                  placeholder="pk_test_..."
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-sm text-gray-300 font-mono"
                />
                <p className="text-xs text-gray-400">Public key used in client-side code</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Secret Key</label>
                  <code className="text-xs bg-[#1e1e1e] px-2 py-1 rounded text-blue-400">
                    STRIPE_SECRET_KEY
                  </code>
                </div>
                <input
                  type="password"
                  placeholder="sk_test_..."
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-sm text-gray-300 font-mono"
                />
                <p className="text-xs text-gray-400">Secret key for server-side operations</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Webhook Secret</label>
                  <code className="text-xs bg-[#1e1e1e] px-2 py-1 rounded text-blue-400">
                    STRIPE_WEBHOOK_SECRET
                  </code>
                </div>
                <input
                  type="password"
                  placeholder="whsec_..."
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-sm text-gray-300 font-mono"
                />
                <p className="text-xs text-gray-400">Secret for verifying webhook signatures</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#3e3e42]">
              <button className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors">
                Save Stripe Configuration
              </button>
            </div>
          </div>

          {/* PayPal Configuration */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-400" />
                PayPal Configuration
              </h2>
              <a
                href="https://developer.paypal.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                PayPal Developer
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Client ID</label>
                  <code className="text-xs bg-[#1e1e1e] px-2 py-1 rounded text-blue-400">
                    PAYPAL_CLIENT_ID
                  </code>
                </div>
                <input
                  type="text"
                  placeholder="Enter PayPal Client ID"
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-sm text-gray-300 font-mono"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Client Secret</label>
                  <code className="text-xs bg-[#1e1e1e] px-2 py-1 rounded text-blue-400">
                    PAYPAL_CLIENT_SECRET
                  </code>
                </div>
                <input
                  type="password"
                  placeholder="Enter PayPal Client Secret"
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-sm text-gray-300 font-mono"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#3e3e42]">
              <button className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors">
                Save PayPal Configuration
              </button>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Setup Guide:</h3>
            <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside">
              <li>Create accounts on Stripe and/or PayPal developer platforms</li>
              <li>Generate API keys from your dashboard</li>
              <li>Add the keys to your environment configuration above</li>
              <li>Configure webhook endpoints for payment events</li>
              <li>Test with sandbox/test mode before going live</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
