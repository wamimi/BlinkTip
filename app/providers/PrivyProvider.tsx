'use client'

import { PrivyProvider as PrivyAuthProvider } from '@privy-io/react-auth'
import { base, baseSepolia } from 'viem/chains'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

interface PrivyProviderProps {
  children: ReactNode
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!appId) {
    console.warn('NEXT_PUBLIC_PRIVY_APP_ID not set, Privy auth disabled')
    return <>{children}</>
  }

  if (!mounted) {
    return null
  }

  return (
    <PrivyAuthProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#9333ea',
          logo: '/icon.png',
          showWalletLoginFirst: false,
        },
        loginMethods: ['email'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: baseSepolia,
        supportedChains: [base, baseSepolia],
      }}
    >
      {children}
    </PrivyAuthProvider>
  )
}
