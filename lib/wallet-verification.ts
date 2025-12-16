/**
 * Wallet ownership verification via signature
 *
 * Flow:
 * 1. Client: User signs message with their wallet
 * 2. Client: Sends { wallet_address, signature, message } to server
 * 3. Server: Verifies signature matches wallet (this file)
 */

import { PublicKey } from '@solana/web3.js'
import { verifyMessage } from 'viem'
import nacl from 'tweetnacl'

export interface VerificationResult {
  valid: boolean
  error?: string
}
