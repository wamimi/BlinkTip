import { useState } from 'react'
import { baseAccountProvider } from '@/lib/base-account'

export interface SignInWithBaseResult {
  address: string
  message: string
  signature: string
}

export function useSignInWithBase() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async (): Promise<SignInWithBaseResult | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const nonce = crypto.randomUUID().replace(/-/g, '')

      await baseAccountProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }],
      })

      const { accounts } = await baseAccountProvider.request({
        method: 'wallet_connect',
        params: [
          {
            version: '1',
            capabilities: {
              signInWithEthereum: {
                nonce,
                chainId: '0x2105',
              },
            },
          },
        ],
      }) as any

      const { address } = accounts[0]
      const { message, signature } = accounts[0].capabilities.signInWithEthereum

      return { address, message, signature }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in with Base'
      setError(errorMessage)
      console.error('Sign in with Base failed:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { signIn, isLoading, error }
}
