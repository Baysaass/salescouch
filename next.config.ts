import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite нь WASM ашигладаг тул bundle хийхгүй
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
