'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useWalletClient, useAccount } from 'wagmi'
import { useMiniApp } from '@/context/miniapp'
import { usePrivyUser } from '@/hooks/usePrivyUser'

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
  const { isInMiniApp, walletAddress: miniAppWalletAddress } = useMiniApp()

  // Privy auth for web users
  const {
    isAuthenticated: isPrivyAuthenticated,
    isLoading: isPrivyLoading,
    evmWallet: privyEvmWallet,
    login: privyLogin,
  } = usePrivyUser()

  // Wagmi hooks (used by miniapp)
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  // Determine which wallet to use based on context
  const activeAddress = isInMiniApp ? miniAppWalletAddress : (privyEvmWallet || address)
  const activeConnection = isInMiniApp ? !!miniAppWalletAddress : (isPrivyAuthenticated || isConnected)

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

  // Show loading while Privy initializes (web only)
  if (!isInMiniApp && isPrivyLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
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
        <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-blue-500/8 rounded-full blur-[100px]" />
      </div>

      {/* Top Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">BlinkTip</span>
              </div>
            </div>
            {activeAddress && (
              <div className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  {activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md glass-card rounded-[2rem] overflow-hidden animate-slide-up border border-white/20 dark:border-zinc-800 shadow-2xl shadow-purple-500/5 mt-16 backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80">
        
        {/* Creator Header - Gradient Banner */}
        <div className="relative h-36 bg-gradient-to-br from-purple-600 via-indigo-500 to-blue-500 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
          <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
            <div className="p-1 bg-white dark:bg-black rounded-full shadow-xl ring-4 ring-white/50 dark:ring-black/50">
              <img 
                src={creator.avatar_url || `https://ui-avatars.com/api/?name=${creator.name}`} 
                className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-black bg-gray-100"
                alt={creator.name} 
              />
            </div>
          </div>
        </div>

        <div className="pt-18 pb-8 px-8 text-center">
          <h1 className="text-2xl font-bold mb-2 tracking-tight">{creator.name}</h1>
          <p className="text-gray-500 text-sm mb-8 max-w-[280px] mx-auto line-clamp-2 leading-relaxed">{creator.bio}</p>

          {/* Network Badge */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 rounded-xl flex items-center justify-center gap-2 mb-8 border border-blue-200/50 dark:border-blue-800/50 backdrop-blur-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Base Sepolia Testnet</span>
          </div>

          {/* Amount Grid */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {TIP_AMOUNTS.map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(amt)}
                className={`py-3 rounded-xl font-bold transition-all duration-200 border ${amount === amt ? 'border-purple-500 bg-gradient-to-br from-purple-500/20 to-blue-500/10 text-purple-600 scale-105 shadow-md' : 'border-zinc-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900/30 hover:scale-102'}`}
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
              className="w-full bg-white dark:bg-zinc-900/80 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl py-5 pl-12 pr-20 text-center font-bold text-3xl outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all placeholder:text-gray-300 shadow-inner"
              placeholder="0"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/30 px-3 py-1.5 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white font-bold">$</div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">USDC</span>
            </div>
          </div>

          {/* Action Button */}
          {!activeConnection ? (
            isInMiniApp ? (
              <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 text-amber-700 dark:text-amber-400 rounded-2xl text-sm border border-amber-200/50 dark:border-amber-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <span>Connect your wallet in Base App to send tips</span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => privyLogin()}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold text-lg hover:scale-[1.02] transition-all duration-300 shadow-lg shadow-purple-500/30"
              >
                Sign in to Send Tip
              </button>
            )
          ) : (
             <button
              onClick={handleTip}
              disabled={tipping}
              className="w-full py-4 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 text-white rounded-2xl font-bold text-lg hover:scale-[1.02] transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              {tipping ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending tip...
                </span>
              ) : (
                <>
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  Send ${amount || '0'} USDC
                </>
              )}
            </button>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl font-medium animate-slide-up border border-red-200/50 dark:border-red-700/50">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {txSignature && (
            <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 text-green-700 dark:text-green-300 text-sm rounded-xl font-medium animate-slide-up border border-green-200/50 dark:border-green-700/50 shadow-lg shadow-green-500/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="font-bold">Payment Successful!</p>
              </div>
              <a
                href={`https://sepolia.basescan.org/tx/${txSignature}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 underline underline-offset-2"
              >
                View on BaseScan
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          )}
          
          <div className="mt-8 pt-6 border-t border-zinc-200/50 dark:border-zinc-800/50">
            <div className="flex items-center justify-center gap-2 opacity-50 hover:opacity-80 transition-opacity">
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              <span className="text-xs font-mono text-gray-500">Powered by x402 Protocol</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}