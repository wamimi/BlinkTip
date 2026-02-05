'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useConnect } from 'wagmi'
import { useMiniApp } from '@/context/miniapp'
import { usePrivyUser } from '@/hooks/usePrivyUser'
import Link from 'next/link'

export default function LoginPage() {
  const { isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const router = useRouter()
  const { isInMiniApp } = useMiniApp()
  const {
    isAuthenticated: isPrivyAuthenticated,
    isLoading: isPrivyLoading,
    userId: privyUserId,
    email: privyEmail,
    evmWallet: privyEvmWallet,
    login: privyLogin,
  } = usePrivyUser()

  const [checkingProfile, setCheckingProfile] = useState(false)
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)

  // Redirect miniapp users who are connected
  useEffect(() => {
    if (isInMiniApp && isConnected) {
      router.push('/dashboard')
    }
  }, [isInMiniApp, isConnected, router])

  // Auto-create profile for Privy users or redirect if already exists
  useEffect(() => {
    if (!isInMiniApp && isPrivyAuthenticated && privyUserId && privyEvmWallet && !checkingProfile && !creatingProfile && !showUsernameModal) {
      setCheckingProfile(true)

      fetch(`/api/auth/privy?privy_user_id=${encodeURIComponent(privyUserId)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.exists) {
            // User has a profile, go to dashboard
            router.push('/dashboard')
          } else {
            // Auto-create profile with email prefix as username
            autoCreateProfile()
          }
        })
        .catch((err) => {
          console.error('Error checking profile:', err)
          setCheckingProfile(false)
        })
    }
  }, [isInMiniApp, isPrivyAuthenticated, privyUserId, privyEvmWallet, router, checkingProfile, creatingProfile, showUsernameModal])

  const autoCreateProfile = async (customUsername?: string) => {
    if (!privyUserId || !privyEvmWallet || !privyEmail) return

    setCreatingProfile(true)
    setUsernameError(null)

    // Generate username from email prefix or use custom
    const emailPrefix = privyEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const slugToUse = customUsername || emailPrefix

    // Ensure minimum length
    const finalSlug = slugToUse.length >= 3 ? slugToUse : `${slugToUse}${Math.random().toString(36).substring(2, 5)}`

    try {
      const response = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: finalSlug,
          name: privyEmail.split('@')[0], // Use email prefix as display name
          privy_user_id: privyUserId,
          email: privyEmail,
          evm_wallet_address: privyEvmWallet,
          supported_chains: ['base'],
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Profile created successfully, redirect to dashboard
        router.push('/dashboard')
      } else if (response.status === 409 && data.error === 'Slug already taken') {
        // Username conflict - show modal to pick a different one
        setUsername(finalSlug)
        setShowUsernameModal(true)
        setCreatingProfile(false)
        setCheckingProfile(false)
      } else {
        console.error('Failed to create profile:', data.error)
        setUsernameError(data.error || 'Failed to create profile')
        setCreatingProfile(false)
        setCheckingProfile(false)
      }
    } catch (err) {
      console.error('Error creating profile:', err)
      setUsernameError('Something went wrong. Please try again.')
      setCreatingProfile(false)
      setCheckingProfile(false)
    }
  }

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setUsernameError('Username is required')
      return
    }
    if (!/^[a-z0-9_-]{3,50}$/.test(username)) {
      setUsernameError('Use 3-50 lowercase letters, numbers, hyphens, or underscores')
      return
    }
    await autoCreateProfile(username)
  }

  const handleConnect = () => {
    const connector = connectors[0]
    if (connector) {
      connect({ connector })
    }
  }

  // Show loading while Privy initializes, checking profile, or creating profile
  if (!isInMiniApp && (isPrivyLoading || checkingProfile || creatingProfile)) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {creatingProfile ? 'Setting up your account...' : checkingProfile ? 'Checking your profile...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  // Username conflict modal
  if (showUsernameModal) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-glow [animation-delay:2s]" />

        <div className="glass-card max-w-md w-full p-8 md:p-12 rounded-[2rem] text-center animate-slide-up relative z-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold mb-3">Choose a Username</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            The username "{username}" is already taken. Pick a different one for your tip page.
          </p>

          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div className="text-left">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">blinktip.xyz/tip/</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                    setUsernameError(null)
                  }}
                  className="w-full pl-36 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-purple-500 dark:focus:border-purple-400 outline-none transition"
                  placeholder="yourname"
                  autoFocus
                />
              </div>
              {usernameError && (
                <p className="text-red-500 text-sm mt-2">{usernameError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={creatingProfile}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-2xl text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingProfile ? 'Creating...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-glow" />

      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-glow [animation-delay:2s]" />

      <div className="glass-card max-w-md w-full p-8 md:p-12 rounded-[2rem] text-center animate-slide-up relative z-10">
        <Link href="/" className="inline-block mb-8 hover:opacity-80 transition-opacity">
          <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg mx-auto mb-3">
            B
          </div>
          <span className="text-xl font-bold tracking-tight">BlinkTip</span>
        </Link>

        <h1 className="text-3xl font-bold mb-3">Get Started</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {isInMiniApp ? 'Connect your wallet to access your dashboard.' : 'Sign in to create your tip page and start receiving crypto.'}
        </p>

        {isInMiniApp ? (
          <button
            onClick={handleConnect}
            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-2xl text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
          >
            Connect Wallet
          </button>
        ) : (
          <button
            onClick={() => privyLogin()}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-2xl text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
          >
            Continue with Email
          </button>
        )}

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          We'll create a wallet for you automatically
        </p>
      </div>
    </div>
  )
}
