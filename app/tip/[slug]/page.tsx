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
  const { address, isConnected } = useAppKitAccount()
  const { open } = useAppKit()
  const { data: walletClient } = useWalletClient()

  const [creator, setCreator] = useState<Creator | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChain, setSelectedChain] = useState<'solana' | 'base'>('solana')
  const [amount, setAmount] = useState<number | ''>(5)
  const [tipping, setTipping] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        // Placeholder for x402 Solana Logic
        throw new Error('Solana x402 integration in progress...')
      } else if (selectedChain === 'base') {
        if (!creator?.evm_wallet_address) throw new Error('Creator does not accept Base tips yet')
        if (!walletClient) throw new Error('Wallet not connected')

        // Import x402 client dynamically
        const { createPaymentHeader } = await import('x402/client')

        // 1. Get Payment Requirements
        const initRes = await fetch(`/api/x402/tip/${slug}/pay-base?amount=${tipAmount}&token=USDC`)
        if (initRes.status !== 402) throw new Error('Payment initialization failed')
        const paymentData = await initRes.json()
        
        // 2. Sign
        const paymentHeader = await createPaymentHeader(walletClient as any, 1, paymentData.paymentRequirements[0])

        // 3. Submit
        const finalRes = await fetch(`/api/x402/tip/${slug}/pay-base?amount=${tipAmount}&token=USDC`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'x-payment': paymentHeader }
        })
        
        if (!finalRes.ok) throw new Error('Payment verification failed')
        const result = await finalRes.json()
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

      <div className="relative w-full max-w-md glass-card rounded-[2rem] overflow-hidden animate-slide-up border border-white/20 dark:border-zinc-800 shadow-2xl">
        
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