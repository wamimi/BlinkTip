import type { NextConfig } from 'next'
import webpack from 'webpack'

const nextConfig: NextConfig = {
  experimental: {
    optimizeCss: false,
  },
  
  // Tell Vercel to use ONLY linux binaries
  output: 'standalone',
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.giphy.com',
      },
    ],
  },
  
  // Externalize heavy server packages
  serverExternalPackages: [
    'pino', 
    'thread-stream', 
    'pino-pretty', 
    '@walletconnect/logger',
    '@solana/web3.js',
    '@solana/spl-token',
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-wallets',
    '@coinbase/cdp-sdk',
    'thirdweb',
    '@langchain/core',
    '@langchain/openai',
  ],
  
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

  // NUCLEAR EXCLUSIONS - exclude ALL platform-specific and heavy deps
  outputFileTracingExcludes: {
    '*': [
      // Mac-specific binaries (CRITICAL - these are causing bloat!)
      'node_modules/@next/swc-darwin-arm64/**',
      'node_modules/@img/sharp-libvips-darwin-arm64/**',
      'node_modules/lightningcss-darwin-arm64/**',
      'node_modules/@tailwindcss/oxide-darwin-arm64/**',
      'node_modules/@unrs/resolver-binding-darwin-arm64/**',
      'node_modules/**/*-darwin-arm64*/**',
      'node_modules/**/*-darwin-x64*/**',
      
      // Build tools
      'node_modules/@swc/**',
      'node_modules/@esbuild/**',
      'node_modules/**/test/**',
      'node_modules/**/*.test.*',
      
      // ALL Solana packages (we'll include only for specific routes)
      'node_modules/@solana/**',
      'node_modules/@coinbase/**',
      'node_modules/thirdweb/**',
      'node_modules/@thirdweb-dev/**',
      'node_modules/@reown/**',
      'node_modules/@walletconnect/**',
      'node_modules/@langchain/**',
      'node_modules/langchain/**',
      'node_modules/@radix-ui/**',
      'node_modules/react-modal/**',
      'node_modules/@trezor/**',
      'node_modules/usb/**',
      
      // Unnecessary files
      'node_modules/**/*.md',
      'node_modules/**/*.d.ts',
      'node_modules/**/*.map',
      'node_modules/**/LICENSE*',
      'node_modules/**/README*',
      'node_modules/**/.github/**',
      'node_modules/**/docs/**',
      'node_modules/**/examples/**',
    ],
  },

  // Include native modules but ONLY Linux ones
  outputFileTracingIncludes: {
    '/': [
      'node_modules/**/*-linux-*.node',
      'node_modules/**/binding/linux-*.node',
    ],
  },

  webpack: (config, { isServer }) => {
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
      // Externalize EVERYTHING heavy on server side
      config.externals.push(
        'pino-pretty', 
        'lokijs', 
        'encoding',
        '@solana/web3.js',
        '@solana/spl-token',
        '@solana/wallet-adapter-base',
        '@coinbase/cdp-sdk',
        'thirdweb',
        '@langchain/core',
        '@langchain/openai'
      )
    }

    config.module.rules.push({
      test: /[\\/]node_modules[\\/].*[\\/]test[\\/]/,
      use: 'null-loader',
    })

    return config
  },
}

export default nextConfig