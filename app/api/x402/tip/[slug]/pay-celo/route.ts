/**
 * Celo x402 Payment Endpoint
 *
 * Handles tipping on Celo blockchain using thirdweb's x402 protocol.
 * Supports USDC and cUSD stablecoins on Celo Sepolia testnet.
 *
 * Flow:
 * 1. GET: Returns 402 Payment Required with payment requirements
 * 2. POST: Verifies payment and settles on-chain via thirdweb facilitator
 */

import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, defineChain } from "thirdweb";
import { settlePayment, facilitator } from "thirdweb/x402";
import { supabase } from "@/lib/supabase";
import { validateTipAmount } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";

// Environment configuration
const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY!;
const THIRDWEB_SERVER_WALLET = process.env.THIRDWEB_SERVER_WALLET_ADDRESS!;
const CELO_CHAIN_ID = parseInt(process.env.CELO_CHAIN_ID || "11142220");
const CELO_RPC_URL = process.env.CELO_RPC_URL!;

// Token addresses on Celo Sepolia
const CELO_USDC_TOKEN = process.env.CELO_USDC_TOKEN!; // 6 decimals
const CELO_USDC_ADAPTER = process.env.CELO_USDC_ADAPTER!; // For gas fee calculation
const CELO_CUSD_ADDRESS = process.env.CELO_CUSD_ADDRESS!; // 18 decimals

// Initialize thirdweb client
const client = createThirdwebClient({
  secretKey: THIRDWEB_SECRET_KEY,
});

// Define Celo Sepolia chain
const celoSepolia = defineChain({
  id: CELO_CHAIN_ID,
  rpc: CELO_RPC_URL,
});

// Create thirdweb facilitator
const thirdwebFacilitator = facilitator({
  client,
  serverWalletAddress: THIRDWEB_SERVER_WALLET,
  waitUntil: "confirmed", // Wait for on-chain confirmation
});

/**
 * GET /api/x402/tip/[slug]/pay-celo?amount=X&token=USDC&agent_id=...
 *
 * Returns 402 Payment Required with payment requirements for thirdweb x402 client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Rate limiting: 20 payment requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitResult = await rateLimit(`x402_celo:${ip}`, {
      limit: 20,
      windowInSeconds: 60,
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many payment requests. Please try again later.' },
        { status: 429 }
      )
    }

    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const amountParam = searchParams.get("amount") || "0";
    const token = searchParams.get("token") || "USDC";
    const agentId = searchParams.get("agent_id");
    const contentUrl = searchParams.get("content_url");

    // Check for x-payment header first (if present, this is a retry with payment)
    const paymentHeader = request.headers.get("x-payment");

    // Validate amount
    const validation = validateTipAmount(amountParam);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    const amount = validation.value!

    // Validate token
    if (!["USDC", "cUSD"].includes(token)) {
      return NextResponse.json(
        { error: "Unsupported token. Use USDC or cUSD" },
        { status: 400 }
      );
    }

    // Get creator info
    const { data: creator, error: creatorError } = await supabase
      .from("creators")
      .select("*")
      .eq("slug", slug)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Check if creator has Celo wallet
    if (!creator.celo_wallet_address) {
      return NextResponse.json(
        { error: "Creator does not accept tips on Celo" },
        { status: 400 }
      );
    }

    // Determine token address and price format
    let priceConfig: any;

    if (token === "USDC") {
      priceConfig = {
        amount: (amount * 1_000_000).toString(),
        asset: {
          address: CELO_USDC_TOKEN,
          decimals: 6,
        },
      };
    } else if (token === "cUSD") {
      priceConfig = {
        amount: (amount * 1e18).toString(),
        asset: {
          address: CELO_CUSD_ADDRESS,
          decimals: 18,
        },
      };
    }

    // Construct resource URL (this endpoint)
    const resourceUrl = `${request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`;

    if (paymentHeader) {
      // Process payment - X-PAYMENT header is present
      console.log("[Celo x402] Received payment header, settling payment...");
      console.log(`  Amount: ${amount} ${token}`);
      console.log(`  Creator: ${creator.slug} (${creator.celo_wallet_address})`);

      const result = await settlePayment({
        resourceUrl,
        method: "GET",
        paymentData: paymentHeader,
        payTo: creator.celo_wallet_address,
        network: celoSepolia,
        price: priceConfig,
        facilitator: thirdwebFacilitator,
        routeConfig: {
          description: `Tip ${creator.name} (@${creator.slug}) on BlinkTip`,
          mimeType: "application/json",
          maxTimeoutSeconds: 300,
        },
      });

      if (result.status !== 200) {
        console.error("[Celo x402] Payment failed:", (result as any).responseBody);
        return NextResponse.json((result as any).responseBody, {
          status: result.status,
          headers: result.responseHeaders,
        });
      }

      console.log("[Celo x402] ✓ Payment settled successfully");
      const transactionHash = result.paymentReceipt?.transaction || "unknown";
      console.log(`[Celo x402] Transaction hash: ${transactionHash}`);

      // Record tip in database
      const isAgentTip = !!agentId;
      const source = isAgentTip ? "agent" : "human";

      const { data: tip, error: tipError } = await supabase
        .from("tips")
        .insert({
          creator_id: creator.id,
          from_address: result.paymentReceipt?.payer || "unknown",
          amount: amount,
          token: token,
          signature: transactionHash,
          source: source,
          status: "confirmed",
          chain: "celo",
          network: "celo-sepolia",
          is_agent_tip: isAgentTip,
          agent_reasoning: isAgentTip ? "Tipped via Celo x402 protocol" : null,
          metadata: {
            agent_id: agentId,
            content_url: contentUrl,
            protocol: "x402-celo",
            facilitator: "thirdweb",
          },
        })
        .select()
        .single();

      if (tipError) {
        console.error("[Celo x402] Failed to record tip:", tipError);
      } else {
        console.log(`[Celo x402] ✓ Tip recorded in database (ID: ${tip.id})`);
      }

      return NextResponse.json(
        {
          success: true,
          message: "Tip sent successfully!",
          amount: amount,
          token: token,
          chain: "celo",
          network: "celo-sepolia",
          transactionHash: transactionHash,
          creator: {
            slug: creator.slug,
            name: creator.name,
            wallet: creator.celo_wallet_address,
          },
        },
        {
          status: 200,
          headers: result.responseHeaders,
        }
      );
    } else {
      // No payment header - return 402 with payment requirements
      console.log("[Celo x402] No payment header, returning 402 payment requirements");
      console.log(`  Creator wallet (payTo): ${creator.celo_wallet_address}`);
      console.log(`  Server wallet (facilitator): ${THIRDWEB_SERVER_WALLET}`);

      const result = await settlePayment({
        resourceUrl,
        method: "GET",
        paymentData: null,
        payTo: creator.celo_wallet_address,
        network: celoSepolia,
        price: priceConfig,
        facilitator: thirdwebFacilitator,
        routeConfig: {
          description: `Tip ${creator.name} (@${creator.slug}) on BlinkTip`,
          mimeType: "application/json",
          maxTimeoutSeconds: 300,
        },
      });

      const responseBody = result.status === 200
        ? { success: true }
        : (result as any).responseBody;

      console.log("[Celo x402] 402 Response payTo:", (responseBody as any)?.accepts?.[0]?.payTo);
      console.log("[Celo x402] 402 Response facilitator:", (responseBody as any)?.accepts?.[0]?.extra?.facilitatorAddress);

      return NextResponse.json(responseBody, {
        status: result.status,
        headers: result.responseHeaders,
      });
    }
  } catch (error: unknown) {
    console.error("[Celo x402] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate payment requirements",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/x402/tip/[slug]/pay-celo?amount=X&token=USDC
 *
 * Verifies payment via thirdweb facilitator and records tip in database
 * Expects X-PAYMENT header with signed transaction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const amount = parseFloat(searchParams.get("amount") || "0");
    const token = searchParams.get("token") || "USDC";
    const agentId = searchParams.get("agent_id");
    const contentUrl = searchParams.get("content_url");

    // Get payment data from header
    const paymentData = request.headers.get("x-payment");

    if (!paymentData) {
      return NextResponse.json(
        { error: "Missing X-PAYMENT header" },
        { status: 400 }
      );
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Validate token
    if (!["USDC", "cUSD"].includes(token)) {
      return NextResponse.json(
        { error: "Unsupported token. Use USDC or cUSD" },
        { status: 400 }
      );
    }

    // Get creator info
    const { data: creator, error: creatorError } = await supabase
      .from("creators")
      .select("*")
      .eq("slug", slug)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Check if creator has Celo wallet
    if (!creator.celo_wallet_address) {
      return NextResponse.json(
        { error: "Creator does not accept tips on Celo" },
        { status: 400 }
      );
    }

    // Determine price config (same as GET)
    let priceConfig: any;

    if (token === "USDC") {
      priceConfig = {
        amount: (amount * 1_000_000).toString(),
        asset: {
          address: CELO_USDC_TOKEN,
          decimals: 6,
        },
      };
    } else if (token === "cUSD") {
      priceConfig = {
        amount: (amount * 1e18).toString(),
        asset: {
          address: CELO_CUSD_ADDRESS,
          decimals: 18,
        },
      };
    }

    // Construct resource URL
    const resourceUrl = `${request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`;

    console.log("[Celo x402] Settling payment...");
    console.log(`  Amount: ${amount} ${token}`);
    console.log(`  Creator: ${creator.slug} (${creator.celo_wallet_address})`);
    console.log(`  Agent: ${agentId || "human"}`);

    // Verify and settle payment via thirdweb facilitator
    const result = await settlePayment({
      resourceUrl,
      method: "POST",
      paymentData,
      payTo: creator.celo_wallet_address,
      network: celoSepolia,
      price: priceConfig,
      facilitator: thirdwebFacilitator,
      routeConfig: {
        description: `Tip ${creator.name} (@${creator.slug}) on BlinkTip`,
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
      },
    });

    // Check if payment was successful
    if (result.status !== 200) {
      console.error("[Celo x402] Payment failed:", (result as any).responseBody);
      return NextResponse.json((result as any).responseBody, {
        status: result.status,
        headers: result.responseHeaders,
      });
    }

    console.log("[Celo x402] ✓ Payment settled successfully");

    // Extract transaction hash from response
    // thirdweb's settlePayment returns paymentReceipt with transaction
    const transactionHash = result.paymentReceipt?.transaction || "unknown";

    console.log(`[Celo x402] Transaction hash: ${transactionHash}`);

    // Determine tip source and sender address
    const isAgentTip = !!agentId;
    const source = isAgentTip ? "agent" : "human";

    // For agent tips, use server wallet address
    // For human tips, extract from payment data (would need to decode)
    const fromAddress = isAgentTip
      ? THIRDWEB_SERVER_WALLET
      : "human-wallet-address"; // TODO: Extract from paymentData

    // Record tip in database
    const { data: tip, error: tipError } = await supabase
      .from("tips")
      .insert({
        creator_id: creator.id,
        from_address: fromAddress,
        amount: amount,
        token: token,
        signature: transactionHash,
        source: source,
        status: "confirmed", // thirdweb waits for confirmation
        chain: "celo",
        network: "celo-sepolia",
        is_agent_tip: isAgentTip,
        agent_reasoning: isAgentTip ? "Tipped via Celo x402 protocol" : null,
        metadata: {
          agent_id: agentId,
          content_url: contentUrl,
          protocol: "x402-celo",
          facilitator: "thirdweb",
        },
      })
      .select()
      .single();

    if (tipError) {
      console.error("[Celo x402] Failed to record tip:", tipError);
      // Don't fail the request - payment already went through
    } else {
      console.log(`[Celo x402] ✓ Tip recorded in database (ID: ${tip.id})`);

      // If agent tip, also record in agent_actions
      if (isAgentTip) {
        await supabase.from("agent_actions").insert({
          twitter_handle: creator.twitter_handle,
          content_url: contentUrl || `https://blinktip.com/tip/${creator.slug}`,
          content_title: creator.name,
          decision: "tip",
          tip_id: tip.id,
          reasoning: "Autonomous tip via Celo x402 protocol",
          chain: "celo",
          evaluation_score: null,
          content_source: "x402-celo",
          metadata: {
            agent_id: agentId,
            amount: amount,
            token: token,
            transaction_hash: transactionHash,
          },
        });
      }
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Tip sent successfully!",
        amount: amount,
        token: token,
        chain: "celo",
        network: "celo-sepolia",
        transactionHash: transactionHash,
        creator: {
          slug: creator.slug,
          name: creator.name,
          wallet: creator.celo_wallet_address,
        },
      },
      {
        status: 200,
        headers: result.responseHeaders,
      }
    );
  } catch (error: unknown) {
    console.error("[Celo x402] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to process payment",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
