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
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
