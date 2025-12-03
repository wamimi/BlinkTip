/**
 * Solana x402 Payment Endpoint
 *
 * Handles tipping on Solana blockchain using x402 protocol.
 * Manual implementation using x402 verify functions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { FacilitatorClient } from 'x402-solana/server'
import { supabase } from '@/lib/supabase'

// PAI Network facilitator URL
const PAI_FACILITATOR_URL = 'https://facilitator.payai.network'
const facilitatorClient = new FacilitatorClient(PAI_FACILITATOR_URL)

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
    if (!creator.wallet_address) {
      return NextResponse.json(
        { error: 'Creator does not accept tips on Solana' },
        { status: 400 }
      )
    }

    console.log('[Solana x402] Creator info:', {
      slug: creator.slug,
      name: creator.name,
      wallet_address: creator.wallet_address,
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
      payTo: creator.wallet_address, // Base58 Solana address
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

    console.log('[Solana x402-PAI] Payment requirements:', JSON.stringify(paymentRequirements, null, 2))
    console.log('[Solana x402-PAI] Using PAI facilitator:', PAI_FACILITATOR_URL)

    // Check if payment header exists
    const paymentHeader = request.headers.get('x-payment')

    if (!paymentHeader) {
      // No payment provided - return 402 with payment requirements (PAI format)
      return NextResponse.json(
        {
          x402Version: 1,
          accepts: [paymentRequirements],
        },
        { status: 402 }
      )
    }

    // Payment header exists - verify and settle with PAI facilitator
    console.log('[Solana x402-PAI] Verifying payment...')
    console.log('[Solana x402-PAI] Payment header received')

    // Verify payment with PAI facilitator
    let verificationResult
    try {
      verificationResult = await facilitatorClient.verifyPayment(
        paymentHeader,
        paymentRequirements
      )
      console.log('[Solana x402-PAI] Verification result:', verificationResult)
    } catch (error: any) {
      console.error('[Solana x402-PAI] Verify failed:', error)
      console.error('[Solana x402-PAI] Error message:', error.message)
      throw error
    }

    if (!verificationResult.isValid) {
      console.error('[Solana x402-PAI] Payment verification failed:', verificationResult.invalidReason)
      return NextResponse.json(
        { error: 'Payment verification failed', reason: verificationResult.invalidReason },
        { status: 402 }
      )
    }

    console.log('[Solana x402-PAI] Payment verified, settling...')

    // Settle the payment on-chain via PAI facilitator
    const settlementResult = await facilitatorClient.settlePayment(
      paymentHeader,
      paymentRequirements
    )

    if (!settlementResult.success) {
      console.error('[Solana x402-PAI] Settlement failed:', settlementResult.errorReason)
      return NextResponse.json(
        { error: 'Payment settlement failed', reason: settlementResult.errorReason },
        { status: 500 }
      )
    }

    console.log('[Solana x402-PAI] Payment settled:', settlementResult.transaction)

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
          facilitator: 'payai.network',
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
