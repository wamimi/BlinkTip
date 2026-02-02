import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { rateLimit } from '@/lib/rate-limit'
import { verifySolanaSignature, verifyEVMSignature } from '@/lib/wallet-verification'

export async function POST(request: NextRequest) {
  try {
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
      evm_verification_message,
      farcaster_fid,
      farcaster_username,
      privy_user_id,
      email,
    } = body

    // Check authentication
    const session = await getServerSession(authOptions)

    // For mini app (Base Account): wallet signature is sufficient, no Twitter auth needed
    // For web app: Twitter auth is required
    const isMiniAppUser = evm_wallet_address && !session?.user?.twitterId
    const isWebUser = !!session?.user?.twitterId

    if (!isMiniAppUser && !isWebUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting: use wallet address for mini app, Twitter ID for web
    const rateLimitKey = isMiniAppUser
      ? `creator_reg:wallet:${evm_wallet_address}`
      : `creator_reg:tw:${session?.user?.twitterId}`

    const rateLimitResult = await rateLimit(rateLimitKey, {
      limit: 5,
      windowInSeconds: 3600,
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many creator registration attempts. Please try again later.' },
        { status: 429 }
      )
    }

    if (!slug || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, name' },
        { status: 400 }
      )
    }

    if (!wallet_address && !evm_wallet_address) {
      return NextResponse.json(
        { error: 'At least one wallet address (Solana or EVM) is required' },
        { status: 400 }
      )
    }

    if (wallet_address) {
      if (!wallet_signature || !verification_message) {
        return NextResponse.json(
          { error: 'Solana wallet signature and verification message required' },
          { status: 400 }
        )
      }

      const solanaVerification = await verifySolanaSignature(
        wallet_address,
        wallet_signature,
        verification_message
      )

      if (!solanaVerification.valid) {
        return NextResponse.json(
          { error: `Solana wallet verification failed: ${solanaVerification.error}` },
          { status: 400 }
        )
      }
    }

    if (evm_wallet_address) {
      if (!evm_wallet_signature || !evm_verification_message) {
        return NextResponse.json(
          { error: 'EVM wallet signature and verification message required' },
          { status: 400 }
        )
      }

      // Log signature details before verification
      console.log('[API /api/creators] EVM Wallet Address:', evm_wallet_address)
      console.log('[API /api/creators] Signature Length:', evm_wallet_signature.length)
      console.log('[API /api/creators] Signature Type:',
        evm_wallet_signature.length === 132 ? 'Standard EOA (132 chars)' :
        evm_wallet_signature.length > 132 ? `Smart Wallet (${evm_wallet_signature.length} chars)` :
        'Invalid/Unknown'
      )
      console.log('[API /api/creators] Message Length:', evm_verification_message.length)

      const evmVerification = await verifyEVMSignature(
        evm_wallet_address,
        evm_wallet_signature,
        evm_verification_message
      )

      if (!evmVerification.valid) {
        console.error('[API /api/creators] Verification failed:', evmVerification.error)
        return NextResponse.json(
          { error: `EVM wallet verification failed: ${evmVerification.error}` },
          { status: 400 }
        )
      }

      console.log('[API /api/creators] ✅ EVM signature verified successfully')
    }

    // Validate slug format
    if (!/^[a-z0-9_-]{3,50}$/.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid slug format. Use 3-50 lowercase letters, numbers, hyphens, or underscores' },
        { status: 400 }
      )
    }

    // FID-based profile handling: Check if user already has a profile with this FID
    if (farcaster_fid) {
      const { data: existingByFid, error: fidError } = await supabase
        .from('creators')
        .select('*')
        .eq('farcaster_fid', farcaster_fid)
        .single()

      if (existingByFid && !fidError) {
        // User already has a profile with this FID - add new wallet to existing profile
        const updateData: any = {}

        // Add new wallet address if provided
        if (wallet_address && !existingByFid.wallet_address) {
          updateData.wallet_address = wallet_address
        }
        if (evm_wallet_address && !existingByFid.evm_wallet_address) {
          updateData.evm_wallet_address = evm_wallet_address
        }

        // Update supported chains if new chain is being added
        if (supported_chains && supported_chains.length > 0) {
          const existingChains = existingByFid.supported_chains || []
          const newChains = [...new Set([...existingChains, ...supported_chains])]
          updateData.supported_chains = newChains
        }

        // If both wallets are already set, return error
        if (Object.keys(updateData).length === 0) {
          return NextResponse.json(
            {
              error: 'Profile already exists for this Farcaster account with all wallets configured',
              creator: existingByFid
            },
            { status: 409 }
          )
        }

        // Update existing profile with new wallet
        const { data: updatedCreator, error: updateError } = await supabase
          .from('creators')
          .update(updateData)
          .eq('farcaster_fid', farcaster_fid)
          .select()
          .single()

        if (updateError) {
          console.error('Database update error:', updateError)
          return NextResponse.json(
            { error: 'Failed to update creator profile' },
            { status: 500 }
          )
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

        return NextResponse.json({
          success: true,
          creator: updatedCreator,
          message: 'New wallet added to existing profile',
          tip_link: `${baseUrl}/tip/${updatedCreator.slug}`,
          blink_url: `https://dial.to/?action=solana-action:${baseUrl}/api/actions/tip/${updatedCreator.slug}`,
          x402_endpoint: `${baseUrl}/api/x402/tip/${updatedCreator.slug}/pay-solana`,
        }, { status: 200 })
      }
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
        twitter_verified: !!twitter_id,
        twitter_follower_count: twitter_follower_count || 0,
        twitter_created_at: twitter_created_at || null,
        farcaster_fid: farcaster_fid || null,
        farcaster_username: farcaster_username || null,
        farcaster_verified: !!farcaster_fid,
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
