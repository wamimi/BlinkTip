'use client'

import { createConfig, http } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { baseAccount } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

const ROOT_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blink-tip.vercel.app';

// Miniapp wagmi config - Base chains only
export const wagmiConfigMiniApp = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  connectors: [
    farcasterMiniApp(),
    baseAccount({
      appName: 'BlinkTip',
      appLogoUrl: `${ROOT_URL}/icon.png`,
    })
  ],
})
