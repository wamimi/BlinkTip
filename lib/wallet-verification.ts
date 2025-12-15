/**
 * Wallet ownership verification via signature
 */

import { verify } from '@noble/ed25519'
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { verifyMessage } from 'viem'

interface VerificationResult {
  valid: boolean
  error?: string
}
