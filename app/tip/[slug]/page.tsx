'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAppKitAccount, useAppKitNetwork, useAppKit } from '@reown/appkit/react'
import { createX402Client } from 'x402-solana/client'

type Creator = {
  slug: string
  name: string
  bio: string
  avatar_url: string
  wallet_address: string | null
  evm_wallet_address?: string
  supported_chains?: string[]
}

const TIP_AMOUNTS = [0.01, 0.05, 0.1]

export default function TipPage() {
  const params = useParams()
  const slug = params.slug as string

  // Reown AppKit hooks - unified wallet for all chains
  const { address, isConnected, caipAddress } = useAppKitAccount()
  const { caipNetwork, switchNetwork } = useAppKitNetwork()
  const { open } = useAppKit()

  const [creator, setCreator] = useState<Creator | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChain, setSelectedChain] = useState<'solana' | 'base'>('solana')
  const [selectedAmount, setSelectedAmount] = useState(0.01)
  const [customAmount, setCustomAmount] = useState('')
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
        setError(err instanceof Error ? err.message : 'Failed to load creator')
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
      const amount = customAmount ? parseFloat(customAmount) : selectedAmount

      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid tip amount')
      }

      if (!address || !isConnected) {
        throw new Error('Please connect your wallet')
      }

      if (selectedChain === 'solana') {
        // Solana tipping via x402
        if (!creator?.wallet_address) {
          throw new Error('Creator does not accept tips on Solana')
        }

        // TODO: Implement Solana x402 tipping with Reown wallet
        // This requires adapting the x402-solana client to work with Reown's Solana adapter
        console.log('[x402-Solana] Starting tip flow...', { amount, creator: slug })

        throw new Error('Solana tipping with Reown coming soon - pending x402-solana integration')

      } else if (selectedChain === 'base') {
        // Base tipping via x402 protocol
        if (!creator?.evm_wallet_address) {
          throw new Error('Creator does not accept tips on Base')
        }

        console.log('[x402-Base] Starting x402 tip flow...', { amount, creator: slug })

        // TODO: Implement Base x402 tipping using CDP facilitator
        // This requires wrapFetchWithPayment from @coinbase/x402
        console.log('[x402-Base] Wallet address:', address)
        console.log('[x402-Base] Network:', caipNetwork?.name)

        throw new Error('Base tipping coming soon - pending CDP x402 client integration')
      }

      setError(null)
    } catch (err) {
      console.error('[Tip] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send tip')
    } finally {
      setTipping(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-zinc-900 dark:via-black dark:to-zinc-900">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">💰</div>
          <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">Loading creator...</div>
        </div>
      </div>
    )
  }

  if (error && !creator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-zinc-900 dark:via-black dark:to-zinc-900">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-5xl mb-4">😕</div>
          <div className="text-red-600 dark:text-red-400 text-xl font-bold mb-2">Creator Not Found</div>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!creator) return null

  const explorerUrl = txSignature
    ? selectedChain === 'solana'
      ? `https://explorer.solana.com/tx/${txSignature}?cluster=${
          process.env.NEXT_PUBLIC_NETWORK === 'solana-mainnet-beta' ? 'mainnet' : 'devnet'
        }`
      : `https://sepolia.basescan.org/tx/${txSignature}`
    : null

  // Check if creator supports selected chain
  const creatorSupportsSolana = creator?.wallet_address && creator.wallet_address.length > 0
  const creatorSupportsBase = creator?.evm_wallet_address && creator.evm_wallet_address.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-zinc-900 dark:via-black dark:to-zinc-900">
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">BlinkTip</h1>
          <button
            onClick={() => open()}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-bold transition-all shadow-lg"
          >
            {isConnected ? 'Connected' : 'Connect Wallet'}
          </button>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-8 text-white">
            <div className="flex items-center gap-6">
              {creator.avatar_url && (
                <img
                  src={creator.avatar_url}
                  alt={creator.name}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-xl"
                />
              )}
              <div>
                <h2 className="text-3xl font-bold mb-2">{creator.name}</h2>
                <p className="text-purple-100 text-lg">{creator.bio}</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>💡 Multi-Chain Tipping:</strong> Send tips on Solana or Base. Connect your wallet once with Reown, choose your chain, and tip with USDC. All payments verified via x402 protocol.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">
                Select Blockchain
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedChain('solana')}
                  disabled={!creatorSupportsSolana}
                  className={`py-4 px-4 rounded-xl font-bold transition-all transform hover:scale-105 flex items-center justify-center gap-2 ${
                    selectedChain === 'solana'
                      ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg'
                      : !creatorSupportsSolana
                      ? 'bg-gray-200 dark:bg-zinc-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  <span className="text-2xl">◎</span>
                  <span>Solana</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedChain('base')}
                  disabled={!creatorSupportsBase}
                  className={`py-4 px-4 rounded-xl font-bold transition-all transform hover:scale-105 flex items-center justify-center gap-2 ${
                    selectedChain === 'base'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                      : !creatorSupportsBase
                      ? 'bg-gray-200 dark:bg-zinc-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  <span className="text-2xl">🔵</span>
                  <span>Base</span>
                </button>
              </div>
              {!creatorSupportsSolana && selectedChain === 'solana' && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  This creator hasn't added a Solana wallet address yet.
                </p>
              )}
              {!creatorSupportsBase && selectedChain === 'base' && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  This creator hasn't added a Base wallet address yet.
                </p>
              )}
            </div>

            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Select Tip Amount</h3>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {TIP_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setSelectedAmount(amount)
                    setCustomAmount('')
                  }}
                  className={`py-4 px-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
                    selectedAmount === amount && !customAmount
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">
                Or Enter Custom Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none text-lg font-semibold transition-all"
              />
            </div>

            {!isConnected ? (
              <div className="text-center py-8 bg-purple-50 dark:bg-purple-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-800">
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-4">
                  Connect your wallet to send a tip
                </p>
                <button
                  onClick={() => open()}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-bold text-lg shadow-lg transition-all"
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              <button
                onClick={handleTip}
                disabled={tipping || (selectedChain === 'solana' && !creatorSupportsSolana) || (selectedChain === 'base' && !creatorSupportsBase)}
                className={`w-full font-bold py-5 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] text-lg ${
                  selectedChain === 'solana'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-400 text-white'
                }`}
              >
                {tipping
                  ? 'Processing Payment...'
                  : `Send $${customAmount || selectedAmount} USDC Tip on ${selectedChain === 'solana' ? 'Solana' : 'Base'}`}
              </button>
            )}

            {error && (
              <div className="mt-6 p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl">
                <p className="text-red-700 dark:text-red-300 font-bold text-lg mb-2">❌ Payment Failed</p>
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {txSignature && (
              <div className="mt-6 p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl">
                <p className="text-green-800 dark:text-green-300 font-bold text-lg mb-3">
                  ✅ Tip Sent Successfully!
                </p>
                <p className="text-green-700 dark:text-green-400 mb-4">
                  {selectedChain === 'solana'
                    ? 'Your tip was verified and settled on Solana via the x402 protocol. Thank you for supporting this creator!'
                    : 'Your tip was verified and settled on Base via the x402 protocol. Thank you for supporting this creator!'}
                </p>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block px-4 py-2 font-semibold rounded-lg transition-colors ${
                      selectedChain === 'solana'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    View on {selectedChain === 'solana' ? 'Solana' : 'Base'} Explorer →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
