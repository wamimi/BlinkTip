'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMiniApp } from '@/context/miniapp'
import { usePrivyUser } from '@/hooks/usePrivyUser'
import Link from 'next/link'

/**
 * Register page - redirects web users to login (which handles registration)
 * Miniapp users still use the old flow with Base Account
 */
export default function RegisterPage() {
  const router = useRouter()
  const { isInMiniApp } = useMiniApp()
  const { isAuthenticated: isPrivyAuthenticated, isLoading: isPrivyLoading } = usePrivyUser()

  // For web users, redirect to login page which handles both login and signup
  useEffect(() => {
    if (!isInMiniApp && !isPrivyLoading) {
      if (isPrivyAuthenticated) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }
  }, [isInMiniApp, isPrivyLoading, isPrivyAuthenticated, router])

  // Show loading while checking/redirecting
  if (!isInMiniApp) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
        </div>
      </div>
    )
  }

  // Miniapp users see a message to use the miniapp registration
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-card rounded-3xl p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mx-auto mb-6">
          B
        </div>
        <h1 className="text-2xl font-bold mb-4">Create Your Tip Page</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          To register as a creator, please use the BlinkTip miniapp on Base or Farcaster.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-shadow"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
