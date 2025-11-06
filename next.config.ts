import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  compress: true,
  // Exclude server-side packages from bundling
  serverExternalPackages: ['pino'],
}

export default nextConfig
