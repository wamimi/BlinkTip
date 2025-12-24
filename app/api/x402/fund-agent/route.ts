/**
 * X402 Funding Endpoint for Agent Wallet
 *
 * GET /api/x402/fund-agent
 * - Returns agent wallet info for funding
 *
 * POST /api/x402/fund-agent
 * - x402 payment endpoint
 * - Anyone can fund the agent's wallet with USDC
 * - Returns 402 Payment Required until payment is verified
 */

import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAgentWallet, getAgentBalance } from "@/agent/lib/services/cdp-wallet";
import { X402PaymentHandler } from "x402-solana/server";

export const dynamic = "force-dynamic";

// USDC Devnet mint from spl-token-faucet.com
const USDC_DEVNET_MINT = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

/**
 * GET - Return agent wallet info
 */
export async function GET() {
  try {
    const wallet = await getOrCreateAgentWallet();
    const balance = await getAgentBalance();

    return NextResponse.json({
      success: true,
      message: "BlinkTip Autonomous Agent Funding",
      wallet: {
        address: wallet.address,
        network: "solana-devnet",
        currentBalance: {
          sol: balance.balanceSOL,
          usdc: balance.balanceUSDC,
        },
        canTip: balance.canTip,
        explorerUrl: `https://explorer.solana.com/address/${wallet.address}?cluster=devnet`,
      },
      fundingInstructions: {
        description:
          "Fund the agent wallet to enable autonomous tipping of crypto creators",
        acceptedTokens: ["USDC"],
        minimumAmount: 0.01,
        recommendedAmount: 1.0,
        tipPerCreator: 0.1,
        howToFund: [
          "Send USDC devnet tokens directly to the agent wallet address above",
          "Or use the x402 payment protocol via POST to this endpoint",
          "Get devnet USDC from: https://spl-token-faucet.com",
        ],
      },
      x402Endpoint: {
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/x402/fund-agent`,
        method: "POST",
        queryParams: {
          amount: "Amount in USDC (e.g., 1.0)",
        },
        description: "Use x402 protocol for payment-gated funding",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ Error getting agent wallet info:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST - x402 payment endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Get agent wallet address
    const wallet = await getOrCreateAgentWallet();

    // Create x402 handler with agent wallet address
    const x402Handler = new X402PaymentHandler({
      network: "solana-devnet",
      treasuryAddress: wallet.address,
      facilitatorUrl: "https://facilitator.payai.network",
    });

    const paymentHeader = x402Handler.extractPayment(request.headers);

    // Get amount from query params
    const url = new URL(request.url);
    const amount = url.searchParams.get("amount") || "1.0";
    const amountInMicroUsdc = Math.floor(parseFloat(amount) * 1_000_000).toString();

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const resourceUrl =
      `${baseUrl}/api/x402/fund-agent?amount=${amount}` as `${string}://${string}`;

    const paymentRequirements = await x402Handler.createPaymentRequirements({
      price: {
        amount: amountInMicroUsdc,
        asset: {
          address: USDC_DEVNET_MINT,
          decimals: 6,
        },
      },
      network: "solana-devnet",
      config: {
        description: "Fund BlinkTip autonomous tipping agent",
        resource: resourceUrl,
      },
    });

    // If no payment header, return 402
    if (!paymentHeader) {
      const response = x402Handler.create402Response(paymentRequirements);
      return NextResponse.json(response.body, { status: response.status });
    }

    // Verify payment
    const verified = await x402Handler.verifyPayment(
      paymentHeader,
      paymentRequirements
    );

    if (!verified.isValid) {
      return NextResponse.json(
        { error: "Invalid payment", reason: verified.invalidReason },
        { status: 402 }
      );
    }

    // Settle payment
    const settleResult = await x402Handler.settlePayment(
      paymentHeader,
      paymentRequirements
    );

    if (!settleResult.success) {
      return NextResponse.json(
        { error: "Payment settlement failed", reason: settleResult.errorReason },
        { status: 500 }
      );
    }

    console.log(
      `[x402 Fund Agent] ✓ Payment settled: $${parseFloat(amount).toFixed(2)} USDC`
    );
    console.log(`[x402 Fund Agent] Transaction: ${settleResult.transaction}`);

    // Get updated balance
    const balance = await getAgentBalance();

    return NextResponse.json({
      success: true,
      message: "Agent wallet funded successfully!",
      payment: {
        amount: parseFloat(amount),
        token: "USDC",
        transaction: settleResult.transaction,
        network: "solana-devnet",
      },
      wallet: {
        address: wallet.address,
        newBalance: {
          sol: balance.balanceSOL,
          usdc: balance.balanceUSDC,
        },
        explorerUrl: `https://explorer.solana.com/tx/${settleResult.transaction}?cluster=devnet`,
      },
      impact: {
        potentialTips: Math.floor(balance.balanceUSDC / 0.1),
        message: `Agent can now tip ~${Math.floor(balance.balanceUSDC / 0.1)} creators at $0.10 each`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ x402 funding error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
