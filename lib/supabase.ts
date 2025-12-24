import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
      )
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseInstance
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return getSupabase()[prop as keyof SupabaseClient]
  }
})

export type Creator = {
  id: string
  slug: string
  wallet_address: string
  name: string
  bio?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export type Tip = {
  id: string
  creator_id: string
  from_address: string
  amount: number
  token: 'USDC' | 'CASH'
  signature: string
  source: 'human' | 'agent'
  status: 'pending' | 'confirmed' | 'failed'
  metadata?: Record<string, unknown> | null  // Changed from any
  created_at: string
  confirmed_at?: string
}

export type AgentAction = {
  id: string
  content_url: string
  content_title?: string
  content_source?: string
  evaluation_score?: number
  decision: 'tip' | 'skip' | 'error'
  tip_id?: string
  reasoning?: string
  metadata?: Record<string, unknown> | null  // Changed from any
  created_at: string
}

export type CreatorStats = {
  id: string
  slug: string
  name: string
  wallet_address: string
  total_tips: number
  human_tips: number
  agent_tips: number
  total_earnings: number
  human_earnings: number
  agent_earnings: number
  last_tip_at?: string
}