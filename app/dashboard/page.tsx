'use client'

import { useState, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useRouter } from 'next/navigation'
import { useMiniApp } from '@/context/miniapp'
import { usePrivyUser } from '@/hooks/usePrivyUser'
import Link from 'next/link'

interface CreatorProfile {
  slug: string
  name: string
  avatar_url?: string
  evm_wallet_address?: string
  wallet_address?: string
}

interface CreatorStats {
  total_tips: number
  total_earnings: number
  human_tips: number
  agent_tips: number
}

export default function Dashboard() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const router = useRouter()
  const { isInMiniApp } = useMiniApp()
  const {
    isAuthenticated: isPrivyAuthenticated,
    isLoading: isPrivyLoading,
    userId: privyUserId,
    email: privyEmail,
    evmWallet: privyEvmWallet,
    logout: privyLogout,
  } = usePrivyUser()

  const [activeTab, setActiveTab] = useState('overview')
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [stats, setStats] = useState<CreatorStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Determine if user is authenticated
  const isAuthenticated = isInMiniApp ? isConnected : isPrivyAuthenticated

  // Redirect if not authenticated
  useEffect(() => {
    if (!isInMiniApp && !isPrivyLoading && !isPrivyAuthenticated) {
      router.push('/login')
    } else if (isInMiniApp && !isConnected) {
      router.push('/login')
    }
  }, [isInMiniApp, isPrivyLoading, isPrivyAuthenticated, isConnected, router])

  // Fetch creator profile and stats
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated) return

      try {
        setLoading(true)

        // For Privy users, fetch by privy_user_id
        if (!isInMiniApp && privyUserId) {
          const res = await fetch(`/api/auth/privy?privy_user_id=${encodeURIComponent(privyUserId)}`)
          const data = await res.json()

          if (data.exists && data.creator) {
            setProfile({
              slug: data.creator.slug,
              name: data.creator.name,
              avatar_url: data.creator.avatar_url,
              evm_wallet_address: data.creator.has_evm_wallet ? privyEvmWallet || undefined : undefined,
            })
            // TODO: Fetch actual stats from database
            setStats({
              total_tips: 0,
              total_earnings: 0,
              human_tips: 0,
              agent_tips: 0,
            })
          } else {
            // No profile, redirect to register
            router.push('/register-new')
          }
        }
        // For miniapp users, fetch by wallet address
        else if (isInMiniApp && address) {
          const res = await fetch(`/api/creators?wallet=${encodeURIComponent(address)}`)
          const data = await res.json()

          if (data.creator) {
            setProfile({
              slug: data.creator.slug,
              name: data.creator.name,
              avatar_url: data.creator.avatar_url,
              evm_wallet_address: data.creator.evm_wallet_address,
              wallet_address: data.creator.wallet_address,
            })
            // TODO: Fetch actual stats from database
            setStats({
              total_tips: 0,
              total_earnings: 0,
              human_tips: 0,
              agent_tips: 0,
            })
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isAuthenticated, isInMiniApp, privyUserId, privyEvmWallet, address, router])

  const handleLogout = () => {
    if (isInMiniApp) {
      disconnect()
    } else {
      privyLogout()
    }
  }

  // Show loading state
  if (isPrivyLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  const displayName = profile?.name || privyEmail || address?.slice(0, 10) || 'User'
  const displayIdentifier = isInMiniApp
    ? `@${address?.slice(0, 6)}...${address?.slice(-4)}`
    : privyEmail || `@${privyEvmWallet?.slice(0, 6)}...`

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Sidebar */}
      <nav className="fixed top-0 left-0 h-full w-64 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hidden md:flex flex-col p-6 z-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
          <span className="text-xl font-bold">BlinkTip</span>
        </div>
        <div className="space-y-2 flex-1">
          {['Overview', 'Tips', 'Settings'].map((item) => (
            <button key={item} onClick={() => setActiveTab(item.toLowerCase())} className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all ${activeTab === item.toLowerCase() ? 'bg-zinc-100 dark:bg-zinc-800 text-purple-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800/50'}`}>
              {item}
            </button>
          ))}
        </div>
        <div className="pt-6 border-t border-gray-100 dark:border-zinc-800">
          <p className="text-sm font-bold truncate mb-1">{displayName}</p>
          <p className="text-xs text-gray-500 truncate mb-4">{displayIdentifier}</p>
          <button onClick={handleLogout} className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="md:ml-64 p-6 md:p-10 max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-10 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-500">Welcome back, {profile?.name || 'Creator'}!</p>
          </div>
          <div className="flex gap-3">
            {profile?.slug && (
              <Link href={`/tip/${profile.slug}`} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full font-bold hover:shadow-lg transition-shadow">
                View Tip Page
              </Link>
            )}
            <Link href="/" className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold">
              Home
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-slide-up">
          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-purple-500">
            <p className="text-sm text-gray-500 font-bold uppercase">Total Earnings</p>
            <h3 className="text-3xl font-bold">${stats?.total_earnings?.toFixed(2) || '0.00'}</h3>
          </div>
          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-blue-500">
            <p className="text-sm text-gray-500 font-bold uppercase">Total Tips</p>
            <h3 className="text-3xl font-bold">{stats?.total_tips || 0}</h3>
          </div>
          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-orange-500">
            <p className="text-sm text-gray-500 font-bold uppercase">Agent Tips</p>
            <h3 className="text-3xl font-bold">{stats?.agent_tips || 0}</h3>
          </div>
        </div>

        {/* Tip Page Link Card */}
        {profile?.slug && (
          <div className="glass-card p-6 rounded-2xl mb-6 animate-slide-up [animation-delay:100ms]">
            <h3 className="text-lg font-bold mb-3">Your Tip Page</h3>
            <div className="flex items-center gap-3 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
              <span className="text-sm font-mono flex-1 truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/tip/${profile.slug}` : `/tip/${profile.slug}`}
              </span>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/tip/${profile.slug}`
                  navigator.clipboard.writeText(url)
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Mobile Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 p-4 z-20">
          <div className="flex justify-around">
            {['Overview', 'Tips', 'Settings'].map((item) => (
              <button
                key={item}
                onClick={() => setActiveTab(item.toLowerCase())}
                className={`px-4 py-2 rounded-xl font-medium ${activeTab === item.toLowerCase() ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' : 'text-gray-500'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
