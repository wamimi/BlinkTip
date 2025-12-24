'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@/config/wagmi'
import { MiniAppProvider } from '@/context/miniapp'
import type { ReactNode } from 'react'

const queryClient = new QueryClient()

export function MiniAppWagmiProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MiniAppProvider>
          {children}
        </MiniAppProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
