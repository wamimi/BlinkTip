import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { rateLimit } from '@/lib/rate-limit'
import { verifySolanaSignature, verifyEVMSignature } from '@/lib/wallet-verification'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.twitterId) {
      return NextResponse.json(
        { error: 'Unauthorized - Twitter authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting: 5 creator registrations per hour per user
    const rateLimitResult = await rateLimit(`creator_reg:${session.user.twitterId}`, {
      limit: 5,
      windowInSeconds: 3600,
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many creator registration attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const {
      slug,
      wallet_address,
      name,
      bio,
      avatar_url,
      evm_wallet_address,
      supported_chains,
      twitter_id,
      twitter_handle,
      twitter_name,
      twitter_avatar_url,
      twitter_follower_count,
      twitter_created_at,
      wallet_signature,
      evm_wallet_signature,
      verification_message,
    } = body

    // Validate required fields
    if (!slug || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, name' },
        { status: 400 }
      )
    }

    // Must have at least one wallet address
    if (!wallet_address && !evm_wallet_address) {
      return NextResponse.json(
        { error: 'At least one wallet address (Solana or EVM) is required' },
        { status: 400 }
      )
    }

    // Validate slug format
    if (!/^[a-z0-9_-]{3,50}$/.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid slug format. Use 3-50 lowercase letters, numbers, hyphens, or underscores' },
        { status: 400 }
      )
    }

    // Check if slug or wallet already exists
    const orConditions = [`slug.eq.${slug}`]
    if (wallet_address) {
      orConditions.push(`wallet_address.eq.${wallet_address}`)
    }
    if (evm_wallet_address) {
      orConditions.push(`evm_wallet_address.eq.${evm_wallet_address}`)
    }

    const { data: existing } = await supabase
      .from('creators')
      .select('slug, wallet_address, evm_wallet_address')
      .or(orConditions.join(','))

    // If there's data returned, check for conflicts
    if (existing && existing.length > 0) {
      const conflict = existing[0]
      if (conflict.slug === slug) {
        return NextResponse.json(
          { error: 'Slug already taken' },
          { status: 409 }
        )
      }
      if (wallet_address && conflict.wallet_address === wallet_address) {
        return NextResponse.json(
          { error: 'Solana wallet address already registered' },
          { status: 409 }
        )
      }
      if (evm_wallet_address && conflict.evm_wallet_address === evm_wallet_address) {
        return NextResponse.json(
          { error: 'EVM wallet address already registered' },
          { status: 409 }
        )
      }
    }

    // Create creator
    const { data: creator, error } = await supabase
      .from('creators')
      .insert({
        slug,
        wallet_address: wallet_address || null,
        name,
        bio: bio || null,
        avatar_url: avatar_url || null,
        evm_wallet_address: evm_wallet_address || null,
        supported_chains: supported_chains || ['solana'],
        twitter_id: twitter_id || null,
        twitter_handle: twitter_handle || null,
        twitter_name: twitter_name || null,
        twitter_avatar_url: twitter_avatar_url || null,
        twitter_verified: !!twitter_id, // If we have twitter_id, they're verified
        twitter_follower_count: twitter_follower_count || 0,
        twitter_created_at: twitter_created_at || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create creator' },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    return NextResponse.json({
      success: true,
      creator,
      tip_link: `${baseUrl}/tip/${slug}`,
      blink_url: `https://dial.to/?action=solana-action:${baseUrl}/api/actions/tip/${slug}`,
      x402_endpoint: `${baseUrl}/api/x402/tip/${slug}/pay-solana`,
    }, { status: 201 })

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const wallet = searchParams.get('wallet')

    if (slug) {
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

      return NextResponse.json({ creator })
    }

    if (wallet) {
      const { data: creator, error } = await supabase
        .from('creators')
        .select('*')
        .eq('wallet_address', wallet)
        .single()

      if (error || !creator) {
        return NextResponse.json(
          { error: 'Creator not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ creator })
    }

    // List all creators
    const { data: creators, error } = await supabase
      .from('creators')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch creators' },
        { status: 500 }
      )
    }

    return NextResponse.json({ creators })

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
