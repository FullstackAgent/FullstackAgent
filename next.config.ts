import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  compress: true,
  // Exclude server-side packages from bundling
  // @prisma/client must be external to work properly with binary engines
  serverExternalPackages: ['pino', '@prisma/client'],
}

export default nextConfig
