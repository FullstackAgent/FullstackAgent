import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  compress: true,
  // Exclude server-side packages from bundling
  // Next.js 15 automatically handles @prisma/client, but we explicitly list it for clarity
  serverExternalPackages: ['pino', '@prisma/client'],
}

export default nextConfig
