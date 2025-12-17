'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import Link from 'next/link'

export default function RegisterPage() {
  const { publicKey } = useWallet()

  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [tipLink, setTipLink] = useState('')
  const [blinkUrl, setBlinkUrl] = useState('')

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

    if (!publicKey) {
      setError('Please connect your wallet first')
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

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          wallet_address: publicKey.toBase58(),
          name,
          bio: bio.trim() || undefined,
          avatar_url: avatarUrl.trim() || undefined,
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
          <WalletMultiButton />
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

          {!publicKey ? (
            <div className="text-center py-16">
              <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-xl p-8 mb-6">
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                  Connect your Solana wallet to get started
                </p>
                <div className="flex justify-center">
                  <WalletMultiButton />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Supports Phantom, Solflare, Coinbase Wallet, and more
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  Connected Wallet
                </label>
                <input
                  type="text"
                  value={publicKey.toBase58()}
                  disabled
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-mono"
                />
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
                  3-50 characters: lowercase letters, numbers, hyphens, underscores
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
        </div>
      </div>
    </div>
  )
}
