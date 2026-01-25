'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useWalletClient, useAccount } from 'wagmi'
import { useMiniApp } from '@/context/miniapp'

// Define Creator Type
type Creator = {
  slug: string
  name: string
  bio: string
  avatar_url: string
  wallet_address: string | null
  evm_wallet_address?: string
}

const TIP_AMOUNTS = [1, 2, 5, 10]

export default function TipPage() {
  const params = useParams()
  const slug = params.slug as string

  // Mini App detection
  const { isInMiniApp, user: miniAppUser, walletAddress: miniAppWalletAddress } = useMiniApp()

  // Wagmi hooks
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  // Determine which wallet to use
  const activeAddress = isInMiniApp ? miniAppWalletAddress : address
  const activeConnection = isInMiniApp ? !!miniAppWalletAddress : isConnected

  const [creator, setCreator] = useState<Creator | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChain] = useState<'solana' | 'base'>('base')
  const [amount, setAmount] = useState<number | ''>(5)
  const [tipping, setTipping] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Miniapp only supports Base (EVM) but keep logic for both chains for future web app restoration
  const isEVMConnection = selectedChain === 'base'
  const isSolanaConnection = selectedChain === 'solana'

  useEffect(() => {
    async function fetchCreator() {
      try {
        const response = await fetch(`/api/creators?slug=${slug}`)
        if (!response.ok) throw new Error('Creator not found')
        const data = await response.json()
        setCreator(data.creator)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    fetchCreator()
  }, [slug])

  const handleTip = async () => {
    setTipping(true)
    setError(null)
    setTxSignature(null)

    try {
      const tipAmount = typeof amount === 'string' ? parseFloat(amount) : amount
      if (!tipAmount || tipAmount <= 0) throw new Error('Invalid amount')
      if (!activeAddress || !activeConnection) throw new Error('Please connect your wallet')

      if (selectedChain === 'solana') {
        if (!creator?.wallet_address) throw new Error('Creator does not accept Solana tips yet')

        if (!isSolanaConnection) {
          throw new Error('Please switch to Solana network to tip on Solana. Click your wallet and select Solana Devnet.')
        }

        console.log('[x402-Solana-PAI] Starting payment flow...')
        console.log('[x402-Solana-PAI] Tipper address:', address)

        const { createX402Client } = await import('x402-solana/client')

        const solanaProvider = (window as any).solana
        if (!solanaProvider) {
          throw new Error('Solana wallet not found. Please connect a Solana wallet.')
        }

        if (!solanaProvider.isConnected) {
          await solanaProvider.connect()
        }

        console.log('[x402-Solana-PAI] Creating x402 client...')

        const walletAdapter = {
          address: address,
          signTransaction: async (tx: any) => {
            return await solanaProvider.signTransaction(tx)
          },
        }

        const x402Client = createX402Client({
          wallet: walletAdapter,
          network: 'solana-devnet',
          rpcUrl: 'https://api.devnet.solana.com',
        })

        console.log('[x402-Solana-PAI] Calling payment endpoint...')

        const response = await x402Client.fetch(
          `/api/x402/tip/${slug}/pay-solana?amount=${tipAmount}&token=USDC`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Payment failed')
        }

        const result = await response.json()
        console.log('[x402-Solana-PAI] Success:', result)

        if (result.tip?.signature) {
          setTxSignature(result.tip.signature)
        }
      } else if (selectedChain === 'base') {
        if (!creator?.evm_wallet_address) throw new Error('Creator does not accept Base tips yet')

        if (!isEVMConnection) {
          throw new Error('Please switch to Base network to tip on Base. Click your wallet and select Base Sepolia.')
        }

        if (!walletClient) throw new Error('Wallet not connected')

        // Import x402 v2 client packages
        const { x402Client } = await import('@x402/core/client')
        const { registerExactEvmScheme } = await import('@x402/evm/exact/client')

        console.log('[x402-Base v2] Starting payment flow...')
        console.log('[x402-Base v2] Tipper address (EVM):', activeAddress)

        // Create x402 client and register EVM scheme with the wallet signer
        // Adapt wagmi walletClient to x402's ClientEvmSigner interface
        const signer = {
          address: walletClient.account.address as `0x${string}`,
          signTypedData: async (params: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> }) => {
            return walletClient.signTypedData({
              account: walletClient.account,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              domain: params.domain as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              types: params.types as any,
              primaryType: params.primaryType,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              message: params.message as any,
            })
          }
        }
        const client = new x402Client()
        registerExactEvmScheme(client, { signer })

        // Get payment requirements from the server
        console.log('[x402-Base v2] Getting payment requirements...')
        const initRes = await fetch(`/api/x402/tip/${slug}/pay-base?amount=${tipAmount}&token=USDC`)

        if (initRes.status !== 402) {
          throw new Error('Payment initialization failed')
        }

        const paymentData = await initRes.json()
        console.log('[x402-Base v2] Payment requirements received:', JSON.stringify(paymentData, null, 2))

        // Debug: Log the first requirement's fields
        const firstReq = paymentData.accepts?.[0]
        if (firstReq) {
          console.log('[x402-Base v2] First requirement details:', {
            scheme: firstReq.scheme,
            network: firstReq.network,
            asset: firstReq.asset,
            amount: firstReq.amount,
            extra: firstReq.extra,
            hasName: !!firstReq.extra?.name,
            hasVersion: !!firstReq.extra?.version,
          })
        } else {
          console.error('[x402-Base v2] No accepts array in response!')
        }

        // Validate payment requirements exist
        if (!paymentData.accepts?.[0] && !paymentData.paymentRequirements?.[0]) {
          throw new Error('No payment requirements received')
        }

        // Validate required fields are present
        const requirement = paymentData.accepts?.[0]
        if (requirement && (!requirement.extra?.name || !requirement.extra?.version)) {
          console.error('[x402-Base v2] Missing EIP-712 domain params in requirement:', requirement)
          throw new Error(`Server returned incomplete payment requirements: missing EIP-712 domain parameters (name=${requirement.extra?.name}, version=${requirement.extra?.version})`)
        }

        console.log('[x402-Base v2] Signing payment with wallet...')

        // Create payment payload using the client
        // Pass the full paymentData object which includes x402Version and accepts array
        const paymentPayload = await client.createPaymentPayload(paymentData)

        // Encode as base64 for the header
        const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')

        console.log('[x402-Base v2] Payment signed, submitting...')

        const finalRes = await fetch(`/api/x402/tip/${slug}/pay-base?amount=${tipAmount}&token=USDC`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-payment': paymentHeader,
            'payment-signature': paymentHeader,
          }
        })

        if (!finalRes.ok) {
          const errorData = await finalRes.json()
          console.error('[x402-Base v2] Payment failed:', errorData)
          throw new Error(errorData.reason || errorData.error || 'Payment verification failed')
        }

        const result = await finalRes.json()
        console.log('[x402-Base v2] Success:', result)
        if (result.tip?.signature) setTxSignature(result.tip.signature)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
    } finally {
      setTipping(false)
    }
  }

  if (!isInMiniApp) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6">
        <div className="max-w-2xl w-full glass-card rounded-3xl p-10 text-center">
          <h1 className="text-4xl font-bold mb-4">Under Maintenance</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            The web app is currently being upgraded. Please use BlinkTip on Base App or Farcaster to send tips.
          </p>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 animate-pulse">Loading creator profile...</p>
      </div>
    </div>
  )

  if (!creator) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-3">Creator Not Found</h1>
        <p className="text-gray-400">Please check the URL and try again.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 flex items-center justify-center relative overflow-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-glow" />
      </div>

      {/* Top Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">BlinkTip</span>
            </div>
            {miniAppWalletAddress && (
              <div className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  {miniAppWalletAddress.slice(0, 6)}...{miniAppWalletAddress.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md glass-card rounded-[2rem] overflow-hidden animate-slide-up border border-white/20 dark:border-zinc-800 shadow-2xl mt-16">
        
        {/* Creator Header - Gradient Banner */}
        <div className="relative h-36 bg-gradient-to-br from-purple-600 via-purple-500 to-blue-600">
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
            <div className="p-1.5 bg-white dark:bg-black rounded-full shadow-xl">
              <img 
                src={creator.avatar_url || `https://ui-avatars.com/api/?name=${creator.name}`} 
                className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-black bg-gray-200"
                alt={creator.name} 
              />
            </div>
          </div>
        </div>

        <div className="pt-16 pb-8 px-8 text-center">
          <h1 className="text-2xl font-bold mb-2 tracking-tight">{creator.name}</h1>
          <p className="text-gray-500 text-sm mb-8 max-w-[280px] mx-auto line-clamp-2 leading-relaxed">{creator.bio}</p>

          {/* Network Badge */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl flex items-center justify-center gap-2 mb-8 border border-blue-200 dark:border-blue-800">
            <span className="text-blue-500 text-lg">🔵</span>
            <span className="text-sm font-bold text-blue-600">Base Network</span>
          </div>

          {/* Amount Grid */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {TIP_AMOUNTS.map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(amt)}
                className={`py-3 rounded-xl font-bold transition-all border ${amount === amt ? 'border-purple-500 bg-purple-500/10 text-purple-600' : 'border-zinc-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900/30'}`}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Custom Amount Input */}
          <div className="relative mb-8 group">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">$</span>
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-5 pl-10 pr-4 text-center font-bold text-3xl outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder:text-gray-300"
              placeholder="0"
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">USDC</div>
          </div>

          {/* Action Button */}
          {!miniAppWalletAddress ? (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-2xl text-sm">
              Please connect your wallet in Base App to send tips
            </div>
          ) : (
             <button
              onClick={handleTip}
              disabled={tipping}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tipping ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                `Send $${amount || '0'} Tip`
              )}
            </button>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl font-medium animate-slide-up">
              {error}
            </div>
          )}

          {/* Success Message */}
          {txSignature && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm rounded-xl font-medium animate-slide-up border border-green-200 dark:border-green-800">
              <p className="font-bold mb-2">Payment Successful!</p>
              <a
                href={`https://sepolia.basescan.org/tx/${txSignature}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-green-800"
              >
                View Transaction
              </a>
            </div>
          )}
          
          <div className="mt-8 flex items-center justify-center gap-2 opacity-40 hover:opacity-60 transition-opacity">
             <span className="text-xs font-mono text-gray-500">Powered by x402 Protocol</span>
          </div>

        </div>
      </div>
    </div>
  )
}