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

      // Switch to Base Sepolia
      await baseAccountProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }],
      })

      // Try wallet_connect with Sign-In with Ethereum (SIWE) first
      try {
        const response = await baseAccountProvider.request({
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
        }) as {
          accounts: Array<{
            address: string
            capabilities: {
              signInWithEthereum: {
                message: string
                signature: string
              }
            }
          }>
        }

        const { address } = response.accounts[0]
        const { message, signature } = response.accounts[0].capabilities.signInWithEthereum

        return { address, message, signature }
      } catch (walletConnectError: any) {
        // Fallback to personal_sign if wallet_connect is not supported
        if (walletConnectError.message?.includes('not supported') || walletConnectError.code === -32601) {
          console.log('wallet_connect not supported, using personal_sign fallback')

          const accounts = await baseAccountProvider.request({
            method: 'eth_requestAccounts',
          }) as string[]

          if (!accounts || accounts.length === 0) {
            throw new Error('No accounts connected')
          }

          const address = accounts[0]

          // Create simple message for personal_sign
          const message = `Sign in to BlinkTip\n\nWallet: ${address}\nNonce: ${nonce}`

          // Sign with personal_sign (provider handles hex encoding)
          const signature = await baseAccountProvider.request({
            method: 'personal_sign',
            params: [message, address],
          }) as string

          return { address, message, signature }
        }

        // Re-throw if it's a different error
        throw walletConnectError
      }
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
