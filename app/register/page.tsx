'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import { useAppKitProvider, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
import type { Provider } from '@reown/appkit-adapter-solana/react'
import { useSignMessage } from 'wagmi'

export default function RegisterPage() {
  const { data: session, status } = useSession()
  const { address, isConnected } = useAppKitAccount()
  const { caipNetwork } = useAppKitNetwork()
  const { walletProvider: solanaWalletProvider } = useAppKitProvider<Provider>('solana')
  const { signMessageAsync: signEvmMessage } = useSignMessage()

  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [solanaWalletAddress, setSolanaWalletAddress] = useState('')
  const [evmWalletAddress, setEvmWalletAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [tipLink, setTipLink] = useState('')
  const [blinkUrl, setBlinkUrl] = useState('')
  const [solanaSignature, setSolanaSignature] = useState('')
  const [evmSignature, setEvmSignature] = useState('')
  const [solanaVerificationMessage, setSolanaVerificationMessage] = useState('')
  const [evmVerificationMessage, setEvmVerificationMessage] = useState('')

  // Track which chain user is currently on to detect when they switch
  useEffect(() => {
    if (!isConnected || !address) return

    const isSolana = caipNetwork?.name?.toLowerCase().includes('solana')

    if (isSolana) {
      // User is on Solana network
      if (address !== solanaWalletAddress) {
        setSolanaWalletAddress(address)
        // Trigger Solana signature request
        requestSolanaSignature(address)
      }
    } else {
      // User is on EVM network (Base, Celo, etc.)
      if (address !== evmWalletAddress) {
        setEvmWalletAddress(address)
        // Trigger EVM signature request
        requestEvmSignature(address)
      }
    }
  }, [isConnected, address, caipNetwork])

  // Auto-fill form with Twitter data when session loads
  useEffect(() => {
    if (session?.user) {
      if (session.user.twitterHandle && !slug) {
        setSlug(session.user.twitterHandle)
      }
      if (session.user.twitterName && !name) {
        setName(session.user.twitterName)
      }
      if (session.user.twitterAvatarUrl && !avatarUrl) {
        setAvatarUrl(session.user.twitterAvatarUrl)
      }
    }
  }, [session])

  // Request Solana wallet signature
  const requestSolanaSignature = async (walletAddress: string) => {
    if (!solanaWalletProvider || solanaSignature) return

    try {
      const message = `Sign this message to verify your Solana wallet ownership for BlinkTip.\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`
      setSolanaVerificationMessage(message)

      const encodedMessage = new TextEncoder().encode(message)
      const signature = await solanaWalletProvider.signMessage(encodedMessage)
      const signatureBase64 = Buffer.from(signature).toString('base64')

      setSolanaSignature(signatureBase64)
      console.log('✓ Solana wallet signature obtained')
    } catch (error) {
      console.error('Failed to sign Solana message:', error)
      setError('You must sign the message to verify Solana wallet ownership')
    }
  }

  // Request EVM wallet signature
  const requestEvmSignature = async (walletAddress: string) => {
    if (!signEvmMessage || evmSignature) return

    try {
      const message = `Sign this message to verify your EVM wallet ownership for BlinkTip.\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`
      setEvmVerificationMessage(message)

      const signature = await signEvmMessage({ message })

      setEvmSignature(signature)
      console.log('✓ EVM wallet signature obtained')
    } catch (error) {
      console.error('Failed to sign EVM message:', error)
      setError('You must sign the message to verify EVM wallet ownership')
    }
  }

  const validateSlug = (value: string) => {
    const slugRegex = /^[a-z0-9_-]{3,50}$/
    return slugRegex.test(value)
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    setSlug(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!solanaWalletAddress && !evmWalletAddress) {
      setError('Please connect at least one wallet (Solana or EVM)')
      return
    }

    if (!session?.user?.twitterId) {
      setError('Please verify your Twitter account first')
      return
    }

    if (!validateSlug(slug)) {
      setError('Slug must be 3-50 characters (lowercase letters, numbers, hyphens, underscores only)')
      return
    }

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    // Check if we have signatures for connected wallets
    if (solanaWalletAddress && !solanaSignature) {
      setError('Please sign the message with your Solana wallet first')
      return
    }

    if (evmWalletAddress && !evmSignature) {
      setError('Please sign the message with your EVM wallet first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          wallet_address: solanaWalletAddress || undefined,
          wallet_signature: solanaSignature || undefined,
          verification_message: solanaVerificationMessage || undefined,
          name,
          bio: bio.trim() || undefined,
          avatar_url: avatarUrl.trim() || undefined,
          evm_wallet_address: evmWalletAddress || undefined,
          evm_wallet_signature: evmSignature || undefined,
          evm_verification_message: evmVerificationMessage || undefined,
          supported_chains: [
            solanaWalletAddress ? 'solana' : null,
            evmWalletAddress ? 'celo' : null,
          ].filter(Boolean),
          twitter_id: session.user.twitterId,
          twitter_handle: session.user.twitterHandle,
          twitter_name: session.user.twitterName,
          twitter_avatar_url: session.user.twitterAvatarUrl,
          twitter_follower_count: session.user.twitterFollowerCount,
          twitter_created_at: session.user.twitterCreatedAt,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register')
      }

      setSuccess(true)
      setTipLink(data.tip_link)
      setBlinkUrl(data.blink_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold mb-4">Registration Successful!</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your BlinkTip creator profile has been created
            </p>

            <div className="space-y-4 mb-6">
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
                <h2 className="font-semibold mb-1">Your Universal Tip Page</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Share this link anywhere - Instagram, TikTok, email, etc. Works with x402 protocol.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tipLink}
                    readOnly
                    className="flex-1 px-4 py-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(tipLink)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <h2 className="font-semibold mb-1">Your Blink URL (Twitter/X)</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Share this on Twitter/X - it will unfurl as an interactive Blink once domain is registered.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={blinkUrl}
                    readOnly
                    className="flex-1 px-4 py-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(blinkUrl)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href={`/tip/${slug}`}
                className="block w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors"
              >
                View Your Tip Page
              </Link>
              <Link
                href="/"
                className="block w-full py-3 px-6 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 font-semibold rounded-lg transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-zinc-900 dark:via-black dark:to-zinc-900">
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-8 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
            BlinkTip
          </Link>
          <appkit-button />
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 md:p-10 border border-gray-100 dark:border-zinc-800">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🎨</div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Create Your Creator Profile
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Start receiving tips from humans and AI agents worldwide
            </p>
          </div>

          {/* Twitter Verification Step */}
          {!session && status !== 'loading' && (
            <div className="text-center py-16">
              <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-8 mb-6">
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 font-semibold">
                  Step 1: Verify your Twitter account
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  This prevents spam and ensures one creator per Twitter account
                </p>
                <button
                  onClick={() => signIn('twitter')}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  Sign in with Twitter
                </button>
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className="text-center py-16">
              <p className="text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
          )}

          {/* Wallet Connection + Form */}
          {session && (
            <>
              {/* Show Twitter verification success */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6 flex items-center gap-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-200">
                    Twitter Verified: @{session.user.twitterHandle}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your profile will be linked to this Twitter account
                  </p>
                </div>
              </div>

              {!isConnected ? (
                <div className="text-center py-16">
                  <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-xl p-8 mb-6">
                    <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 font-semibold">
                      Step 2: Connect your wallet(s)
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                      Connect Solana and/or EVM wallets to receive tips.<br />
                      You'll be prompted to sign a message to verify ownership.
                    </p>
                    <div className="flex justify-center">
                      <appkit-button />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Supports Phantom, MetaMask, Coinbase Wallet, and more
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      Connected Wallet(s)
                    </label>
                    {solanaWalletAddress && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Solana:</p>
                        <input
                          type="text"
                          value={solanaWalletAddress}
                          disabled
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-mono"
                        />
                        {solanaSignature && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Signature verified</p>
                        )}
                      </div>
                    )}
                    {evmWalletAddress && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">EVM (Base/Celo):</p>
                        <input
                          type="text"
                          value={evmWalletAddress}
                          disabled
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-mono"
                        />
                        {evmSignature && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Signature verified</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                      💡 Switch networks in your wallet to connect both Solana and EVM addresses
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                      Your Slug <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-2 border-2 border-purple-200 dark:border-purple-800">
                      <span className="text-gray-500 dark:text-gray-400 text-sm px-2">blink-tip.vercel.app/tip/</span>
                      <input
                        type="text"
                        value={slug}
                        onChange={handleSlugChange}
                        placeholder="your-slug"
                        required
                        className="flex-1 px-4 py-3 bg-white dark:bg-zinc-900 border-none rounded-lg focus:ring-2 focus:ring-purple-600 outline-none font-semibold"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-1">
                      Auto-filled from Twitter: @{session.user.twitterHandle}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                      Display Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your Name"
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell people about yourself..."
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none resize-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                      Avatar URL
                    </label>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition-all"
                    />
                    {avatarUrl && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-1">
                        Auto-filled from Twitter profile picture
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl">
                      <p className="text-red-700 dark:text-red-300 font-semibold">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {loading ? 'Creating Profile...' : 'Create Your Tip Page'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
