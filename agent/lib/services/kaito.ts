/**
 * Kaito Yaps API Service
 */

export interface KaitoYapsScore {
  userId: string;
  username: string;
  yapsAll: number;
  yaps24h: number;
  yaps7d: number;
  yaps30d: number;
  yaps3m?: number;
  yaps6m?: number;
  yaps12m?: number;
}

export interface KaitoAnalysis {
  score: KaitoYapsScore;
  trend: "strongly_rising" | "rising" | "stable" | "declining";
  recommendation: string;
  priority: "high" | "medium" | "low";
}

const KAITO_API_URL = "https://api.kaito.ai/api/v1/yaps";

/**
 * Fetch Yaps score for a Twitter username
 *
 * @param username - Twitter handle WITHOUT @ symbol (e.g., "vitalikbuterin")
 * @returns Yaps score data or null if error
 */
export async function getYapsScore(
  username: string
): Promise<KaitoYapsScore | null> {
  try {
    // Remove @ if included
    const cleanUsername = username.replace("@", "");

    console.log(`[Kaito] Fetching Yaps for @${cleanUsername}...`);

    const response = await fetch(
      `${KAITO_API_URL}?username=${cleanUsername}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(
        `[Kaito] API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    const yapsScore: KaitoYapsScore = {
      userId: data.user_id,
      username: data.username,
      yapsAll: data.yaps_all || 0,
      yaps24h: data.yaps_l24h || 0,
      yaps7d: data.yaps_l7d || 0,
      yaps30d: data.yaps_l30d || 0,
      yaps3m: data.yaps_l3m,
      yaps6m: data.yaps_l6m,
      yaps12m: data.yaps_l12m,
    };

    console.log(`[Kaito] ✓ @${cleanUsername} - 7d: ${yapsScore.yaps7d.toFixed(2)}, 30d: ${yapsScore.yaps30d.toFixed(2)}`);

    return yapsScore;
  } catch (error) {
    console.error(`[Kaito] Error fetching Yaps:`, error);
    return null;
  }
}

/**
 * Analyze Yaps score and determine tip priority and recommendation
 *
 * @param score - Yaps score data
 * @returns Analysis with trend and recommendation
 */
export function analyzeYapsScore(score: KaitoYapsScore): KaitoAnalysis {
  const { yaps7d, yaps30d, yapsAll } = score;

  // Calculate weekly and monthly averages
  const weeklyAvg = yaps7d / 7;
  const monthlyAvg = yaps30d / 30;

  // Determine trend
  let trend: KaitoAnalysis["trend"];
  let priority: KaitoAnalysis["priority"];
  let recommendation: string;

  if (weeklyAvg > monthlyAvg * 1.5) {
    trend = "strongly_rising";
    priority = "high";
    recommendation = `🚀 HIGH PRIORITY - Strong momentum! Weekly average (${weeklyAvg.toFixed(1)}) is 50%+ higher than monthly (${monthlyAvg.toFixed(1)})`;
  } else if (weeklyAvg > monthlyAvg * 1.2) {
    trend = "rising";
    priority = "medium";
    recommendation = `📈 RISING - Good upward trend. Weekly avg ${weeklyAvg.toFixed(1)} vs monthly ${monthlyAvg.toFixed(1)}`;
  } else if (weeklyAvg >= monthlyAvg * 0.8) {
    trend = "stable";
    priority = "medium";
    recommendation = `📊 STABLE - Consistent activity. Weekly ${weeklyAvg.toFixed(1)}, monthly ${monthlyAvg.toFixed(1)}`;
  } else {
    trend = "declining";
    priority = "low";
    recommendation = `📉 DECLINING - Activity slowing down. Consider other creators.`;
  }

  // Boost priority if overall score is very high
  if (yapsAll > 1000 && priority === "medium") {
    priority = "high";
    recommendation += " + High all-time score!";
  }

  return {
    score,
    trend,
    recommendation,
    priority,
  };
}

/**
 * Batch fetch Yaps scores for multiple creators
 * Respects rate limits (100 calls per 5 minutes)
 *
 * @param usernames - Array of Twitter handles
 * @returns Map of username -> score
 */
export async function batchGetYapsScores(
  usernames: string[]
): Promise<Map<string, KaitoYapsScore | null>> {
  const results = new Map<string, KaitoYapsScore | null>();

  console.log(`[Kaito] Fetching Yaps for ${usernames.length} creators...`);

  // Add delay between requests to respect rate limits
  // 100 calls per 5 minutes = 1 call every 3 seconds to be safe
  const DELAY_MS = 3000;

  for (const username of usernames) {
    const score = await getYapsScore(username);
    results.set(username, score);

    // Wait before next request (except for last one)
    if (username !== usernames[usernames.length - 1]) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`[Kaito] ✓ Fetched ${results.size} scores`);

  return results;
}

/**
 * Check if a creator meets minimum Yaps threshold for tipping
 *
 * @param score - Yaps score
 * @param minYaps7d - Minimum 7-day Yaps score (default: 10)
 * @returns true if creator meets threshold
 */
export function meetsYapsThreshold(
  score: KaitoYapsScore | null,
  minYaps7d: number = 10
): boolean {
  if (!score) return false;
  return score.yaps7d >= minYaps7d;
}
