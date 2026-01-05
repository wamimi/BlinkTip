'use client'

import { OnchainKitProvider as OKProvider } from '@coinbase/onchainkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { base } from 'viem/chains'
import { type ReactNode, useState } from 'react'
import { type State, WagmiProvider } from 'wagmi'
import { wagmiConfigMiniApp } from '@/config/wagmi-miniapp'

export function OnchainKitProvider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: State
}) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfigMiniApp} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <OKProvider chain={base}>
          {children}
        </OKProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
