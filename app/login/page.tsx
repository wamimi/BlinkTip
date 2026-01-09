'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useConnect } from 'wagmi'
import Link from 'next/link'

export default function LoginPage() {
  const { isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const router = useRouter()

  useEffect(() => {
    if (isConnected) router.push('/dashboard')
  }, [isConnected, router])

  const handleConnect = () => {
    const connector = connectors[0]
    if (connector) {
      connect({ connector })
    }
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

        <h1 className="text-3xl font-bold mb-3">Welcome Back</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Connect your wallet to access your dashboard.</p>

        <button onClick={handleConnect} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-2xl text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl">
          Connect Wallet
        </button>

        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-zinc-800">
          <p className="text-sm text-gray-500">
            No account? <Link href="/register-new" className="text-purple-600 dark:text-purple-400 font-bold hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

