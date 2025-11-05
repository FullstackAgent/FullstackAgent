import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  compress: true,
  /* config options here */
  serverExternalPackages: ['pino'],
}

export default nextConfig
