'use client'

import { useState, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Dashboard() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (!isConnected) router.push('/login')
  }, [isConnected, router])

  if (!isConnected) return null

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
          <p className="text-sm font-bold truncate mb-4">@{address?.slice(0, 6)}...</p>
          <button onClick={() => disconnect()} className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            Disconnect
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="md:ml-64 p-6 md:p-10 max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-10 animate-fade-in">
          <div><h1 className="text-3xl font-bold">Dashboard</h1><p className="text-gray-500">Your earnings overview.</p></div>
          <Link href="/" className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold">View Site</Link>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-slide-up">
          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-purple-500"><p className="text-sm text-gray-500 font-bold uppercase">Earnings</p><h3 className="text-3xl font-bold">$1,240.50</h3></div>
          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-blue-500"><p className="text-sm text-gray-500 font-bold uppercase">Tips</p><h3 className="text-3xl font-bold">142</h3></div>
          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-orange-500"><p className="text-sm text-gray-500 font-bold uppercase">Agent Tips</p><h3 className="text-3xl font-bold">18</h3></div>
        </div>
      </main>
    </div>
  )
}

