'use client'

import { createConfig, http } from 'wagmi'
import { base, baseSepolia, celo, celoAlfajores } from 'wagmi/chains'
import { baseAccount } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

const ROOT_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blink-tip.vercel.app';

export const wagmiConfig = createConfig({
  chains: [
    // EVM chains (Base and Celo)
    base,
    baseSepolia,
    celo,
    celoAlfajores,
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
  connectors: [
    // Auto-connects when opened in Farcaster/Base App
    farcasterMiniApp(),
    // Base Account connector
    baseAccount({
      appName: 'BlinkTip',
      appLogoUrl: `${ROOT_URL}/icon.png`,
    })
  ],
})
