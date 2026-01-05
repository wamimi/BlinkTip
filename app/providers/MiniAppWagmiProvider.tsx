'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OnchainKitProvider as OKProvider } from '@coinbase/onchainkit'
import { wagmiConfig } from '@/config/wagmi'
import { wagmiConfigMiniApp } from '@/config/wagmi-miniapp'
import { MiniAppProvider } from '@/context/miniapp'
import { base } from 'viem/chains'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

const queryClient = new QueryClient()

export function MiniAppWagmiProvider({ children }: { children: ReactNode }) {
  const [isInMiniApp, setIsInMiniApp] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    async function checkMiniApp() {
      try {
        const miniAppStatus = await sdk.isInMiniApp()
        setIsInMiniApp(miniAppStatus)
      } catch (error) {
        console.error('Error checking mini app status:', error)
        setIsInMiniApp(false)
      } finally {
        setIsChecking(false)
      }
    }
    checkMiniApp()
  }, [])

  if (isChecking) {
    return null
  }

  if (isInMiniApp) {
    return (
      <WagmiProvider config={wagmiConfigMiniApp}>
        <QueryClientProvider client={queryClient}>
          <OKProvider chain={base}>
            <MiniAppProvider>
              {children}
            </MiniAppProvider>
          </OKProvider>
        </QueryClientProvider>
      </WagmiProvider>
    )
  }

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
