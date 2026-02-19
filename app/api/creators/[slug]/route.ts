import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * GET /api/creators/[slug]
 * Fetch a specific creator by slug
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

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
  } catch (error) {
    console.error('Error fetching creator:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/creators/[slug]
 * Update a creator's profile (name, bio, avatar_url)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { name, bio, avatar_url, privy_user_id, evm_wallet_address } = body

    // Verify ownership - must provide privy_user_id or evm_wallet_address
    if (!privy_user_id && !evm_wallet_address) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Fetch the creator to verify ownership
    const { data: creator, error: fetchError } = await supabase
      .from('creators')
      .select('id, privy_user_id, evm_wallet_address')
      .eq('slug', slug)
      .single()

    if (fetchError || !creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      )
    }

    // Verify the requester owns this profile
    const isOwner =
      (privy_user_id && creator.privy_user_id === privy_user_id) ||
      (evm_wallet_address && creator.evm_wallet_address?.toLowerCase() === evm_wallet_address.toLowerCase())

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Not authorized to update this profile' },
        { status: 403 }
      )
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (bio !== undefined) updateData.bio = bio
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update the creator
    const { data: updatedCreator, error: updateError } = await supabase
      .from('creators')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating creator:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      creator: updatedCreator,
    })
  } catch (error) {
    console.error('Error updating creator:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
