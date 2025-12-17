import type { NextConfig } from 'next'
import webpack from 'webpack'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.giphy.com',
      },
    ],
  },
  // Configure Turbopack to handle server-only modules
  turbopack: {
    resolveAlias: {
      // Stub out server-only modules for client builds
      'pino': './lib/webpack-stubs.js',
      'thread-stream': './lib/webpack-stubs.js',
      'pino-pretty': './lib/webpack-stubs.js',
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
      }

      // Replace server-only modules with empty stubs for client builds
      const stubPath = require.resolve('./lib/webpack-stubs.js')
      config.resolve.alias = {
        ...config.resolve.alias,
        'pino': stubPath,
        'thread-stream': stubPath,
        'pino-pretty': stubPath,
      }

      // Also use IgnorePlugin as a fallback for any remaining imports
      config.plugins.push(
        new webpack.IgnorePlugin({
          checkResource(resource: string) {
            // Match pino and thread-stream imports
            return /[\\/](pino|thread-stream|pino-pretty)([\\/]|$)/.test(resource)
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
