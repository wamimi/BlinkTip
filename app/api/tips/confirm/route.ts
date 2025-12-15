import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting: 100 tip confirmations per minute per user
    const rateLimitResult = await rateLimit(`tip_confirm:${session.user.twitterId}`, {
      limit: 100,
      windowInSeconds: 60,
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many confirmation requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { signature, from_address } = body

    if (!signature || !from_address) {
      return NextResponse.json(
        { error: 'Missing required fields: signature, from_address' },
        { status: 400 }
      )
    }

    // Get creator from session
    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('twitter_id', session.user.twitterId)
      .single()

    if (!creator) {
      return NextResponse.json(
        { error: 'Creator profile not found' },
        { status: 404 }
      )
    }

    const creatorId = creator.id

    const updateData: any = {
      signature,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    }

    // Only allow confirming tips for the authenticated creator
    const { data: tips, error } = await supabase
      .from('tips')
      .update(updateData)
      .eq('from_address', from_address)
      .eq('creator_id', creatorId)
      .or('status.eq.pending,status.eq.confirmed')
      .select()

    if (error || !tips || tips.length === 0) {
      console.error('[ERROR] No tip found to confirm:', error)
      return NextResponse.json(
        { error: 'Tip not found or already confirmed' },
        { status: 404 }
      )
    }

    const tip = tips[0]

    if (error) {
      console.error('[ERROR] Failed to confirm tip:', error)
      return NextResponse.json(
        { error: 'Failed to confirm tip' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tip,
    })
  } catch (error) {
    console.error('[ERROR] Tip confirmation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
