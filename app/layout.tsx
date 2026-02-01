import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { SolanaWalletProvider } from './providers/SolanaWalletProvider'
import { ThirdwebProvider } from './providers/ThirdwebProvider'
import { AuthProvider } from './providers'
import { MiniAppWagmiProvider } from './providers/MiniAppWagmiProvider'
import { PrivyProvider } from './providers/PrivyProvider'
import { minikitConfig } from '@/minikit.config'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'BlinkTip | Universal Crypto Tipping',
  description: 'One link for tips from humans and AI agents on Solana, Base, and Celo.',
  icons: {
    icon: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <MiniAppWagmiProvider>
          <PrivyProvider>
            <AuthProvider>
              <ThirdwebProvider>
                <SolanaWalletProvider>{children}</SolanaWalletProvider>
              </ThirdwebProvider>
            </AuthProvider>
          </PrivyProvider>
        </MiniAppWagmiProvider>
      </body>
    </html>
  )
}
