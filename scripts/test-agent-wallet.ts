/**
 * Test script for CDP Agent Wallet
 *
 * Tests:
 * - CDP wallet creation
 * - Balance checking
 * - Wallet address generation
 */

import { getOrCreateAgentWallet, getAgentBalance, requestDevnetSOL } from "../agent/lib/services/cdp-wallet";

async function main() {
  console.log("\n Testing CDP Agent Wallet...\n");

  try {
    // Test 1: Create/Get Wallet
    console.log("Test 1: Creating/getting agent wallet...");
    const wallet = await getOrCreateAgentWallet();
    console.log(`✓ Wallet Address: ${wallet.address}`);
    console.log(`  Explorer: https://explorer.solana.com/address/${wallet.address}?cluster=devnet\n`);

    // Test 2: Check Balance
    console.log("Test 2: Checking wallet balance...");
    const balance = await getAgentBalance();
    console.log(`✓ SOL Balance: ${balance.balanceSOL.toFixed(4)} SOL`);
    console.log(`✓ USDC Balance: $${balance.balanceUSDC.toFixed(2)} USDC`);
    console.log(`✓ Can Tip: ${balance.canTip ? "Yes" : "No"}`);

    if (balance.balanceUSDC > 0) {
      const potentialTips = Math.floor(balance.balanceUSDC / 0.1);
      console.log(`✓ Potential Tips: ${potentialTips} (at $0.10 each)\n`);
    } else {
      console.log(`  No USDC balance. Fund the wallet to enable tipping.\n`);
    }

    // Test 3: Request SOL (for gas fees)
    if (balance.balanceSOL < 0.1) {
      console.log("Test 3: Requesting SOL from devnet faucet...");
      const faucetSuccess = await requestDevnetSOL();
      if (faucetSuccess) {
        console.log("✓ SOL faucet request sent\n");
      } else {
        console.log(" Faucet request failed\n");
      }
    } else {
      console.log("Test 3: Skipping faucet (sufficient SOL balance)\n");
    }

    // Summary
    console.log(" Summary");
    console.log("─────────────────────────────");
    console.log(`Wallet: ${wallet.address}`);
    console.log(`SOL: ${balance.balanceSOL.toFixed(4)}`);
    console.log(`USDC: $${balance.balanceUSDC.toFixed(2)}`);
    console.log(`Status: ${balance.canTip ? "✓ Ready to tip" : "⚠️  Needs USDC funding"}`);
    console.log("\nAll tests passed!\n");

    if (!balance.canTip) {
      console.log("To fund the agent:");
      console.log(`   1. Send USDC devnet tokens to: ${wallet.address}`);
      console.log("   2. Or use the x402 funding endpoint:");
      console.log("      POST http://localhost:3000/api/x402/fund-agent?amount=1.0\n");
    }

  } catch (error) {
    console.error("\n Test failed:", error);
    process.exit(1);
  }
}

main();
