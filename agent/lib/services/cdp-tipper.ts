/**
 * CDP Direct Tipping Service for Agent
 *
 * This service handles direct USDC transfers from the agent's CDP wallet to creators.
 */

import { getOrCreateAgentWallet, sendUSDCTip } from "./cdp-wallet";

export interface CDPTipResult {
  success: boolean;
  signature?: string;
  error?: string;
  amount?: number;
  recipient?: string;
}

/**
 * Tip a creator via direct CDP wallet transfer
 *
 * @param creatorWallet - Creator's Solana wallet address
 * @param amountUSDC - Tip amount in USDC
 * @param reason - AI reasoning for tip
 * @returns Tip result with transaction signature
 */
export async function tipCreatorViaCDP(
  creatorWallet: string,
  amountUSDC: number,
  reason: string
): Promise<CDPTipResult> {
  console.log(`[CDP Tipper] Tipping creator via CDP wallet...`);
  console.log(`[CDP Tipper] Recipient: ${creatorWallet}`);
  console.log(`[CDP Tipper] Amount: $${amountUSDC} USDC`);
  console.log(`[CDP Tipper] Reason: ${reason}`);

  try {
    // Use the CDP wallet service to send USDC
    const result = await sendUSDCTip(creatorWallet, amountUSDC, reason);

    if (result.success) {
      console.log(`[CDP Tipper] ✓ Tip successful!`);
      console.log(`[CDP Tipper] Transaction: ${result.signature}`);
    } else {
      console.log(`[CDP Tipper] ✗ Tip failed: ${result.error}`);
    }

    return result;
  } catch (error: any) {
    console.error("[CDP Tipper] Error:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}
