/**
 * Database Service for Agent
 *
 * Handles:
 * - Querying verified creators from BlinkTip database
 * - Checking if creator was recently tipped
 * - Logging agent decisions (TIP/SKIP)
 * - Recording tips to database
 
*/

import { supabase } from "@/lib/supabase";

export interface Creator {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  twitterHandle: string;
  twitterId: string;
  twitterVerified: boolean;
  twitterFollowerCount: number;
  twitterCreatedAt: string | null;
  walletAddress: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AgentDecision {
  twitterHandle: string;
  decision: "TIP" | "SKIP";
  reason: string;
  yapsScore7d?: number;
  yapsScore30d?: number;
  amountUSDC?: number;
  tipId?: string;
}

export interface RecentTipCheck {
  wasTippedRecently: boolean;
  lastTipDate?: string;
  daysSinceLastTip?: number;
  recommendation: string;
}

/**
 * Get all verified creators from database
 */
export async function getAllVerifiedCreators(): Promise<Creator[]> {
  try {
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .eq("twitter_verified", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Database] Error fetching creators:", error);
      return [];
    }

    return (
      data?.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        bio: row.bio,
        twitterHandle: row.twitter_handle,
        twitterId: row.twitter_id,
        twitterVerified: row.twitter_verified,
        twitterFollowerCount: row.twitter_follower_count || 0,
        twitterCreatedAt: row.twitter_created_at,
        walletAddress: row.wallet_address,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
      })) || []
    );
  } catch (error) {
    console.error("[Database] Error fetching creators:", error);
    return [];
  }
}

/**
 * Get creator by Twitter handle
 */
export async function getCreatorByTwitterHandle(
  twitterHandle: string
): Promise<Creator | null> {
  try {
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .eq("twitter_handle", twitterHandle)
      .eq("twitter_verified", true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      slug: data.slug,
      name: data.name,
      bio: data.bio,
      twitterHandle: data.twitter_handle,
      twitterId: data.twitter_id,
      twitterVerified: data.twitter_verified,
      twitterFollowerCount: data.twitter_follower_count || 0,
      twitterCreatedAt: data.twitter_created_at,
      walletAddress: data.wallet_address,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error("[Database] Error fetching creator:", error);
    return null;
  }
}

/**
 * Check if agent has tipped this creator recently
 *
 * @param twitterHandle - Creator's Twitter handle
 * @param daysBack - Number of days to look back (default: 7)
 */
export async function checkRecentAgentTip(
  twitterHandle: string,
  daysBack: number = 7
): Promise<RecentTipCheck> {
  try {
    // Get creator first
    const creator = await getCreatorByTwitterHandle(twitterHandle);
    if (!creator) {
      return {
        wasTippedRecently: false,
        recommendation: "Creator not found in database",
      };
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Query tips from agent to this creator
    const { data, error } = await supabase
      .from("tips")
      .select("*")
      .eq("creator_id", creator.id)
      .eq("is_agent_tip", true)
      .gte("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[Database] Error checking recent tips:", error);
      return {
        wasTippedRecently: false,
        recommendation: "Error checking recent tips",
      };
    }

    if (!data || data.length === 0) {
      return {
        wasTippedRecently: false,
        recommendation: "✓ Eligible for tipping",
      };
    }

    const lastTip = data[0];
    const lastTipDate = new Date(lastTip.created_at);
    const daysSince = Math.floor(
      (Date.now() - lastTipDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      wasTippedRecently: true,
      lastTipDate: lastTip.created_at,
      daysSinceLastTip: daysSince,
      recommendation: ` SKIP - Already tipped $${lastTip.amount} USDC ${daysSince} day(s) ago`,
    };
  } catch (error) {
    console.error("[Database] Error checking recent tips:", error);
    return {
      wasTippedRecently: false,
      recommendation: "Error checking recent tips",
    };
  }
}

/**
 * Log agent decision to database
 *
 * @param decision - Agent's decision details
 */
export async function logAgentDecision(
  decision: AgentDecision
): Promise<boolean> {
  try {
    const { error } = await supabase.from("agent_actions").insert({
      content_url: `https://twitter.com/${decision.twitterHandle}`, // Use creator's Twitter profile as content
      twitter_handle: decision.twitterHandle,
      decision: decision.decision,
      reasoning: decision.reason,
      yaps_score_7d: decision.yapsScore7d,
      yaps_score_30d: decision.yapsScore30d,
      tip_id: decision.tipId,
      evaluation_score: decision.yapsScore7d, // Map to existing column
      content_source: "kaito_yaps",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[Database] Error logging decision:", error);
      return false;
    }

    console.log(
      `[Database] ✓ Logged ${decision.decision} for @${decision.twitterHandle}`
    );
    return true;
  } catch (error) {
    console.error("[Database] Error logging decision:", error);
    return false;
  }
}

/**
 * Record agent tip in database
 *
 * @param creatorId - Creator's database ID
 * @param amountUSDC - Tip amount in USDC
 * @param signature - Transaction signature
 * @param reasoning - Why the agent tipped
 */
export async function recordAgentTip(
  creatorId: string,
  amountUSDC: number,
  signature: string,
  reasoning: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("tips")
      .insert({
        creator_id: creatorId,
        amount: amountUSDC,
        token: "USDC",
        signature,
        source: "agent",
        status: "confirmed",
        is_agent_tip: true,
        agent_reasoning: reasoning,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Database] Error recording tip:", error);
      return null;
    }

    console.log(
      `[Database] ✓ Recorded tip: $${amountUSDC} USDC to creator ${creatorId}`
    );
    return data.id;
  } catch (error) {
    console.error("[Database] Error recording tip:", error);
    return null;
  }
}

/**
 * Get agent statistics
 */
export async function getAgentStats() {
  try {
    // Count total decisions
    const { count: totalDecisions } = await supabase
      .from("agent_actions")
      .select("*", { count: "exact", head: true });

    // Count tips
    const { count: totalTips } = await supabase
      .from("agent_actions")
      .select("*", { count: "exact", head: true })
      .eq("decision", "TIP");

    // Sum total tipped amount
    const { data: tipsData } = await supabase
      .from("tips")
      .select("amount")
      .eq("is_agent_tip", true);

    const totalTipped =
      tipsData?.reduce((sum, tip) => sum + Number(tip.amount), 0) || 0;

    return {
      totalDecisions: totalDecisions || 0,
      totalTips: totalTips || 0,
      totalSkips: (totalDecisions || 0) - (totalTips || 0),
      totalTippedUSDC: totalTipped,
    };
  } catch (error) {
    console.error("[Database] Error getting stats:", error);
    return {
      totalDecisions: 0,
      totalTips: 0,
      totalSkips: 0,
      totalTippedUSDC: 0,
    };
  }
}
