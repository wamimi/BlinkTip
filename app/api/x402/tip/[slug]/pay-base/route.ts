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
import { getAddress } from 'viem'

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

    console.log('[Base x402] Creator info:', {
      slug: creator.slug,
      name: creator.name,
      evm_wallet_address: creator.evm_wallet_address,
    })

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

    // USDC configuration
    const usdcDecimals = 6
    const amountInSmallestUnit = Math.floor(amountNum * Math.pow(10, usdcDecimals))
    const usdcAddresses = {
      'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
    }

    // Standard x402 payment requirements (for 402 response to client)
    // Ensure addresses are checksummed
    const checksummedPayTo = getAddress(creator.evm_wallet_address)
    const checksummedAsset = getAddress(usdcAddresses[network])

    const paymentRequirements = {
      scheme: 'exact' as const,
      payTo: checksummedPayTo,
      network,
      maxAmountRequired: amountInSmallestUnit.toString(), // Must be string
      asset: checksummedAsset,
      resource: request.url,
      description: `Tip ${creator.name} $${amount} USDC on Base`,
      mimeType: 'application/json',
      maxTimeoutSeconds: 300,
    }

    console.log('[Base x402] Payment requirements (standard x402 format):', JSON.stringify(paymentRequirements, null, 2))

    // Get facilitator functions
    console.log('[Base x402] CDP API Key ID:', process.env.CDP_API_KEY_ID ? 'Set ✓' : 'Missing ✗')
    console.log('[Base x402] CDP API Secret:', process.env.CDP_API_KEY_SECRET ? 'Set ✓' : 'Missing ✗')
    console.log('[Base x402] Facilitator config:', facilitator)

    const { verify, settle } = useFacilitator(facilitator)

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
    console.log('[Base x402] Verifying payment...')
    console.log('[Base x402] Payment header received:', paymentHeader.substring(0, 100) + '...')

    // Parse the payment payload from the header
    let paymentPayload
    try {
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8')
      paymentPayload = JSON.parse(decoded)
      console.log('[Base x402] Decoded payment payload:', paymentPayload)
    } catch (e) {
      console.error('[Base x402] Failed to parse payment header:', e)
      return NextResponse.json(
        { error: 'Invalid payment header format' },
        { status: 400 }
      )
    }

    // The facilitator uses the SAME standard x402 format as the client!
    console.log('[Base x402] Using standard x402 PaymentRequirements for verify/settle')

    // verify() expects payment payload and standard payment requirements
    let verificationResult
    try {
      verificationResult = await verify(paymentPayload, paymentRequirements as any)
      console.log('[Base x402] Verification result:', verificationResult)
    } catch (error: any) {
      console.error('[Base x402] Verify failed:', error)
      console.error('[Base x402] Error message:', error.message)
      console.error('[Base x402] Error cause:', error.cause)
      throw error
    }

    if (!verificationResult.isValid) {
      console.error('[Base x402] Payment verification failed:', verificationResult.invalidReason)
      return NextResponse.json(
        { error: 'Payment verification failed', reason: verificationResult.invalidReason },
        { status: 402 }
      )
    }

    console.log('[Base x402] Payment verified, settling...')

    // Settle the payment on-chain using the same standard format
    const settlementResult = await settle(paymentPayload, paymentRequirements as any)

    if (!settlementResult.success) {
      console.error('[Base x402] Settlement failed:', settlementResult.errorReason)
      return NextResponse.json(
        { error: 'Payment settlement failed', reason: settlementResult.errorReason },
        { status: 500 }
      )
    }

    console.log('[Base x402] Payment settled:', settlementResult.transaction)

    // Record tip in database
    const { data: tip } = await supabase
      .from('tips')
      .insert({
        creator_id: creator.id,
        from_address: agentId || verificationResult.payer || 'base_tipper',
        amount: amountNum,
        token: 'USDC',
        signature: settlementResult.transaction || 'pending',
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
        signature: settlementResult.transaction,
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
