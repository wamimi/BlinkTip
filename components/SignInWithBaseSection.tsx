'use client'

import { SignInWithBaseButton } from '@base-org/account-ui/react'
import { useSignInWithBase } from '@/hooks/useSignInWithBase'
import { useState, useEffect } from 'react'

interface SignInWithBaseSectionProps {
  onSuccess: (data: { address: string; message: string; signature: string }) => void
  isAuthenticated: boolean
}

export function SignInWithBaseSection({ onSuccess, isAuthenticated }: SignInWithBaseSectionProps) {
  const { signIn, isLoading, error } = useSignInWithBase()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }

    checkTheme()

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  const handleSignIn = async () => {
    const result = await signIn()
    if (result) {
      onSuccess(result)
    }
  }

  if (isAuthenticated) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
        <p className="text-sm font-bold text-green-700 dark:text-green-300 flex items-center gap-2">
          <span>✓</span> Signed in with Base Account
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-bold mb-2">Sign in with Base</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Authenticate with your Base Account to create your tip page
        </p>
      </div>

      <SignInWithBaseButton
        colorScheme={isDark ? 'dark' : 'light'}
        onClick={handleSignIn}
      />

      {isLoading && (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          Signing in...
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}
    </div>
  )
}
