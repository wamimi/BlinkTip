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

/**
 * Verify Solana wallet ownership via signature
 */
export async function verifySolanaSignature(
  walletAddress: string,
  signature: string,
  message: string
): Promise<VerificationResult> {
  try {
    const publicKey = new PublicKey(walletAddress)
    const signatureBytes = Buffer.from(signature, 'base64')
    const messageBytes = new TextEncoder().encode(message)

    const verified = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    )

    if (!verified) {
      return { valid: false, error: 'Invalid signature' }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    }
  }
}

/**
 * Verify EVM wallet ownership via signature
 */
export async function verifyEVMSignature(
  walletAddress: string,
  signature: string,
  message: string
): Promise<VerificationResult> {
  try {
    const isValid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    }
  }
}
