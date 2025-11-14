import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/provider/providers';

import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Fulling - AI-Powered Full-Stack Development',
  description: 'Create, develop, and deploy production-ready web applications using natural language. Powered by ' +
    'Claude Code in isolated sandbox environments.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geist.className} bg-background antialiased`}>
        <Providers>{children}</Providers>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            classNames: {
              toast: 'group',
              title: 'text-[#cccccc] font-normal text-[13px]',
              description: 'text-[#999999] text-xs mt-1',
              actionButton:
                'bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs px-3 py-1.5 rounded ml-2',
              cancelButton:
                'bg-transparent hover:bg-[#3e3e42] text-[#cccccc] text-xs px-3 py-1.5 rounded ml-2',
              closeButton: 'bg-transparent hover:bg-[#3e3e42] text-[#cccccc]',
              error: 'group-[.group]:border-[#454545]',
              success: 'group-[.group]:border-[#454545]',
              warning: 'group-[.group]:border-[#454545]',
              info: 'group-[.group]:border-[#454545]',
              icon: 'group-data-[type=error]:text-[#f48771] group-data-[type=success]:text-[#1177bb] group-data-[type=warning]:text-[#cccccc] group-data-[type=info]:text-[#1177bb]',
            },
          }}
        />
      </body>
    </html>
  );
}
