/**
 * BlinkTip Autonomous Tipping Agent
 *
 * Autonomous agent that discovers verified creators, analyzes their influence metrics,
 * and distributes USDC tips across multiple blockchains (Solana, Celo) using x402 protocol.
 */

import { ChatOpenAI } from "@langchain/openai";
import {
  getAllVerifiedCreators,
  checkRecentAgentTip,
  logAgentDecision,
  recordAgentTip,
  getAgentStats,
  type Creator,
} from "./services/database";
import {
  getYapsScore,
  analyzeYapsScore,
  type KaitoYapsScore,
} from "./services/kaito";
import {
  getAgentBalance,
  getOrCreateAgentWallet,
} from "./services/cdp-wallet";
import { tipCreatorViaCDP } from "./services/cdp-tipper";
import { tipCreatorViaX402 } from "./services/x402-tipper";
import { getAgentBalanceCelo } from "./services/celo/thirdweb-wallet";
import { tipCreatorViaCeloX402 } from "./services/celo/celo-tipper";

// Agent configuration
const AGENT_CONFIG = {
  MIN_YAPS_THRESHOLD: 0, // Minimum 7-day Yaps score to consider 
  TIP_AMOUNT_USDC: 0.1, // $0.10 per tip
  MAX_TIPS_PER_RUN: 5, // Max tips in a single run
  DAYS_BETWEEN_TIPS: 7, // Don't tip same creator within 7 days
};

export interface AgentRunResult {
  success: boolean;
  creatorsAnalyzed: number;
  tipsCreated: number;
  solanaTips: number;
  celoTips: number;
  skipped: number;
  errors: string[];
  decisions: Array<{
    creator: string;
    decision: "TIP" | "SKIP";
    reason: string;
    amount?: number;
    chains?: string[]; // Which chains were tipped
    signatures?: { chain: string; signature: string }[];
  }>;
  walletBalances: {
    solana: {
      sol: number;
      usdc: number;
    };
    celo: {
      celo: number;
      usdc: number;
      cusd: number;
    };
  };
  stats: {
    totalDecisions: number;
    totalTips: number;
    totalSkips: number;
    totalTippedUSDC: number;
  };
}

/**
 * Initialize OpenRouter LLM client
 */
function initializeAI() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not found in environment variables");
  }

  return new ChatOpenAI({
    model: "anthropic/claude-sonnet-4",
    apiKey: apiKey,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    temperature: 0.7,
  });
}

/**
 * AI analyzes creator and decides whether to tip
 */
async function aiDecision(
  creator: Creator,
  yapsScore: KaitoYapsScore | null,
  recentTipCheck: { wasTippedRecently: boolean; recommendation: string }
): Promise<{ decision: "TIP" | "SKIP"; reason: string }> {
  const llm = initializeAI();

  // Calculate account age in days
  const accountAgeDays = creator.twitterCreatedAt
    ? Math.floor(
        (Date.now() - new Date(creator.twitterCreatedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const prompt = `You are an autonomous AI agent that tips crypto creators on BlinkTip, a decentralized tipping platform.

Your mission: Identify and reward high-quality, influential creators across ALL platforms (Twitter, Instagram, TikTok, YouTube, etc).

CREATOR PROFILE:
- Name: ${creator.name}
- Twitter: @${creator.twitterHandle}
- Bio: ${creator.bio || "No bio"}
- Verified: ${creator.twitterVerified ? "✓ Yes" : "✗ No"}

SOCIAL METRICS:
- Twitter Followers: ${creator.twitterFollowerCount.toLocaleString()}
- Account Age: ${accountAgeDays ? `${accountAgeDays} days (${(accountAgeDays / 365).toFixed(1)} years)` : "Unknown"}

KAITO YAPS SCORE (Crypto Influence - Optional):
${
  yapsScore && yapsScore.yaps7d > 0
    ? `- 7-day score: ${yapsScore.yaps7d.toFixed(2)}
- 30-day score: ${yapsScore.yaps30d.toFixed(2)}
- All-time score: ${yapsScore.yapsAll.toFixed(2)}
- Trend: ${analyzeYapsScore(yapsScore).trend}
- Priority: ${analyzeYapsScore(yapsScore).priority}
- Note: High Yaps score = strong crypto Twitter influence`
    : "- No Yaps score (not crypto-focused or new to crypto Twitter)"
}

RECENT TIP HISTORY:
${recentTipCheck.recommendation}

YOUR BUDGET:
- $${AGENT_CONFIG.TIP_AMOUNT_USDC} USDC per tip
- You can tip up to ${AGENT_CONFIG.MAX_TIPS_PER_RUN} creators per run

DECISION CRITERIA (Be Lenient for MVP):
1. Yaps score is OPTIONAL - reward creators even without it
2. Should NOT have been tipped in last ${AGENT_CONFIG.DAYS_BETWEEN_TIPS} days
3. PRIORITIZE (tip these creators):
   - High Yaps score (crypto influencers) → definitely tip
   - 1000+ followers + account age 1+ year → tip to welcome them
   - Complete profile (bio, verified) → shows legitimacy
   - Rising stars (good engagement) → support early
4. SKIP if:
   - Very new account (<30 days) AND low followers (<100)
   - Recently tipped
   - Suspicious/incomplete profile

Be LENIENT. This is an MVP to test the platform. Tip most verified creators to encourage adoption.

Respond ONLY with valid JSON in this exact format:
{
  "decision": "TIP" or "SKIP",
  "reason": "Brief explanation (1-2 sentences)"
}`;

  try {
    const response = await llm.invoke(prompt);
    const content = response.content.toString();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      decision: parsed.decision.toUpperCase() as "TIP" | "SKIP",
      reason: parsed.reason,
    };
  } catch (error) {
    console.error("[Agent AI] Error making decision:", error);
    return {
      decision: "SKIP",
      reason: "AI decision error - skipping to be safe",
    };
  }
}

/**
 * Run the autonomous tipping agent
 */
export async function runTippingAgent(): Promise<AgentRunResult> {
  console.log("\nBlinkTip Autonomous Agent Starting\n");

  const result: AgentRunResult = {
    success: false,
    creatorsAnalyzed: 0,
    tipsCreated: 0,
    solanaTips: 0,
    celoTips: 0,
    skipped: 0,
    errors: [],
    decisions: [],
    walletBalances: {
      solana: { sol: 0, usdc: 0 },
      celo: { celo: 0, usdc: 0, cusd: 0 },
    },
    stats: { totalDecisions: 0, totalTips: 0, totalSkips: 0, totalTippedUSDC: 0 },
  };

  try {
    console.log("Checking agent wallet...\n");
    const wallet = await getOrCreateAgentWallet();
    const balance = await getAgentBalance();
    result.walletBalances.solana = {
      sol: balance.balanceSOL,
      usdc: balance.balanceUSDC,
    };

    console.log(`Wallet Address: ${wallet.address}`);
    console.log(`Balance: ${balance.balanceSOL.toFixed(4)} SOL, $${balance.balanceUSDC.toFixed(2)} USDC`);

    if (!balance.canTip) {
      const error = `Insufficient funds. Need at least $${AGENT_CONFIG.TIP_AMOUNT_USDC} USDC.`;
      console.log(` ${error}\n`);
      result.errors.push(error);
      return result;
    }

    console.log(`✓ Wallet ready. Can send up to ${Math.floor(balance.balanceUSDC / AGENT_CONFIG.TIP_AMOUNT_USDC)} tips.\n`);

    console.log("Fetching verified creators...\n");
    const creators = await getAllVerifiedCreators();
    console.log(`Found ${creators.length} verified creators\n`);

    if (creators.length === 0) {
      const error = "No verified creators found in database";
      result.errors.push(error);
      return result;
    }

    console.log("Analyzing creators...\n");
    let tipsCreated = 0;

    for (const creator of creators) {
      if (tipsCreated >= AGENT_CONFIG.MAX_TIPS_PER_RUN) {
        console.log(`\n✓ Reached max tips per run (${AGENT_CONFIG.MAX_TIPS_PER_RUN}). Stopping.\n`);
        break;
      }

      console.log(`\n--- Analyzing @${creator.twitterHandle} ---`);
      result.creatorsAnalyzed++;

      try {
        const yapsScore = await getYapsScore(creator.twitterHandle);

        const recentTipCheck = await checkRecentAgentTip(
          creator.twitterHandle,
          AGENT_CONFIG.DAYS_BETWEEN_TIPS
        );

        if (recentTipCheck.wasTippedRecently) {
          console.log(`⏭️  SKIP - ${recentTipCheck.recommendation}`);
          result.skipped++;
          result.decisions.push({
            creator: creator.twitterHandle,
            decision: "SKIP",
            reason: recentTipCheck.recommendation,
          });

          await logAgentDecision({
            twitterHandle: creator.twitterHandle,
            decision: "SKIP",
            reason: recentTipCheck.recommendation,
            yapsScore7d: yapsScore?.yaps7d,
            yapsScore30d: yapsScore?.yaps30d,
          });

          continue;
        }

        console.log(" Asking AI for decision...");
        const aiResponse = await aiDecision(creator, yapsScore, recentTipCheck);
        console.log(`AI Decision: ${aiResponse.decision} - ${aiResponse.reason}`);

        if (aiResponse.decision === "SKIP") {
          result.skipped++;
          result.decisions.push({
            creator: creator.twitterHandle,
            decision: "SKIP",
            reason: aiResponse.reason,
          });

          await logAgentDecision({
            twitterHandle: creator.twitterHandle,
            decision: "SKIP",
            reason: aiResponse.reason,
            yapsScore7d: yapsScore?.yaps7d,
            yapsScore30d: yapsScore?.yaps30d,
          });

          continue;
        }

        console.log(`\nSending $${AGENT_CONFIG.TIP_AMOUNT_USDC} USDC tip via x402...`);
        const tipResult = await tipCreatorViaX402(
          creator.slug,
          AGENT_CONFIG.TIP_AMOUNT_USDC,
          aiResponse.reason
        );

        if (tipResult.success) {
          console.log(`✓ TIP SENT! TX: ${tipResult.signature}`);

          const tipId = await recordAgentTip(
            creator.id,
            AGENT_CONFIG.TIP_AMOUNT_USDC,
            tipResult.signature!,
            aiResponse.reason
          );

          await logAgentDecision({
            twitterHandle: creator.twitterHandle,
            decision: "TIP",
            reason: aiResponse.reason,
            yapsScore7d: yapsScore?.yaps7d,
            yapsScore30d: yapsScore?.yaps30d,
            amountUSDC: AGENT_CONFIG.TIP_AMOUNT_USDC,
            tipId: tipId || undefined,
          });

          result.decisions.push({
            creator: creator.twitterHandle,
            decision: "TIP",
            reason: aiResponse.reason,
            amount: AGENT_CONFIG.TIP_AMOUNT_USDC,
            chains: ["solana"],
            signatures: [{ chain: "solana", signature: tipResult.signature || "unknown" }],
          });

          tipsCreated++;
        } else {
          const error = `Failed to tip @${creator.twitterHandle}: ${tipResult.error}`;
          console.log(` ${error}`);
          result.errors.push(error);
        }
      } catch (error: unknown) {
        const errorMsg = `Error analyzing @${creator.twitterHandle}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(` ${errorMsg}`);
        result.errors.push(errorMsg);
      }

      // Small delay between creators
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    result.tipsCreated = tipsCreated;

    console.log("\nFetching agent statistics...\n");
    result.stats = await getAgentStats();

    result.success = true;

    console.log("\nAgent Run Complete\n");
    console.log(`Creators Analyzed: ${result.creatorsAnalyzed}`);
    console.log(`Tips Created: ${result.tipsCreated}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`\nAll-Time Stats:`);
    console.log(`- Total Decisions: ${result.stats.totalDecisions}`);
    console.log(`- Total Tips: ${result.stats.totalTips}`);
    console.log(`- Total Tipped: $${result.stats.totalTippedUSDC.toFixed(2)} USDC\n`);

    return result;
  } catch (error: unknown) {
    console.error("\n Agent run failed:", error);
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }
}
