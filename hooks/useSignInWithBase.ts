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
      const timestamp = Date.now()

      // Try wallet_connect first (for Base Account SDK)
      try {
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
      } catch (walletConnectError: any) {
        // Fallback to personal_sign if wallet_connect not supported
        console.log('wallet_connect not supported, using fallback:', walletConnectError.message)

        // Get connected accounts
        const accounts = await baseAccountProvider.request({
          method: 'eth_requestAccounts',
        }) as string[]

        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts connected')
        }

        const address = accounts[0]

        // Create SIWE message
        const message = `Sign in to BlinkTip\n\nWallet: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`

        // Convert message to hex format (required by Base Account SDK)
        const messageHex = `0x${Buffer.from(message, 'utf8').toString('hex')}`

        // Sign with personal_sign
        const signature = await baseAccountProvider.request({
          method: 'personal_sign',
          params: [messageHex, address],
        }) as string

        return { address, message, signature }
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
