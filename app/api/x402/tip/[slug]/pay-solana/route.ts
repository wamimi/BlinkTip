/**
 * Solana x402 Payment Endpoint
 *
 * Handles tipping on Solana blockchain using x402 protocol.
 * Manual implementation using x402 verify functions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { useFacilitator } from 'x402/verify'
import { supabase } from '@/lib/supabase'

// Testnet facilitator URL
const TESTNET_FACILITATOR_URL = 'https://x402.org/facilitator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
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

    // Verify creator has Solana wallet address
    if (!creator.solana_wallet_address) {
      return NextResponse.json(
        { error: 'Creator does not accept tips on Solana' },
        { status: 400 }
      )
    }

    console.log('[Solana x402] Creator info:', {
      slug: creator.slug,
      name: creator.name,
      solana_wallet_address: creator.solana_wallet_address,
    })

    const url = new URL(request.url)
    const amount = url.searchParams.get('amount') || '0.01'
    const agentId = url.searchParams.get('agent_id')
    const contentUrl = url.searchParams.get('content_url')
    const payer = url.searchParams.get('payer') // Solana address of the tipper (for feePayer)

    // Validate amount
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Determine network
    const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'solana-devnet') as 'solana' | 'solana-devnet'

    // USDC configuration for Solana
    const usdcDecimals = 6
    const amountInSmallestUnit = Math.floor(amountNum * Math.pow(10, usdcDecimals))

    // Solana USDC mint addresses
    const usdcMints = {
      'solana': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
      'solana-devnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' // Devnet USDC
    }

    // Build payment requirements for Solana
    const paymentRequirements: any = {
      scheme: 'exact' as const,
      payTo: creator.solana_wallet_address, // Base58 Solana address
      network,
      maxAmountRequired: amountInSmallestUnit.toString(), // Must be string
      asset: usdcMints[network], // Base58 USDC mint address
      resource: request.url,
      description: `Tip ${creator.name} $${amount} USDC on Solana`,
      mimeType: 'application/json',
      maxTimeoutSeconds: 300,
    }

    // Add feePayer if provided (required for Solana x402)
    if (payer) {
      paymentRequirements.extra = {
        feePayer: payer
      }
      console.log('[Solana x402] feePayer set to:', payer)
    }

    console.log('[Solana x402] Payment requirements:', JSON.stringify(paymentRequirements, null, 2))

    // Use testnet facilitator for solana-devnet
    const facilitatorConfig = {
      url: TESTNET_FACILITATOR_URL as `${string}://${string}`
    }

    console.log('[Solana x402] Using facilitator:', facilitatorConfig.url)
    const { verify, settle } = useFacilitator(facilitatorConfig)

    // Check if payment header exists
    const paymentHeader = request.headers.get('x-payment')

    if (!paymentHeader) {
      // No payment provided - return 402 with payment requirements
      return NextResponse.json(
        {
          x402Version: 1,
          paymentRequirements: [paymentRequirements],
        },
        { status: 402 }
      )
    }

    // Payment header exists - verify and settle
    console.log('[Solana x402] Verifying payment...')
    console.log('[Solana x402] Payment header received:', paymentHeader.substring(0, 100) + '...')

    // Parse the payment payload from the header
    let paymentPayload
    try {
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8')
      paymentPayload = JSON.parse(decoded)
      console.log('[Solana x402] Decoded payment payload:', paymentPayload)
    } catch (e) {
      console.error('[Solana x402] Failed to parse payment header:', e)
      return NextResponse.json(
        { error: 'Invalid payment header format' },
        { status: 400 }
      )
    }

    console.log('[Solana x402] Using standard x402 PaymentRequirements for verify/settle')

    // verify() expects payment payload and standard payment requirements
    let verificationResult
    try {
      verificationResult = await verify(paymentPayload, paymentRequirements)
      console.log('[Solana x402] Verification result:', verificationResult)
    } catch (error: any) {
      console.error('[Solana x402] Verify failed:', error)
      console.error('[Solana x402] Error message:', error.message)
      console.error('[Solana x402] Error cause:', error.cause)
      throw error
    }

    if (!verificationResult.isValid) {
      console.error('[Solana x402] Payment verification failed:', verificationResult.invalidReason)
      return NextResponse.json(
        { error: 'Payment verification failed', reason: verificationResult.invalidReason },
        { status: 402 }
      )
    }

    console.log('[Solana x402] Payment verified, settling...')

    // Settle the payment on-chain using the same standard format
    const settlementResult = await settle(paymentPayload, paymentRequirements)

    if (!settlementResult.success) {
      console.error('[Solana x402] Settlement failed:', settlementResult.errorReason)
      return NextResponse.json(
        { error: 'Payment settlement failed', reason: settlementResult.errorReason },
        { status: 500 }
      )
    }

    console.log('[Solana x402] Payment settled:', settlementResult.transaction)

    // Record tip in database
    const { data: tip } = await supabase
      .from('tips')
      .insert({
        creator_id: creator.id,
        from_address: agentId || verificationResult.payer || 'solana_tipper',
        amount: amountNum,
        token: 'USDC',
        signature: settlementResult.transaction || 'pending',
        source: agentId ? 'agent' : 'human',
        status: 'confirmed',
        chain: 'solana',
        network: network,
        metadata: {
          network: network,
          facilitator: 'x402.org',
          agent_id: agentId,
          content_url: contentUrl,
        },
      })
      .select()
      .single()

    // Return success with tip info
    return NextResponse.json({
      success: true,
      message: `Successfully tipped ${creator.name} on Solana`,
      tip: {
        id: tip?.id,
        creator: creator.name,
        amount: amountNum,
        token: 'USDC',
        chain: 'solana',
        network: network,
        slug: creator.slug,
        signature: settlementResult.transaction,
      },
    })
  } catch (error) {
    console.error('[ERROR] Solana x402 payment:', error)
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
