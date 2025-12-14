import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

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

    const body = await request.json()
    const { signature, from_address, creator_slug } = body

    if (!signature || !from_address) {
      return NextResponse.json(
        { error: 'Missing required fields: signature, from_address' },
        { status: 400 }
      )
    }

    let creatorId: string | undefined

    if (creator_slug) {
      const { data: creator } = await supabase
        .from('creators')
        .select('id')
        .eq('slug', creator_slug)
        .single()

      creatorId = creator?.id
    }

    const updateData: any = {
      signature,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    }

    let query = supabase
      .from('tips')
      .update(updateData)
      .eq('from_address', from_address)

    if (creatorId) {
      query = query.eq('creator_id', creatorId)
    }

    // Only filter by pending if we haven't already confirmed it
    query = query.or('status.eq.pending,status.eq.confirmed')

    const { data: tips, error } = await query.select()

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
