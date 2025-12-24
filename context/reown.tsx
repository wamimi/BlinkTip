'use client'

import { wagmiAdapter, solanaAdapter, projectId, evmNetworks, solanaNetworks } from '@/config/reown'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { baseSepolia } from '@reown/appkit/networks'
import { type ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

const queryClient = new QueryClient()

const metadata = {
  name: 'BlinkTip',
  description: 'Universal tip link for creators. Get tipped by humans and AI agents.',
  url: 'https://blink-tip.vercel.app',
  icons: ['https://blink-tip.vercel.app/icon.png']
}

if (!projectId) {
  throw new Error('NEXT_PUBLIC_REOWN_PROJECT_ID is not set')
}

createAppKit({
  adapters: [wagmiAdapter, solanaAdapter],
  projectId,
  networks: [...evmNetworks, ...solanaNetworks] as any, // Combined testnet networks
  defaultNetwork: baseSepolia, // Default to Base Sepolia testnet
  metadata,
  features: {
    analytics: true,
    email: true,
    socials: ['google', 'github', 'discord', 'apple'],
    emailShowWallets: true,
  },
  allWallets: 'SHOW',
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#8B5CF6',
  }
})

export function ReownProvider({
  children,
  cookies
}: {
  children: ReactNode
  cookies: string | null
}) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
