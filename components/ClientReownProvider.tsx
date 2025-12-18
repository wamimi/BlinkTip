'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'

// Dynamic import to prevent server-side execution of Reown/WalletConnect code
const ReownProviderDynamic = dynamic(
  () => import('@/context/reown').then((mod) => ({ default: mod.ReownProvider })),
  {
    ssr: false,
    loading: () => null
  }
)

export function ClientReownProvider({
  children,
  cookies
}: {
  children: ReactNode
  cookies: string | null
}) {
  return <ReownProviderDynamic cookies={cookies}>{children}</ReownProviderDynamic>
}
