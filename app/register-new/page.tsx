'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useMiniApp } from '@/context/miniapp'
import { SignInWithBaseSection } from '@/components/SignInWithBaseSection'
import { usePrivyUser } from '@/hooks/usePrivyUser'
import Link from 'next/link'

export default function RegisterPage() {
  const { isInMiniApp, user: miniAppUser } = useMiniApp()
  const { data: session } = useSession()
  const {
    isAuthenticated: isPrivyAuthenticated,
    isLoading: isPrivyLoading,
    userId: privyUserId,
    email: privyEmail,
    evmWallet: privyEvmWallet,
    login: privyLogin,
    logout: privyLogout,
  } = usePrivyUser()

  // Sign in with Base state (miniapp only)
  const [baseAccountAuth, setBaseAccountAuth] = useState<{
    address: string
    message: string
    signature: string
  } | null>(null)

  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [tipLink, setTipLink] = useState('')

  // Pre-fill form from various auth sources
  useEffect(() => {
    if (isInMiniApp && miniAppUser) {
      if (miniAppUser.username && !slug) setSlug(miniAppUser.username)
      if (miniAppUser.displayName && !name) setName(miniAppUser.displayName)
      if (miniAppUser.pfpUrl && !avatarUrl) setAvatarUrl(miniAppUser.pfpUrl)
      if (miniAppUser.bio && !bio) setBio(miniAppUser.bio)
    } else if (session?.user) {
      if (session.user.twitterHandle && !slug) setSlug(session.user.twitterHandle)
      if (session.user.twitterName && !name) setName(session.user.twitterName)
      if (session.user.twitterAvatarUrl && !avatarUrl) setAvatarUrl(session.user.twitterAvatarUrl)
    } else if (isPrivyAuthenticated && privyEmail) {
      // Pre-fill from Privy email (use email prefix as default slug)
      const emailPrefix = privyEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '')
      if (!slug && emailPrefix) setSlug(emailPrefix)
    }
  }, [session, isInMiniApp, miniAppUser, isPrivyAuthenticated, privyEmail, slug, name, avatarUrl, bio])

  const handleBaseAccountSignIn = (data: { address: string; message: string; signature: string }) => {
    setBaseAccountAuth(data)
    console.log('Base Account authenticated:', data.address)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Determine auth type and validate
    const isMiniAppAuth = isInMiniApp && baseAccountAuth
    const isPrivyAuth = !isInMiniApp && isPrivyAuthenticated && privyUserId && privyEvmWallet

    if (!isMiniAppAuth && !isPrivyAuth) {
      if (isInMiniApp) {
        setError('Please sign in with your Base Account first')
      } else {
        setError('Please sign in with your email first')
      }
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Build request body based on auth type
      const requestBody: Record<string, unknown> = {
        slug,
        name,
        bio: bio.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        supported_chains: ['base'],
      }

      if (isMiniAppAuth && baseAccountAuth) {
        // MiniApp flow: include signature for verification
        requestBody.evm_wallet_address = baseAccountAuth.address
        requestBody.evm_wallet_signature = baseAccountAuth.signature
        requestBody.evm_verification_message = baseAccountAuth.message
        requestBody.farcaster_fid = miniAppUser?.fid
        requestBody.farcaster_username = miniAppUser?.username

        console.log('Submitting miniapp registration:', {
          slug,
          name,
          evm_wallet_address: baseAccountAuth.address,
          farcaster_fid: miniAppUser?.fid,
        })
      } else if (isPrivyAuth) {
        // Privy flow: no signature needed, Privy handles auth
        requestBody.privy_user_id = privyUserId
        requestBody.email = privyEmail
        requestBody.evm_wallet_address = privyEvmWallet

        console.log('Submitting Privy registration:', {
          slug,
          name,
          privy_user_id: privyUserId,
          evm_wallet_address: privyEvmWallet,
        })
      }

      const response = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const text = await response.text()
        let errorMessage = 'Failed to register'
        try {
          const data = JSON.parse(text)
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `Server error (${response.status}): ${text.substring(0, 100)}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()

      setSuccess(true)
      setTipLink(data.tip_link)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
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

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute top-0 left-1/4 w-full h-full bg-gradient-to-br from-green-500/10 to-transparent blur-[100px]" />
        </div>

        <div className="max-w-xl w-full glass-card rounded-3xl p-10 animate-fade-in text-center relative z-10">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-500/30 animate-scale-in">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>

            <h1 className="text-4xl font-bold mb-4 text-gradient">You're Live!</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">Your universal tip page is ready to accept funds.</p>

            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">Your Tip Link</p>
              <a href={tipLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-sm break-all block">
                {tipLink}
              </a>
            </div>

            <div className="flex gap-4">
              <Link href={`/tip/${slug}`} className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-2xl font-bold hover:shadow-lg hover:scale-105 transition-all text-center">
                View Your Page
              </Link>
            </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6 text-gradient">
            Create Your Tip Page
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
            Create your profile to accept crypto from humans and AI agents on Base.
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8 mb-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
              1
            </div>
            <div className="flex-1">
              {isInMiniApp ? (
                <>
                  <h3 className="text-xl font-bold mb-2">Sign in with Base</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Authenticate with your Base Account to get started
                  </p>
                  <SignInWithBaseSection
                    onSuccess={handleBaseAccountSignIn}
                    isAuthenticated={!!baseAccountAuth}
                  />
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold mb-2">Sign in with Email</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    We'll create a wallet for you automatically
                  </p>
                  {isPrivyAuthenticated ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-green-700 dark:text-green-400">Signed in as {privyEmail}</p>
                        <p className="text-sm text-green-600 dark:text-green-500 font-mono truncate">
                          Wallet: {privyEvmWallet?.slice(0, 6)}...{privyEvmWallet?.slice(-4)}
                        </p>
                      </div>
                      <button
                        onClick={() => privyLogout()}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => privyLogin()}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-2xl font-bold hover:shadow-lg hover:scale-105 transition-all"
                    >
                      Continue with Email
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
              2
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-4">Complete Your Profile</h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold mb-2">Username</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition"
                    placeholder="yourname"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">Your unique tip page URL</p>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Display Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition"
                    placeholder="Your Name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition resize-none"
                    rows={3}
                    placeholder="Tell people about yourself"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Avatar URL (Optional)</label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition"
                    placeholder="https://example.com/avatar.png"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (isInMiniApp ? !baseAccountAuth : !isPrivyAuthenticated || !privyEvmWallet)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-2xl font-bold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? 'Creating...' : 'Create Tip Page'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
