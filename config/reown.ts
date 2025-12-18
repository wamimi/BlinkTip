// Client-only configuration - prevents server-side evaluation
'use client'

import { cookieStorage, createStorage } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react'
import { baseSepolia, celoAlfajores } from '@reown/appkit/networks'
import { solanaTestnet, solanaDevnet } from '@reown/appkit/networks'

// Get Project ID from environment
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID

if (!projectId) {
  throw new Error('NEXT_PUBLIC_REOWN_PROJECT_ID is not defined')
}

// Define EVM networks for TESTNET (Base Sepolia, Celo Alfajores)
export const evmNetworks = [
  baseSepolia,    // Base testnet (Sepolia)
  celoAlfajores   // Celo testnet (Alfajores)
]

// Define Solana networks for TESTNET
export const solanaNetworks = [
  solanaDevnet,   // Solana devnet (primary for testing)
  solanaTestnet   // Solana testnet
]

// Wagmi Adapter for EVM chains (Base Sepolia, Celo Alfajores)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  projectId,
  networks: evmNetworks
})

// Solana Adapter
export const solanaAdapter = new SolanaAdapter({
  wallets: [] // Let Reown auto-detect Solana wallets
})

export const config = wagmiAdapter.wagmiConfig
