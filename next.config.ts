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
  serverExternalPackages: [
    'pino', 
    'thread-stream', 
    'pino-pretty', 
    '@walletconnect/logger',
    // Add heavy crypto/blockchain packages
    '@solana/web3.js',
    '@solana/spl-token',
    '@coinbase/cdp-sdk',
    'thirdweb',
    '@langchain/core',
    '@langchain/openai',
  ],
  
  // Configure Turbopack to handle server-only modules
  turbopack: {
    resolveAlias: {
      'pino': '@/lib/empty-module.js',
      'thread-stream': '@/lib/empty-module.js',
      'pino-pretty': '@/lib/empty-module.js',
      '@walletconnect/logger': '@/lib/empty-module.js',
      'pino/file': '@/lib/empty-module.js',
      'pino/stream': '@/lib/empty-module.js',
    },
    resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },

  // Aggressively exclude large dependencies from function bundles
  outputFileTracingExcludes: {
    '*': [
      // Build tools
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
      '**/node_modules/**/test/**',
      '**/node_modules/**/*.test.js',
      '**/node_modules/**/*.test.ts',
      '**/node_modules/**/*.test.mjs',
      
      // Large blockchain SDKs (exclude from functions that don't need them)
      'node_modules/@solana/web3.js',
      'node_modules/@solana/spl-token',
      'node_modules/@solana/wallet-adapter-*/**',
      'node_modules/@coinbase/**',
      'node_modules/thirdweb/**',
      'node_modules/@thirdweb-dev/**',
      'node_modules/@reown/**',
      'node_modules/@walletconnect/**',
      'node_modules/@langchain/**',
      'node_modules/langchain/**',
      
      // Unnecessary files
      'node_modules/**/*.md',
      'node_modules/**/*.d.ts',
      'node_modules/**/*.map',
      'node_modules/**/LICENSE',
      'node_modules/**/README',
      'node_modules/**/.github',
      'node_modules/**/docs/**',
      'node_modules/**/examples/**',
    ],
    // Only include necessary deps for specific API routes
    '/api/actions/**': [],  // Solana Actions - needs Solana deps
    '/api/x402/**': [],     // X402 protocol - needs CDP/Solana deps
    '/api/agent/**': [],    // AI agent - needs LangChain deps
  },

  // Include native modules for deployment
  outputFileTracingIncludes: {
    '/': ['./node_modules/**/*.node'],
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

      const stubPath = require.resolve('./lib/webpack-stubs.js')
      config.resolve.alias = {
        ...config.resolve.alias,
        'pino': stubPath,
        'thread-stream': stubPath,
        'pino-pretty': stubPath,
        'pino/file': stubPath,
        'pino/stream': stubPath,
      }

      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^pino$/, stubPath),
        new webpack.NormalModuleReplacementPlugin(/^thread-stream$/, stubPath),
        new webpack.NormalModuleReplacementPlugin(/^pino-pretty$/, stubPath),
        new webpack.IgnorePlugin({
          checkResource(resource: string) {
            if (/[\\/]node_modules[\\/].*(pino|thread-stream|pino-pretty)([\\/]|$)/.test(resource)) {
              return true
            }
            return false
          },
        })
      )
    } else {
      // For server builds, externalize heavy packages
      config.externals.push(
        'pino-pretty', 
        'lokijs', 
        'encoding',
        '@solana/web3.js',
        '@solana/spl-token',
        'thirdweb'
      )
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