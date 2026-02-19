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
  bio?: string
  avatar_url?: string
  evm_wallet_address?: string
  wallet_address?: string
  twitter_handle?: string
  twitter_verified?: boolean
  email?: string
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

  // Profile editing states
  const [editingProfile, setEditingProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
              bio: data.creator.bio,
              avatar_url: data.creator.avatar_url,
              evm_wallet_address: data.creator.has_evm_wallet ? privyEvmWallet || undefined : undefined,
              twitter_handle: data.creator.twitter_handle,
              twitter_verified: data.creator.twitter_verified,
              email: privyEmail || undefined,
            })
            setStats({
              total_tips: 0,
              total_earnings: 0,
              human_tips: 0,
              agent_tips: 0,
            })
          } else {
            router.push('/login')
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
              bio: data.creator.bio,
              avatar_url: data.creator.avatar_url,
              evm_wallet_address: data.creator.evm_wallet_address,
              wallet_address: data.creator.wallet_address,
              twitter_handle: data.creator.twitter_handle,
              twitter_verified: data.creator.twitter_verified,
            })
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
  }, [isAuthenticated, isInMiniApp, privyUserId, privyEvmWallet, privyEmail, address, router])

  // Initialize edit form when profile loads
  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '')
      setEditBio(profile.bio || '')
      setEditAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  const handleLogout = () => {
    if (isInMiniApp) {
      disconnect()
    } else {
      privyLogout()
    }
  }

  const handleSaveProfile = async () => {
    if (!profile?.slug) return

    setSaving(true)
    setSaveError(null)

    try {
      const res = await fetch(`/api/creators/${profile.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          bio: editBio || null,
          avatar_url: editAvatarUrl || null,
          privy_user_id: privyUserId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      const data = await res.json()
      setProfile((prev) => prev ? {
        ...prev,
        name: data.creator.name,
        bio: data.creator.bio,
        avatar_url: data.creator.avatar_url,
      } : null)
      setEditingProfile(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
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
      <main className="md:ml-64 p-6 md:p-10 max-w-7xl mx-auto pb-24 md:pb-10">
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
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
          </>
        )}

        {/* Tips Tab */}
        {activeTab === 'tips' && (
          <div className="glass-card p-6 rounded-2xl animate-slide-up">
            <h3 className="text-lg font-bold mb-4">Recent Tips</h3>
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No tips yet</p>
              <p className="text-sm mt-2">Share your tip page to start receiving crypto!</p>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-slide-up">
            {/* Profile Section */}
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Profile</h3>
                {!editingProfile ? (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="px-4 py-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg font-medium transition-colors"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingProfile(false)
                        setEditName(profile?.name || '')
                        setEditBio(profile?.bio || '')
                        setEditAvatarUrl(profile?.avatar_url || '')
                        setSaveError(null)
                      }}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {saveError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                  {saveError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Username</label>
                  <div className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-gray-700 dark:text-gray-300">
                    {profile?.slug}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Display Name</label>
                  {editingProfile ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-purple-500 dark:focus:border-purple-400 outline-none transition"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-gray-700 dark:text-gray-300">
                      {profile?.name || '-'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Bio</label>
                  {editingProfile ? (
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-purple-500 dark:focus:border-purple-400 outline-none transition resize-none"
                      placeholder="Tell people about yourself"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-gray-700 dark:text-gray-300 min-h-[80px]">
                      {profile?.bio || 'No bio yet'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Avatar URL</label>
                  {editingProfile ? (
                    <input
                      type="url"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-purple-500 dark:focus:border-purple-400 outline-none transition"
                      placeholder="https://example.com/avatar.png"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-gray-700 dark:text-gray-300">
                      {profile?.avatar_url || 'No avatar set'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Connected Accounts */}
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-lg font-bold mb-6">Connected Accounts</h3>
              <div className="space-y-4">
                {/* Email */}
                <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-sm text-gray-500">{profile?.email || privyEmail || 'Not connected'}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-sm font-medium">
                    Connected
                  </span>
                </div>

                {/* X/Twitter */}
                <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white dark:text-black" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">X (Twitter)</p>
                      <p className="text-sm text-gray-500">
                        {profile?.twitter_handle ? `@${profile.twitter_handle}` : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {profile?.twitter_verified ? (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-sm font-medium">
                      Connected
                    </span>
                  ) : (
                    <button className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-80 transition-opacity">
                      Connect
                    </button>
                  )}
                </div>

                {/* Wallet */}
                <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Wallet (Base)</p>
                      <p className="text-sm text-gray-500 font-mono">
                        {profile?.evm_wallet_address || privyEvmWallet
                          ? `${(profile?.evm_wallet_address || privyEvmWallet)?.slice(0, 6)}...${(profile?.evm_wallet_address || privyEvmWallet)?.slice(-4)}`
                          : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-sm font-medium">
                    Connected
                  </span>
                </div>
              </div>
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
