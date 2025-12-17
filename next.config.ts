import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.giphy.com',
      },
    ],
  },
  // Empty turbopack config to acknowledge we're using Turbopack
  turbopack: {},

  // Exclude problematic test files from output
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
      '**/node_modules/**/test/**',
      '**/node_modules/**/*.test.js',
      '**/node_modules/**/*.test.ts',
      '**/node_modules/**/*.test.mjs',
    ],
  },

  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')

    // Ignore all files in test directories
    config.module.rules.push({
      test: /[\\/]node_modules[\\/].*[\\/]test[\\/]/,
      use: 'null-loader',
    })

    return config
  },
}

export default nextConfig
