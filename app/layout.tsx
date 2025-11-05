import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/provider/providers';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FullStack Agent - AI-Powered Development Platform',
  description: 'Create, develop, and deploy full-stack applications with AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-black text-white antialiased`}>
        <Providers>{children}</Providers>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#2d2d30',
              border: '1px solid #454545',
              color: '#cccccc',
              borderRadius: '4px',
              padding: '12px 16px',
              fontSize: '13px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            },
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
