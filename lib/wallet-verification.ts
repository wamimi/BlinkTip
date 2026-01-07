/**
 * Wallet ownership verification via signature
 */

import { verifyMessage } from 'viem'

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
    // Dynamic import to avoid bundling Solana deps when not needed
    const [{ PublicKey }, nacl] = await Promise.all([
      import('@solana/web3.js'),
      import('tweetnacl')
    ])

    const publicKey = new PublicKey(walletAddress)
    const signatureBytes = Buffer.from(signature, 'base64')
    const messageBytes = new TextEncoder().encode(message)

    const verified = nacl.default.sign.detached.verify(
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
