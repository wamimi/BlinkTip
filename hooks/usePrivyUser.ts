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
    // useWallets() returns ConnectedWallet[] which extends BaseConnectedEthereumWallet.
    // Identify the embedded EVM wallet by walletClientType.
    const evmWallet = wallets.find(
      (w) => w.walletClientType === 'privy' || w.walletClientType === 'privy-v2'
    )

    // Solana embedded wallets are not in useWallets(); find them via user.linkedAccounts.
    // WalletWithMetadata has chainType: 'ethereum' | 'solana'
    const solanaAccount = user?.linkedAccounts?.find(
      (account) =>
        account.type === 'wallet' &&
        'chainType' in account &&
        account.chainType === 'solana' &&
        'walletClientType' in account &&
        (account.walletClientType === 'privy' || account.walletClientType === 'privy-v2')
    )
    const solanaWalletAddress =
      solanaAccount && 'address' in solanaAccount ? (solanaAccount.address as string) : null

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
      solanaWallet: solanaWalletAddress,
      login,
      logout,
    }
  }, [ready, authenticated, user, wallets, login, logout])

  return data
}
