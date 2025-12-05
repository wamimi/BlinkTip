/**
 * API Endpoint: POST /api/agent/run
 *
 * Triggers the autonomous tipping agent
 */

import { NextRequest, NextResponse } from "next/server";
import { runTippingAgent } from "@/agent/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max execution time

export async function POST(request: NextRequest) {
  console.log("\n  Agent run triggered via API\n");

  try {
    // Add authentication
    const authHeader = request.headers.get("authorization")

    // Run the agent
    const result = await runTippingAgent();

    return NextResponse.json(
      {
        success: result.success,
        message: result.success
          ? "Agent run completed successfully"
          : "Agent run failed",
        data: {
          creatorsAnalyzed: result.creatorsAnalyzed,
          tipsCreated: result.tipsCreated,
          solanaTips: result.solanaTips,
          celoTips: result.celoTips,
          skipped: result.skipped,
          errors: result.errors,
          decisions: result.decisions,
          walletBalances: result.walletBalances,
          stats: result.stats,
        },
        timestamp: new Date().toISOString(),
      },
      { status: result.success ? 200 : 500 }
    );
  } catch (error: any) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET for easy browser testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "BlinkTip Autonomous Agent",
    usage: "Send POST request to /api/agent/run to trigger agent",
    documentation: "See /docs/agent.md for more info",
    timestamp: new Date().toISOString(),
  });
}
