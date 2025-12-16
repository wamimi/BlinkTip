'use client'

import { useState, useEffect } from 'react'
import { useAppKitAccount, useAppKitNetwork, useAppKit, useAppKitProvider } from '@reown/appkit/react'
import type { Provider } from '@reown/appkit-adapter-solana/react'
import { useSession, signIn } from 'next-auth/react'
import { useSignMessage } from 'wagmi'
import Link from 'next/link'

export default function RegisterPage() {
  const { address, isConnected, caipAddress, embeddedWalletInfo } = useAppKitAccount()
  const { caipNetwork } = useAppKitNetwork()
  const { open } = useAppKit()
  const { data: session } = useSession()
  const { walletProvider: solanaWalletProvider } = useAppKitProvider<Provider>('solana')
  const { signMessageAsync: signEvmMessage } = useSignMessage()

  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [tipLink, setTipLink] = useState('')
  const [blinkUrl, setBlinkUrl] = useState('')
  const [solanaAddress, setSolanaAddress] = useState('')
  const [evmAddress, setEvmAddress] = useState('')
  const [solanaSignature, setSolanaSignature] = useState('')
  const [evmSignature, setEvmSignature] = useState('')
  const [solanaVerificationMessage, setSolanaVerificationMessage] = useState('')
  const [evmVerificationMessage, setEvmVerificationMessage] = useState('')

  // Determine connection type BEFORE using in useEffect
  const isEVMConnection = caipAddress?.startsWith('eip155:')
  const isSolanaConnection = caipAddress?.startsWith('solana:')

  useEffect(() => {
    if (session?.user) {
      if (session.user.twitterHandle && !slug) setSlug(session.user.twitterHandle)
      if (session.user.twitterName && !name) setName(session.user.twitterName)
      if (session.user.twitterAvatarUrl && !avatarUrl) setAvatarUrl(session.user.twitterAvatarUrl)
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

  // Auto-detect BOTH Solana and EVM addresses from multi-chain wallet
  useEffect(() => {
    if (!isConnected) {
      setSolanaAddress('')
      setEvmAddress('')
      setSolanaSignature('')
      setEvmSignature('')
      return
    }

    const detectAddresses = async () => {
      // Set current connected address first and request signature
      if (isSolanaConnection && address) {
        if (address !== solanaAddress) {
          setSolanaAddress(address)
          // Request Solana signature when address is set
          requestSolanaSignature(address)
        }
      } else if (isEVMConnection && address) {
        if (address !== evmAddress) {
          setEvmAddress(address)
          // Request EVM signature when address is set
          requestEvmSignature(address)
        }
      }

      // Try to detect the OTHER chain's address from the same wallet
      try {
        // If currently on Solana, try to get EVM address
        if (isSolanaConnection) {
          if (typeof window !== 'undefined' && (window as any).ethereum) {
            const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' })
            if (accounts && accounts[0] && accounts[0] !== evmAddress) {
              setEvmAddress(accounts[0])
              console.log('[Register] Detected EVM address from multi-chain wallet:', accounts[0])
              // Request EVM signature for the detected address
              requestEvmSignature(accounts[0])
            }
          }
        }

        // If currently on EVM, try to get Solana address
        if (isEVMConnection) {
          if (typeof window !== 'undefined' && (window as any).solana) {
            try {
              const resp = await (window as any).solana.connect({ onlyIfTrusted: true })
              if (resp && resp.publicKey) {
                const solAddr = resp.publicKey.toString()
                if (solAddr !== solanaAddress) {
                  setSolanaAddress(solAddr)
                  console.log('[Register] Detected Solana address from multi-chain wallet:', solAddr)
                  // Request Solana signature for the detected address
                  requestSolanaSignature(solAddr)
                }
              }
            } catch (e) {
              // Wallet might not support Solana or not trusted yet
            }
          }
        }
      } catch (err) {
        console.log('[Register] Could not detect additional chain address:', err)
      }
    }

    detectAddresses()
  }, [isConnected, address, caipAddress, isSolanaConnection, isEVMConnection])

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    setSlug(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected || !address) { setError('Please connect your wallet first'); return }
    if (!name.trim()) { setError('Name is required'); return }

    // Require at least one address
    if (!solanaAddress && !evmAddress) {
      setError('Could not detect any wallet addresses. Please reconnect your wallet.')
      return
    }

    // Validate that we have signatures for the addresses we're submitting
    if (solanaAddress && !solanaSignature) {
      setError('Please sign the message with your Solana wallet first')
      return
    }

    if (evmAddress && !evmSignature) {
      setError('Please sign the message with your EVM wallet first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Build supported chains based on detected addresses
      const supportedChains = []
      if (solanaAddress) supportedChains.push('solana')
      if (evmAddress) supportedChains.push('base') // We support Base for EVM

      const isTwitterAuth = embeddedWalletInfo?.authProvider === 'x'
      const twitterData = isTwitterAuth ? {
        twitter_verified: true,
      } : session?.user ? {
        twitter_id: session.user.twitterId,
        twitter_handle: session.user.twitterHandle,
        twitter_name: session.user.twitterName,
        twitter_avatar_url: session.user.twitterAvatarUrl,
        twitter_follower_count: session.user.twitterFollowerCount,
        twitter_created_at: session.user.twitterCreatedAt,
        twitter_verified: !!session.user.twitterId,
      } : {}

      console.log('[Register] Submitting with addresses:', {
        solana: solanaAddress || 'none',
        evm: evmAddress || 'none',
        supportedChains,
        hasSolanaSignature: !!solanaSignature,
        hasEvmSignature: !!evmSignature
      })

      const response = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          wallet_address: solanaAddress || undefined,
          wallet_signature: solanaSignature || undefined,
          verification_message: solanaVerificationMessage || undefined,
          evm_wallet_address: evmAddress || undefined,
          evm_wallet_signature: evmSignature || undefined,
          evm_verification_message: evmVerificationMessage || undefined,
          name,
          bio: bio.trim() || undefined,
          avatar_url: avatarUrl.trim() || undefined,
          supported_chains: supportedChains,
          ...twitterData,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to register')

      setSuccess(true)
      setTipLink(data.tip_link)
      setBlinkUrl(data.blink_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // SUCCESS SCREEN
  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6 relative overflow-hidden">
        {/* Confetti Background Effect */}
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute top-0 left-1/4 w-full h-full bg-gradient-to-br from-green-500/10 to-transparent blur-[100px]" />
        </div>

        <div className="max-w-xl w-full glass-card rounded-3xl p-10 animate-fade-in text-center relative z-10">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-500/30 animate-scale-in">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            
            <h1 className="text-4xl font-bold mb-4 text-gradient">You're Live!</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">Your universal tip page is ready to accept funds.</p>

            {/* Show registered addresses */}
            {(solanaAddress || evmAddress) && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 mb-8">
                <p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wider mb-3">Registered Wallet Addresses</p>
                <div className="space-y-2 text-sm">
                  {solanaAddress && (
                    <div className="flex items-center gap-2 justify-center">
                      <span>◎ Solana:</span>
                      <span className="font-mono text-green-700 dark:text-green-300">
                        {solanaAddress.slice(0, 4)}...{solanaAddress.slice(-4)}
                      </span>
                    </div>
                  )}
                  {evmAddress && (
                    <div className="flex items-center gap-2 justify-center">
                      <span>⬡ Base:</span>
                      <span className="font-mono text-green-700 dark:text-green-300">
                        {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-zinc-100 dark:bg-zinc-800/50 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 mb-8 text-left">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Universal Link</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-white dark:bg-black px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 text-sm overflow-hidden text-ellipsis font-mono">{tipLink}</code>
                <button onClick={() => navigator.clipboard.writeText(tipLink)} className="p-3 bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-sm">
                  📋
                </button>
              </div>
            </div>

            <Link href={`/tip/${slug}`} className="block w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-purple-500/30 hover:scale-[1.02] transition-all">
              View Your Page
            </Link>
            
            <Link href="/" className="block mt-4 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-300">
              Return Home
            </Link>
        </div>
      </div>
    )
  }

  // REGISTRATION FORM
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 relative">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-16 animate-fade-in">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
            <span className="text-xl font-bold">BlinkTip</span>
          </Link>
          <appkit-button />
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          
          {/* Left Side: Context & Steps */}
          <div className="space-y-10 animate-slide-up">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                Claim your <br/> <span className="text-gradient">Universal Identity</span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
                Create a unified profile to accept crypto from humans and AI agents across Solana, Base, and Celo.
              </p>
            </div>
            
            <div className="space-y-6">
              {/* Step 1 Card */}
              <div className={`p-6 rounded-3xl border-2 transition-all duration-300 ${isConnected ? 'bg-green-50/50 border-green-500/30 dark:bg-green-900/10 dark:border-green-800' : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 shadow-lg'}`}>
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl transition-all ${isConnected ? 'bg-green-500 text-white shadow-green-500/30 shadow-lg' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'}`}>1</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-1">Connect Wallet</h3>
                    <p className="text-sm text-gray-500">{isConnected ? 'Wallet connected successfully' : 'External or Social Login'}</p>
                  </div>
                  {isConnected && <div className="text-green-500 text-xl">✓</div>}
                </div>
                {!isConnected && (
                  <button onClick={() => open()} className="mt-6 w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:scale-[1.02] transition-transform">
                    Connect Now
                  </button>
                )}
              </div>

              {/* Step 2 Card */}
              <div className={`p-6 rounded-3xl border-2 transition-all duration-300 ${session ? 'bg-blue-50/50 border-blue-500/30 dark:bg-blue-900/10 dark:border-blue-800' : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 shadow-lg'} ${!isConnected ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl transition-all ${session ? 'bg-blue-500 text-white shadow-blue-500/30 shadow-lg' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'}`}>2</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-1">Verify Socials</h3>
                    <p className="text-sm text-gray-500">{session ? `@${session.user.twitterHandle} verified` : 'Link Twitter for trust'}</p>
                  </div>
                  {session && <div className="text-blue-500 text-xl">✓</div>}
                </div>
                {isConnected && !session && (
                  <button onClick={() => signIn('twitter')} className="mt-6 w-full py-4 bg-[#1DA1F2] text-white rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-blue-400/20">
                    Verify with X
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: The Form */}
          <div className="glass-card p-8 md:p-10 rounded-[2.5rem] animate-slide-up [animation-delay:200ms] relative overflow-hidden ring-1 ring-white/50 dark:ring-white/10">
            {!isConnected && (
               <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-md z-10 flex flex-col items-center justify-center text-center p-8">
                 <div className="text-4xl mb-4">🔒</div>
                 <h3 className="text-2xl font-bold mb-2">Profile Locked</h3>
                 <p className="text-gray-500">Complete Step 1 to unlock the form</p>
               </div>
            )}
            
            <h2 className="text-2xl font-bold mb-8">Profile Details</h2>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Show detected wallet addresses */}
              {isConnected && (
                <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Detected Wallet Addresses</p>
                  <div className="space-y-2 text-sm">
                    {solanaAddress ? (
                      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-2">
                        <span className="text-green-600">✓</span>
                        <span className="font-semibold">◎ Solana:</span>
                        <span className="font-mono text-xs">
                          {solanaAddress.slice(0, 4)}...{solanaAddress.slice(-4)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-2">
                        <span className="text-yellow-600">⚠</span>
                        <span className="text-xs">Solana address not detected</span>
                      </div>
                    )}

                    {evmAddress ? (
                      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-2">
                        <span className="text-green-600">✓</span>
                        <span className="font-semibold">⬡ Base:</span>
                        <span className="font-mono text-xs">
                          {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-2">
                        <span className="text-yellow-600">⚠</span>
                        <span className="text-xs">EVM address not detected</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Multi-chain wallets like Phantom support both. You can update addresses later in your dashboard.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-bold ml-1 text-gray-700 dark:text-gray-300">Username / Slug</label>
                <div className="flex items-center bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-200 dark:border-zinc-700 focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/10 transition-all">
                  <span className="pl-5 text-gray-400 text-sm font-mono tracking-tight">blinktip.com/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={handleSlugChange}
                    placeholder="username"
                    className="flex-1 bg-transparent border-none p-4 focus:ring-0 outline-none font-bold text-lg"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold ml-1 text-gray-700 dark:text-gray-300">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-2xl p-4 font-semibold focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                  placeholder="e.g. Nelly CyberPro"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold ml-1 text-gray-700 dark:text-gray-300">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-2xl p-4 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all resize-none h-32"
                  placeholder="What do you create? (Optional)"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-200 dark:border-red-800">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-lg rounded-2xl hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? 'Creating Profile...' : 'Launch Page 🚀'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}