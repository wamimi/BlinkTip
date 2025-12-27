import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { SolanaWalletProvider } from './providers/SolanaWalletProvider'
import { ThirdwebProvider } from './providers/ThirdwebProvider'
import { AuthProvider } from './providers'
import { ClientReownProvider } from '@/components/ClientReownProvider'
import { MiniAppWagmiProvider } from './providers/MiniAppWagmiProvider'
import { headers } from 'next/headers'
import { minikitConfig } from '@/minikit.config'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Generate metadata with Mini App embed support
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: minikitConfig.miniapp.name,
    description: minikitConfig.miniapp.description,
    openGraph: {
      title: minikitConfig.miniapp.ogTitle,
      description: minikitConfig.miniapp.ogDescription,
      images: [minikitConfig.miniapp.ogImageUrl],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: minikitConfig.miniapp.ogTitle,
      description: minikitConfig.miniapp.ogDescription,
      images: [minikitConfig.miniapp.ogImageUrl],
    },
    other: {
      'base:app_id': '694fd0eb4d3a403912ed823c',
      'fc:miniapp': JSON.stringify({
        version: 'next',
        imageUrl: minikitConfig.miniapp.heroImageUrl,
        button: {
          title: `Launch ${minikitConfig.miniapp.name}`,
          action: {
            type: 'launch_miniapp',
            name: minikitConfig.miniapp.name,
            url: minikitConfig.miniapp.homeUrl,
            splashImageUrl: minikitConfig.miniapp.splashImageUrl,
            splashBackgroundColor: minikitConfig.miniapp.splashBackgroundColor,
          },
        },
      }),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersObj = await headers()
  const cookies = headersObj.get('cookie')

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Mini App Wagmi Provider - wraps everything for Base Account support */}
        <MiniAppWagmiProvider>
          {/* Keep existing Reown for web users */}
          <ClientReownProvider cookies={cookies}>
            <AuthProvider>
              <ThirdwebProvider>
                <SolanaWalletProvider>{children}</SolanaWalletProvider>
              </ThirdwebProvider>
            </AuthProvider>
          </ClientReownProvider>
        </MiniAppWagmiProvider>
      </body>
    </html>
  )
}
