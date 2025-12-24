/**
 * API Endpoint: POST /api/agent/tips
 *
 * Records agent tips that have already been settled via x402 facilitator
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Connection, PublicKey } from '@solana/web3.js'

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { creatorSlug, amount, signature, reason, agentId } = body

    if (!creatorSlug || !amount || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields: creatorSlug, amount, signature' },
        { status: 400 }
      )
    }

    // Get creator
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('*')
      .eq('slug', creatorSlug)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      )
    }

    // Verify transaction exists on-chain
    let transactionExists = false
    try {
      const tx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      })
      transactionExists = tx !== null && tx.meta?.err === null
    } catch (error) {
      console.warn('[Agent Tips] Could not verify transaction on-chain:', error)
    }

    // Get agent wallet address for from_address
    const agentWalletAddress = '3igN8HVgmkvnNvnjyXPRJftSM6cQHENPzpRwgWGbYHKh' // Agent's CDP wallet

    // Record tip in database
    const { data: tip, error: tipError } = await supabase
      .from('tips')
      .insert({
        creator_id: creator.id,
        from_address: agentWalletAddress,
        amount: parseFloat(amount),
        token: 'USDC',
        signature: signature,
        source: 'agent',
        status: transactionExists ? 'confirmed' : 'pending',
        is_agent_tip: true,
        agent_reasoning: reason,
        metadata: {
          network: 'solana-devnet',
          protocol: 'x402',
          agent_id: agentId,
          verified_on_chain: transactionExists,
        },
      })
      .select()
      .single()

    if (tipError) {
      console.error('[Agent Tips] Failed to record tip:', tipError)
      return NextResponse.json(
        { error: 'Failed to record tip', details: tipError.message },
        { status: 500 }
      )
    }

    // Record agent decision
    if (agentId) {
      await supabase.from('agent_actions').insert({
        twitter_handle: creator.twitter_handle,
        content_url: `https://twitter.com/${creator.twitter_handle}`,
        content_title: creator.name,
        decision: 'TIP',
        tip_id: tip.id,
        reasoning: reason || 'Autonomous tip via x402',
        yaps_score_7d: null,
        yaps_score_30d: null,
        evaluation_score: null,
        content_source: 'x402',
        metadata: {
          agent_id: agentId,
          network: 'solana-devnet',
          amount: parseFloat(amount),
          signature: signature,
        },
      })
    }

    console.log(`[Agent Tips] ✓ Recorded tip for @${creator.twitter_handle}: $${amount} USDC (${signature})`)

    return NextResponse.json({
      success: true,
      message: `Successfully recorded tip for ${creator.name}`,
      tip: {
        id: tip.id,
        creator: creator.name,
        amount: amount,
        signature: signature,
        verified_on_chain: transactionExists,
      },
    })
  } catch (error) {
    console.error('[Agent Tips] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
