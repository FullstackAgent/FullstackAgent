import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['pino'],
  // Note: instrumentation.ts is automatically supported in Next.js 15+
  // No additional config needed
}

export default nextConfig
