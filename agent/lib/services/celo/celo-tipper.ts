/**
 * Celo Tipping Service for Agent
 *
 * Implements autonomous agent tipping on Celo via x402 protocol using thirdweb.
 */

import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { privateKeyToAccount } from "thirdweb/wallets";
import { getAgentBalanceCelo, celoSepolia } from "./thirdweb-wallet";
import { supabase } from "@/lib/supabase";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY!;
const CELO_USDC_ADAPTER = process.env.CELO_USDC_ADAPTER!;


// using thirdweb's server wallet API directly

export interface CeloTipResult {
  success: boolean;
  signature?: string;
  error?: string;
  amount?: number;
  token?: string;
}

/**
 * Tip a creator on Celo via x402 protocol
 *
 * thirdweb's wrapFetchWithPayment to handle x402 flow automatically
 *
 * @param creatorSlug - Creator's slug
 * @param amountUSDC - Tip amount in USDC/cUSD
 * @param token - Token to use (USDC or cUSD)
 * @param reason - AI reasoning for tip
 * @returns Tip result with transaction signature
 */
export async function tipCreatorViaCeloX402(
  creatorSlug: string,
  amountUSDC: number,
  token: "USDC" | "cUSD" = "USDC",
  reason: string
): Promise<CeloTipResult> {
  try {
    console.log(`[Celo Tipper] Tipping @${creatorSlug} via Celo x402...`);
    console.log(`[Celo Tipper] Amount: $${amountUSDC} ${token}`);
    console.log(`[Celo Tipper] Reason: ${reason}`);

    // Check agent balance first
    const balance = await getAgentBalanceCelo();
    const requiredBalance = token === "USDC" ? balance.balanceUSDC : balance.balanceCUSD;

    if (requiredBalance < amountUSDC) {
      return {
        success: false,
        error: `Insufficient ${token}. Have: $${requiredBalance.toFixed(2)}, Need: $${amountUSDC.toFixed(2)}`,
      };
    }

    // Get creator info
    const creatorResponse = await fetch(`${BASE_URL}/api/creators?slug=${creatorSlug}`);
    if (!creatorResponse.ok) {
      return {
        success: false,
        error: "Creator not found",
      };
    }

    const { creator } = await creatorResponse.json();

    if (!creator.celo_wallet_address) {
      return {
        success: false,
        error: "Creator does not accept tips on Celo",
      };
    }

    // Construct x402 endpoint URL
    const x402Endpoint = `${BASE_URL}/api/x402/tip/${creatorSlug}/pay-celo?amount=${amountUSDC}&token=${token}&agent_id=blinktip_agent&content_url=https://twitter.com/${creator.twitter_handle}`;

    console.log(`[Celo Tipper] Calling x402 endpoint...`);

    // wrapFetchWithPayment requires a wallet with private key for signing
    

    // Use thirdweb's transaction API
    
    const result = await tipViaThirdwebAPI(
      x402Endpoint,
      creator,
      amountUSDC,
      token,
      reason
    );

    return result;
  } catch (error: unknown) {
    console.error("[Celo Tipper] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Alternative: Tip using thirdweb's transaction API directly
 *
 * This bypasses x402 and sends ERC20 transfer directly from server wallet
 */
async function tipViaThirdwebAPI(
  endpoint: string,
  creator: any,
  amount: number,
  token: "USDC" | "cUSD",
  reason: string
): Promise<CeloTipResult> {
  try {
    const THIRDWEB_SERVER_WALLET = process.env.THIRDWEB_SERVER_WALLET_ADDRESS!;
    const CELO_CHAIN_ID = process.env.CELO_CHAIN_ID!;

    // Determine token address and decimals
    const tokenAddress = token === "USDC"
      ? process.env.CELO_USDC_TOKEN!
      : process.env.CELO_CUSD_ADDRESS!;

    const decimals = token === "USDC" ? 6 : 18;
    const amountInBaseUnits = (amount * Math.pow(10, decimals)).toString();

    console.log(`[Celo Tipper] Preparing ERC20 transfer...`);
    console.log(`  Token: ${token} (${tokenAddress})`);
    console.log(`  Amount: ${amount} ${token} (${amountInBaseUnits} base units)`);
    console.log(`  To: ${creator.celo_wallet_address}`);

    // Call thirdweb transaction API to send ERC20 transfer
    const txResponse = await fetch("https://api.thirdweb.com/v1/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-secret-key": THIRDWEB_SECRET_KEY,
      },
      body: JSON.stringify({
        chainId: CELO_CHAIN_ID,
        from: THIRDWEB_SERVER_WALLET,
        transactions: [
          {
            to: tokenAddress,
            // ERC20 transfer(address to, uint256 amount)
            data: `0xa9059cbb000000000000000000000000${creator.celo_wallet_address.slice(2)}${BigInt(amountInBaseUnits).toString(16).padStart(64, '0')}`,
          },
        ],
      }),
    });

    if (!txResponse.ok) {
      const errorData = await txResponse.json();
      console.error("[Celo Tipper] Transaction API error:", errorData);
      return {
        success: false,
        error: `Transaction failed: ${errorData.message || "Unknown error"}`,
      };
    }

    const txData = await txResponse.json();
    const transactionHash = txData.result?.transactionHash || txData.transactionHash;

    if (!transactionHash) {
      console.error("[Celo Tipper] No transaction hash in response:", txData);
      return {
        success: false,
        error: "No transaction hash returned",
      };
    }

    console.log(`[Celo Tipper] ✓ Transaction sent: ${transactionHash}`);

    // Record tip in database
    try {
      const { data: creatorData, error: creatorError } = await supabase
        .from("creators")
        .select("*")
        .eq("celo_wallet_address", creator.celo_wallet_address)
        .single();

      if (creatorError || !creatorData) {
        console.log(`[Celo Tipper] ⚠️ Creator not found in database`);
      } else {
        // Record tip
        const { data: tip, error: tipError } = await supabase
          .from("tips")
          .insert({
            creator_id: creatorData.id,
            from_address: THIRDWEB_SERVER_WALLET,
            amount: amount,
            token: token,
            signature: transactionHash,
            source: "agent",
            status: "confirmed",
            chain: "celo",
            network: "celo-sepolia",
            is_agent_tip: true,
            agent_reasoning: reason,
            metadata: {
              network: "celo-sepolia",
              protocol: "thirdweb-direct",
              agent_id: "blinktip_agent",
            },
          })
          .select()
          .single();

        if (tipError) {
          console.error("[Celo Tipper] Failed to record tip:", tipError);
        } else {
          console.log(`[Celo Tipper] ✓ Tip recorded in database! Tip ID: ${tip.id}`);

          // Record agent decision
          await supabase.from("agent_actions").insert({
            twitter_handle: creatorData.twitter_handle,
            content_url: `https://twitter.com/${creatorData.twitter_handle}`,
            content_title: creatorData.name,
            decision: "tip",
            tip_id: tip.id,
            reasoning: reason || "Autonomous tip on Celo",
            chain: "celo",
            yaps_score_7d: null,
            yaps_score_30d: null,
            evaluation_score: null,
            content_source: "celo-direct",
            metadata: {
              agent_id: "blinktip_agent",
              network: "celo-sepolia",
              amount: amount,
              token: token,
              signature: transactionHash,
            },
          });

          console.log(`[Celo Tipper] ✓ Agent action recorded`);
        }
      }
    } catch (error: unknown) {
      console.log(`[Celo Tipper] ⚠️ Database recording error:`, error instanceof Error ? error.message : String(error));
    }

    return {
      success: true,
      signature: transactionHash,
      amount: amount,
      token: token,
    };
  } catch (error: unknown) {
    console.error("[Celo Tipper] tipViaThirdwebAPI error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get Celo tipping status
 */
export async function getCeloTippingStatus(): Promise<{
  enabled: boolean;
  balance: number;
  currency: string;
}> {
  try {
    const balance = await getAgentBalanceCelo();
    return {
      enabled: balance.balanceUSDC > 0 || balance.balanceCUSD > 0,
      balance: Math.max(balance.balanceUSDC, balance.balanceCUSD),
      currency: balance.balanceUSDC > balance.balanceCUSD ? "USDC" : "cUSD",
    };
  } catch (error) {
    return {
      enabled: false,
      balance: 0,
      currency: "USDC",
    };
  }
}

