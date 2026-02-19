import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/auth/privy?privy_user_id=xxx
 *
 * Check if a Privy user already has a creator profile.
 * Used to determine if user should go to registration or dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const privyUserId = searchParams.get('privy_user_id')

    if (!privyUserId) {
      return NextResponse.json(
        { error: 'privy_user_id is required' },
        { status: 400 }
      )
    }

    const { data: creator, error } = await supabase
      .from('creators')
      .select('id, slug, name, bio, avatar_url, evm_wallet_address, wallet_address, twitter_handle, twitter_verified, email')
      .eq('privy_user_id', privyUserId)
      .single()

    if (error || !creator) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      exists: true,
      creator: {
        slug: creator.slug,
        name: creator.name,
        bio: creator.bio,
        avatar_url: creator.avatar_url,
        has_evm_wallet: !!creator.evm_wallet_address,
        has_solana_wallet: !!creator.wallet_address,
        twitter_handle: creator.twitter_handle,
        twitter_verified: creator.twitter_verified,
        email: creator.email,
      },
    })
  } catch (error) {
    console.error('Error checking Privy user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
