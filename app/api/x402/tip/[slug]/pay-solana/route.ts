/**
 * Solana x402 Payment Endpoint
 *
 * Handles tipping on Solana blockchain using x402 protocol.
 * Uses X402PaymentHandler for proper PayAI facilitator integration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { X402PaymentHandler } from 'x402-solana/server'
import { supabase } from '@/lib/supabase'
import { validateTipAmount } from '@/lib/validation'

// Token mint addresses (MUST match what client expects!)
const TOKENS = {
  USDC: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // USDC Devnet (correct address)
  CASH: 'CASHedBw9NfhsLBXq1WNVfueVznx255j8LLTScto3S6s', // Phantom CASH
}

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

    // Create x402 handler with THIS creator's wallet address (not treasury!)
    const x402Handler = new X402PaymentHandler({
      network: 'solana-devnet',
      treasuryAddress: creator.wallet_address, // ✅ Use creator's wallet
      facilitatorUrl: 'https://facilitator.payai.network',
    })

    // Extract payment header if present
    const paymentHeader = x402Handler.extractPayment(request.headers)

    // Get query parameters
    const url = new URL(request.url)
    const amount = url.searchParams.get('amount') || '0.01'
    const token = (url.searchParams.get('token') || 'USDC') as 'USDC' | 'CASH'
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

    const tokenMint = TOKENS[token]
    const amountInMicroUsdc = Math.floor(amountNum * 1_000_000).toString()

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const resourceUrl = `${baseUrl}/api/x402/tip/${slug}/pay-solana?amount=${amount}&token=${token}` as `${string}://${string}`

    // Create payment requirements using X402PaymentHandler
    const paymentRequirements = await x402Handler.createPaymentRequirements({
      price: {
        amount: amountInMicroUsdc,
        asset: {
          address: tokenMint,
          decimals: 6,
        },
      },
      network: 'solana-devnet',
      config: {
        description: `Tip ${creator.name} $${amount} ${token} on Solana`,
        resource: resourceUrl,
      },
    })

    console.log('[Solana x402-PAI] Payment requirements:', JSON.stringify(paymentRequirements, null, 2))

    // If no payment header, return 402 with payment requirements
    if (!paymentHeader) {
      const response = x402Handler.create402Response(paymentRequirements)
      console.log('[Solana x402-PAI] Returning 402 with payment requirements')
      return NextResponse.json(response.body, { status: response.status })
    }

    // Payment header exists - verify with PayAI facilitator
    console.log('[Solana x402-PAI] Verifying payment...')
    console.log('[Solana x402-PAI] Payment header received')

    const verified = await x402Handler.verifyPayment(
      paymentHeader,
      paymentRequirements
    )

    console.log('[Solana x402-PAI] Verification result:', verified)

    if (!verified.isValid) {
      console.error('[Solana x402-PAI] Payment verification failed:', verified.invalidReason)
      return NextResponse.json(
        { error: 'Invalid payment', reason: verified.invalidReason },
        { status: 402 }
      )
    }

    console.log('[Solana x402-PAI] ✓ Payment verified, settling...')

    // Settle the payment on-chain via PayAI facilitator
    const settleResult = await x402Handler.settlePayment(
      paymentHeader,
      paymentRequirements
    )

    if (!settleResult.success) {
      console.error('[Solana x402-PAI] Settlement failed:', settleResult.errorReason)
      return NextResponse.json(
        { error: 'Payment settlement failed', reason: settleResult.errorReason },
        { status: 500 }
      )
    }

    console.log('[Solana x402-PAI] ✓ Payment settled:', settleResult.transaction)

    // Record tip in database
    const { data: tip, error: tipError } = await supabase
      .from('tips')
      .insert({
        creator_id: creator.id,
        from_address: agentId || verified.payer || 'solana_tipper',
        amount: amountNum,
        token: token,
        signature: settleResult.transaction || `pending_${Date.now()}`,
        source: agentId ? 'agent' : 'human',
        status: settleResult.success ? 'confirmed' : 'pending',
        chain: 'solana',
        network: 'solana-devnet',
        metadata: {
          network: 'solana-devnet',
          facilitator: 'payai.network',
          agent_id: agentId,
          content_url: contentUrl,
        },
      })
      .select()
      .single()

    if (tipError) {
      console.error('[ERROR] Failed to record tip:', tipError)
    }

    // Record agent action if this is an agent tip
    if (agentId && !tipError) {
      await supabase.from('agent_actions').insert({
        content_url: contentUrl || 'unknown',
        content_title: creator.name,
        decision: 'tip',
        tip_id: tip?.id,
        reasoning: 'x402 payment completed via Solana',
        metadata: {
          agent_id: agentId,
          network: 'solana-devnet',
          amount: amountNum,
        },
      })
    }

    // Return success with tip info
    return NextResponse.json({
      success: true,
      message: `Successfully tipped ${creator.name} on Solana`,
      tip: {
        id: tip?.id,
        creator: creator.name,
        amount: amountNum,
        token: token,
        chain: 'solana',
        network: 'solana-devnet',
        slug: creator.slug,
        signature: settleResult.transaction,
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
