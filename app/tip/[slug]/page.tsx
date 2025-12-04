'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAppKitAccount, useAppKit } from '@reown/appkit/react'
import { useWalletClient } from 'wagmi'

// Define Creator Type
type Creator = {
  slug: string
  name: string
  bio: string
  avatar_url: string
  wallet_address: string | null
  evm_wallet_address?: string
}

const TIP_AMOUNTS = [1, 5, 10, 20]

export default function TipPage() {
  const params = useParams()
  const slug = params.slug as string
  const { address, isConnected, caipAddress } = useAppKitAccount()
  const { open } = useAppKit()
  const { data: walletClient } = useWalletClient()

  const [creator, setCreator] = useState<Creator | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChain, setSelectedChain] = useState<'solana' | 'base'>('solana')
  const [amount, setAmount] = useState<number | ''>(5)
  const [tipping, setTipping] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Detect which network user is connected to
  const isEVMConnection = caipAddress?.startsWith('eip155:')
  const isSolanaConnection = caipAddress?.startsWith('solana:')

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

  // --- LOGIC: Keeping your existing Tip Logic ---
  const handleTip = async () => {
    setTipping(true)
    setError(null)
    setTxSignature(null)

    try {
      const tipAmount = typeof amount === 'string' ? parseFloat(amount) : amount
      if (!tipAmount || tipAmount <= 0) throw new Error('Invalid amount')
      if (!address || !isConnected) throw new Error('Please connect your wallet')

      if (selectedChain === 'solana') {
        if (!creator?.wallet_address) throw new Error('Creator does not accept Solana tips yet')

        // Check if user is connected to Solana network
        if (!isSolanaConnection) {
          throw new Error('Please switch to Solana network to tip on Solana. Click your wallet and select Solana Devnet.')
        }

        console.log('[x402-Solana-PAI] Starting payment flow...')
        console.log('[x402-Solana-PAI] Tipper address:', address)

        // Import x402-solana client
        const { createX402Client } = await import('x402-solana/client')

        // Get Solana wallet adapter from Reown
        const solanaProvider = (window as any).solana
        if (!solanaProvider) {
          throw new Error('Solana wallet not found. Please connect a Solana wallet.')
        }

        // Ensure wallet is connected
        if (!solanaProvider.isConnected) {
          await solanaProvider.connect()
        }

        console.log('[x402-Solana-PAI] Creating x402 client...')

        // Create wallet adapter interface that x402-solana expects
        const walletAdapter = {
          address: address, // Reown provides base58 string address
          signTransaction: async (tx: any) => {
            return await solanaProvider.signTransaction(tx)
          },
        }

        // Create x402 client with wallet and network config
        const x402Client = createX402Client({
          wallet: walletAdapter,
          network: 'solana-devnet',
          rpcUrl: 'https://api.devnet.solana.com',
        })

        console.log('[x402-Solana-PAI] Calling payment endpoint...')

        // Make the payment request - x402 client handles everything!
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

        // Check if user is connected to EVM network
        if (!isEVMConnection) {
          throw new Error('Please switch to Base network to tip on Base. Click your wallet and select Base Sepolia.')
        }

        if (!walletClient) throw new Error('Wallet not connected')

        // Import x402 client dynamically
        const { createPaymentHeader } = await import('x402/client')

        console.log('[x402-Base] Step 1: Getting payment requirements...')
        console.log('[x402-Base] Tipper address (EVM):', address)

        // 1. Get Payment Requirements
        const initRes = await fetch(`/api/x402/tip/${slug}/pay-base?amount=${tipAmount}&token=USDC`)
        if (initRes.status !== 402) throw new Error('Payment initialization failed')
        const paymentData = await initRes.json()

        console.log('[x402-Base] Step 2: Payment requirements received')
        console.log('[x402-Base] Step 3: Signing payment with wallet...')

        // 2. Sign
        const paymentHeader = await createPaymentHeader(walletClient as any, 1, paymentData.paymentRequirements[0])

        console.log('[x402-Base] Step 4: Payment signed, submitting...')

        // 3. Submit
        const finalRes = await fetch(`/api/x402/tip/${slug}/pay-base?amount=${tipAmount}&token=USDC`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'x-payment': paymentHeader }
        })

        if (!finalRes.ok) throw new Error('Payment verification failed')
        const result = await finalRes.json()
        console.log('[x402-Base] Success:', result)
        if (result.tip?.signature) setTxSignature(result.tip.signature)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
    } finally {
      setTipping(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 animate-pulse">Loading Profile...</p>
      </div>
    </div>
  )

  if (!creator) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Creator Not Found</h1>
        <p className="text-gray-500">Check the URL and try again.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 flex items-center justify-center relative overflow-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-glow" />
      </div>

      {/* Top Navigation with Wallet Button */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">BlinkTip</span>
            </div>
            <button
              onClick={() => open()}
              className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg"
            >
              {isConnected ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              ) : (
                'Connect Wallet'
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md glass-card rounded-[2rem] overflow-hidden animate-slide-up border border-white/20 dark:border-zinc-800 shadow-2xl mt-16">
        
        {/* Creator Header - Gradient Banner */}
        <div className="relative h-32 bg-gradient-to-br from-purple-600 to-blue-600">
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
          <h1 className="text-2xl font-bold mb-1 tracking-tight">{creator.name}</h1>
          <p className="text-gray-500 text-sm mb-8 max-w-[280px] mx-auto line-clamp-2 leading-relaxed">{creator.bio}</p>

          {/* Chain Selector */}
          <div className="bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-xl flex mb-8 border border-zinc-200 dark:border-zinc-800">
            <button 
              onClick={() => setSelectedChain('solana')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${selectedChain === 'solana' ? 'bg-white dark:bg-zinc-800 shadow-sm text-purple-600 scale-[1.02]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              <span>◎</span> Solana
            </button>
            <button 
              onClick={() => setSelectedChain('base')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${selectedChain === 'base' ? 'bg-white dark:bg-zinc-800 shadow-sm text-blue-600 scale-[1.02]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              <span>🔵</span> Base
            </button>
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
              placeholder="0.00"
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">USDC</div>
          </div>

          {/* Action Button */}
          {!isConnected ? (
            <button 
              onClick={() => open()} 
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg"
            >
              Connect Wallet
            </button>
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
              <p className="font-bold mb-1">🎉 Payment Successful!</p>
              <a 
                href={selectedChain === 'solana' ? `https://explorer.solana.com/tx/${txSignature}?cluster=devnet` : `https://sepolia.basescan.org/tx/${txSignature}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-green-800"
              >
                View Transaction
              </a>
            </div>
          )}
          
          <div className="mt-8 flex items-center justify-center gap-2 opacity-40 hover:opacity-60 transition-opacity">
             <span className="text-xs font-mono text-gray-500">SECURED BY x402 PROTOCOL</span>
          </div>

        </div>
      </div>
    </div>
  )
}