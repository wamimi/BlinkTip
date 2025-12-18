import type { NextConfig } from 'next'
import webpack from 'webpack'

const nextConfig: NextConfig = {
  experimental: {
    optimizeCss: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.giphy.com',
      },
    ],
  },
  // Externalize server-only packages
  serverExternalPackages: ['pino', 'thread-stream', 'pino-pretty', '@walletconnect/logger'],
  // Configure Turbopack to handle server-only modules
  turbopack: {
    resolveAlias: {
      // Stub out server-only modules for client builds - use @ alias
      'pino': '@/lib/empty-module.js',
      'thread-stream': '@/lib/empty-module.js',
      'pino-pretty': '@/lib/empty-module.js',
      '@walletconnect/logger': '@/lib/empty-module.js',
      // Also stub the nested imports
      'pino/file': '@/lib/empty-module.js',
      'pino/stream': '@/lib/empty-module.js',
    },
    resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },

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

  webpack: (config, { isServer }) => {
    // Exclude server-only modules from client bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        http: false,
        https: false,
        zlib: false,
      }

      // Replace server-only modules with empty stubs for client builds
      const stubPath = require.resolve('./lib/webpack-stubs.js')
      config.resolve.alias = {
        ...config.resolve.alias,
        'pino': stubPath,
        'thread-stream': stubPath,
        'pino-pretty': stubPath,
        // Also handle nested imports
        'pino/file': stubPath,
        'pino/stream': stubPath,
      }

      // Use NormalModuleReplacementPlugin for more reliable replacement
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^pino$/, stubPath),
        new webpack.NormalModuleReplacementPlugin(/^thread-stream$/, stubPath),
        new webpack.NormalModuleReplacementPlugin(/^pino-pretty$/, stubPath),
        // Also use IgnorePlugin as a fallback
        new webpack.IgnorePlugin({
          checkResource(resource: string) {
            // Match pino and thread-stream imports from node_modules
            if (/[\\/]node_modules[\\/].*(pino|thread-stream|pino-pretty)([\\/]|$)/.test(resource)) {
              return true
            }
            return false
          },
        })
      )
    } else {
      // For server builds, just externalize the usual suspects
      config.externals.push('pino-pretty', 'lokijs', 'encoding')
    }

    // Ignore all files in test directories
    config.module.rules.push({
      test: /[\\/]node_modules[\\/].*[\\/]test[\\/]/,
      use: 'null-loader',
    })

    return config
  },
}

export default nextConfig
