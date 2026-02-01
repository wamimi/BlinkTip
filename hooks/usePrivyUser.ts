'use client'

import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useMemo } from 'react'

export interface PrivyUserData {
  isAuthenticated: boolean
  isLoading: boolean
  userId: string | null
  email: string | null
  evmWallet: string | null
  solanaWallet: string | null
  login: () => void
  logout: () => Promise<void>
}

export function usePrivyUser(): PrivyUserData {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const { wallets } = useWallets()

  const data = useMemo(() => {
    // Find embedded EVM wallet (created by Privy)
    const evmWallet = wallets.find(
      (w) => w.walletClientType === 'privy' && w.chainType === 'ethereum'
    )

    // Find embedded Solana wallet if available
    const solanaWallet = wallets.find(
      (w) => w.walletClientType === 'privy' && w.chainType === 'solana'
    )

    // Get email from user's linked accounts
    const emailAccount = user?.linkedAccounts?.find(
      (account) => account.type === 'email'
    )
    const email = emailAccount?.type === 'email' ? emailAccount.address : null

    return {
      isAuthenticated: authenticated,
      isLoading: !ready,
      userId: user?.id || null,
      email,
      evmWallet: evmWallet?.address || null,
      solanaWallet: solanaWallet?.address || null,
      login,
      logout,
    }
  }, [ready, authenticated, user, wallets, login, logout])

  return data
}
