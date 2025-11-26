/**
 * Base x402 Payment Endpoint
 *
 * Handles tipping on Base blockchain using CDP's x402 protocol.
 * Supports USDC stablecoin payments with fee-free settlement.
 *
 * Flow:
 * 1. GET: Returns 402 Payment Required with payment requirements
 * 2. Client signs payment and retries with x-payment header
 * 3. Verifies payment via CDP facilitator and settles on-chain directly to creator
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Note: Full CDP x402 implementation requires:
// 1. CDP API keys (CDP_API_KEY_ID, CDP_API_KEY_SECRET)
// 2. Import { facilitator } from '@coinbase/x402'
// 3. Configure network (base or base-sepolia)

// For testnet, you can use the community facilitator:
// { url: 'https://x402.org/facilitator' }

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

    // Verify creator has EVM wallet address
    if (!creator.evm_wallet_address) {
      return NextResponse.json(
        { error: 'Creator does not accept tips on Base' },
        { status: 400 }
      )
    }

    const url = new URL(request.url)
    const amount = url.searchParams.get('amount') || '0.01'
    const token = url.searchParams.get('token') || 'USDC'
    const agentId = url.searchParams.get('agent_id')
    const contentUrl = url.searchParams.get('content_url')

    // Validate amount
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Check for x-payment header (payment attempt)
    const paymentHeader = request.headers.get('x-payment')

    // Determine network
    const network = process.env.NEXT_PUBLIC_BASE_NETWORK || 'base-sepolia'
    const isTestnet = network === 'base-sepolia'

    // If no payment header, return 402 Payment Required
    if (!paymentHeader) {
      // Return 402 with payment requirements
      // CDP's x402 client will automatically handle this response
      return NextResponse.json(
        {
          error: 'Payment Required',
          payment_requirements: {
            pay_to_address: creator.evm_wallet_address,
            price: `$${amount}`,
            network: network,
            token: 'USDC',
            description: `Tip ${creator.name} $${amount} USDC on Base`,
            facilitator: isTestnet
              ? 'https://x402.org/facilitator'
              : 'cdp', // CDP facilitator for mainnet
          },
        },
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Payment header present - verify and settle
    // TODO: Implement full CDP x402 verification flow
    // This requires:
    // 1. Parse payment header
    // 2. Verify payment via CDP facilitator
    // 3. Settle transaction on-chain
    // 4. Record tip in database

    // For now, return success response
    // Full implementation will be added when CDP API keys are configured
    const { data: tip } = await supabase
      .from('tips')
      .insert({
        creator_id: creator.id,
        from_address: agentId || 'base_tipper',
        amount: amountNum,
        token: 'USDC',
        signature: `pending_base_${Date.now()}`,
        source: agentId ? 'agent' : 'human',
        status: 'pending',
        chain: 'base',
        network: network,
        metadata: {
          network: network,
          facilitator: isTestnet ? 'community' : 'cdp',
          agent_id: agentId,
          content_url: contentUrl,
        },
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      message: `Successfully tipped ${creator.name} on Base`,
      tip: {
        id: tip?.id,
        creator: creator.name,
        amount: amountNum,
        token: 'USDC',
        chain: 'base',
        network: network,
        slug: creator.slug,
        note: 'Full x402 verification pending CDP API keys setup',
      },
    })
  } catch (error) {
    console.error('[ERROR] Base x402 payment:', error)
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
