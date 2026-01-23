/**
 * Base x402 Payment Endpoint (v2)
 *
 * Handles tipping on Base blockchain using x402 protocol v2.
 * Uses new @x402/evm and @x402/core packages with CAIP-2 network format.
 */

import { NextRequest, NextResponse } from 'next/server'
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { supabase } from '@/lib/supabase'
import { getAddress } from 'viem'
import { validateTipAmount } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'

// Testnet facilitator URL
const TESTNET_FACILITATOR_URL = 'https://x402.org/facilitator'

// CAIP-2 network identifiers
const NETWORKS = {
  'base': 'eip155:8453',
  'base-sepolia': 'eip155:84532',
} as const

// Create facilitator client
const facilitatorClient = new HTTPFacilitatorClient({
  url: TESTNET_FACILITATOR_URL,
})

// Create resource server and register EVM scheme for both networks
const server = new x402ResourceServer(facilitatorClient)
  .register('eip155:84532', new ExactEvmScheme())
  .register('eip155:8453', new ExactEvmScheme())

// Initialize the server (fetch supported kinds from facilitator)
let serverInitialized = false
async function ensureServerInitialized() {
  if (!serverInitialized) {
    console.log('[Base x402 v2] Initializing server...')
    try {
      await server.initialize()
      serverInitialized = true
      console.log('[Base x402 v2] Server initialized successfully')
    } catch (initError) {
      console.error('[Base x402 v2] Server initialization failed:', initError)
      throw initError
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    // Initialize the server on first request
    await ensureServerInitialized()

    // Rate limiting: 20 payment requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitResult = await rateLimit(`x402_base:${ip}`, {
      limit: 20,
      windowInSeconds: 60,
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many payment requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Fetch creator info
    const { data: creator, error } = await supabase
      .from('creators')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      )
    }

    // Verify creator has EVM wallet address
    if (!creator.evm_wallet_address) {
      return NextResponse.json(
        { error: 'Creator does not accept tips on Base' },
        { status: 400 }
      )
    }

    console.log('[Base x402 v2] Creator info:', {
      slug: creator.slug,
      name: creator.name,
      evm_wallet_address: creator.evm_wallet_address,
    })

    const url = new URL(request.url)
    const amount = url.searchParams.get('amount') || '0.01'
    const agentId = url.searchParams.get('agent_id')
    const contentUrl = url.searchParams.get('content_url')

    // Validate amount
    const validation = validateTipAmount(amount)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }
    const amountNum = validation.value!

    // Determine network (use env var or default to base-sepolia)
    const networkKey = (process.env.NEXT_PUBLIC_BASE_NETWORK || 'base-sepolia') as 'base' | 'base-sepolia'
    const network = NETWORKS[networkKey]

    const checksummedPayTo = getAddress(creator.evm_wallet_address)

    // Build payment requirements in x402 v2 format
    const paymentConfig = {
      scheme: 'exact' as const,
      price: `$${amount}`, // x402 v2 uses dollar format
      network,
      payTo: checksummedPayTo,
    }

    console.log('[Base x402 v2] Payment config:', JSON.stringify(paymentConfig, null, 2))
    console.log('[Base x402 v2] Using facilitator:', TESTNET_FACILITATOR_URL)

    // Build proper payment requirements with EIP-712 domain parameters
    const paymentRequirements = await server.buildPaymentRequirements(paymentConfig)
    console.log('[Base x402 v2] Built payment requirements:', JSON.stringify(paymentRequirements, null, 2))

    // Check if payment header exists (x-payment or payment-signature)
    const paymentHeader = request.headers.get('x-payment') || request.headers.get('payment-signature')

    if (!paymentHeader) {
      // Return 402 with payment requirements
      console.log('[Base x402 v2] No payment header, returning 402')

      return NextResponse.json(
        {
          x402Version: 2,
          accepts: paymentRequirements,
        },
        {
          status: 402,
          headers: {
            'PAYMENT-REQUIRED': JSON.stringify({ accepts: paymentRequirements }),
          }
        }
      )
    }

    console.log('[Base x402 v2] Payment header received, verifying...')
    console.log('[Base x402 v2] Header preview:', paymentHeader.substring(0, 100) + '...')

    // Parse the payment header
    let paymentPayload
    try {
      // Try base64 decoding first (common format)
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8')
      paymentPayload = JSON.parse(decoded)
    } catch {
      // Try direct JSON parsing
      try {
        paymentPayload = JSON.parse(paymentHeader)
      } catch {
        console.error('[Base x402 v2] Failed to parse payment header')
        return NextResponse.json(
          { error: 'Invalid payment header format' },
          { status: 400 }
        )
      }
    }

    console.log('[Base x402 v2] Decoded payment payload:', JSON.stringify(paymentPayload, null, 2))

    // Verify payment using the resource server
    try {
      // Use the already-built payment requirements
      const requirement = paymentRequirements[0]

      const verifyResult = await server.verifyPayment(paymentPayload, requirement)
      console.log('[Base x402 v2] Verification result:', verifyResult)

      if (!verifyResult.isValid) {
        console.error('[Base x402 v2] Verification failed:', verifyResult.invalidReason)
        return NextResponse.json(
          { error: 'Payment verification failed', reason: verifyResult.invalidReason },
          { status: 402 }
        )
      }

      // Settle the payment
      console.log('[Base x402 v2] Payment verified, settling...')
      const settleResult = await server.settlePayment(paymentPayload, requirement)
      console.log('[Base x402 v2] Settlement result:', settleResult)

      if (!settleResult.success) {
        console.error('[Base x402 v2] Settlement failed:', settleResult.errorReason)
        return NextResponse.json(
          { error: 'Payment settlement failed', reason: settleResult.errorReason },
          { status: 500 }
        )
      }

      console.log('[Base x402 v2] Payment settled:', settleResult.transaction)

      // Record tip in database
      const { data: tip } = await supabase
        .from('tips')
        .insert({
          creator_id: creator.id,
          from_address: agentId || verifyResult.payer || 'base_tipper',
          amount: amountNum,
          token: 'USDC',
          signature: settleResult.transaction || 'pending',
          source: agentId ? 'agent' : 'human',
          status: 'confirmed',
          chain: 'base',
          network: networkKey,
          metadata: {
            network: networkKey,
            facilitator: 'x402.org',
            agent_id: agentId,
            content_url: contentUrl,
            x402_version: 2,
          },
        })
        .select()
        .single()

      // Return success with tip info
      return NextResponse.json({
        success: true,
        message: `Successfully tipped ${creator.name} on Base`,
        tip: {
          id: tip?.id,
          creator: creator.name,
          amount: amountNum,
          token: 'USDC',
          chain: 'base',
          network: networkKey,
          slug: creator.slug,
          signature: settleResult.transaction,
        },
      })

    } catch (verifyError: any) {
      console.error('[Base x402 v2] Verification/Settlement error:', verifyError)
      return NextResponse.json(
        { error: 'Payment processing failed', reason: verifyError.message },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[ERROR] Base x402 v2 payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return GET(request, { params })
}
