/**
 * Base x402 Payment Endpoint
 *
 * Handles tipping on Base blockchain using CDP's x402 protocol.
 * Manual implementation using x402 verify functions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { useFacilitator } from 'x402/verify'
import { facilitator } from '@coinbase/x402'
import { supabase } from '@/lib/supabase'

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

    // Determine network
    const network = (process.env.NEXT_PUBLIC_BASE_NETWORK || 'base-sepolia') as 'base' | 'base-sepolia'

    // Get facilitator functions
    const { verify, settle } = useFacilitator(facilitator)

    // Check if payment header exists
    const paymentHeader = request.headers.get('x-payment')

    if (!paymentHeader) {
      // No payment provided - return 402 with payment requirements
      const usdcDecimals = 6
      const amountInSmallestUnit = Math.floor(amountNum * Math.pow(10, usdcDecimals))

      // USDC contract addresses
      const usdcAddresses = {
        'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
      }

      const paymentRequirements = {
        scheme: 'exact' as const,
        to: creator.evm_wallet_address as `0x${string}`,
        network,
        price: {
          amount: amountInSmallestUnit.toString(),
          asset: {
            address: usdcAddresses[network] as `0x${string}`,
            decimals: usdcDecimals,
          },
        },
        resource: request.url,
        description: `Tip ${creator.name} $${amount} USDC on Base`,
      }

      return NextResponse.json(
        {
          x402Version: 1,
          paymentRequirements: [paymentRequirements],
        },
        { status: 402 }
      )
    }

    // Payment header exists - verify and settle
    console.log('[Base x402] Verifying payment...')

    const verificationResult = await verify(paymentHeader)

    if (!verificationResult.isValid) {
      console.error('[Base x402] Payment verification failed:', verificationResult.error)
      return NextResponse.json(
        { error: 'Payment verification failed', reason: verificationResult.error },
        { status: 402 }
      )
    }

    console.log('[Base x402] Payment verified, settling...')

    // Settle the payment on-chain
    const settlementResult = await settle(paymentHeader)

    if (!settlementResult.success) {
      console.error('[Base x402] Settlement failed:', settlementResult.error)
      return NextResponse.json(
        { error: 'Payment settlement failed', reason: settlementResult.error },
        { status: 500 }
      )
    }

    console.log('[Base x402] Payment settled:', settlementResult.transactionHash)

    // Record tip in database
    const { data: tip } = await supabase
      .from('tips')
      .insert({
        creator_id: creator.id,
        from_address: agentId || verificationResult.from || 'base_tipper',
        amount: amountNum,
        token: 'USDC',
        signature: settlementResult.transactionHash || 'pending',
        source: agentId ? 'agent' : 'human',
        status: 'confirmed',
        chain: 'base',
        network: network,
        metadata: {
          network: network,
          facilitator: 'cdp',
          agent_id: agentId,
          content_url: contentUrl,
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
        network: network,
        slug: creator.slug,
        signature: settlementResult.transactionHash,
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
