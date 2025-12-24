/**
 * Test Script: Celo Wallet Integration
 */

import { getAgentBalanceCelo, getWalletInfo } from "../agent/lib/services/celo/thirdweb-wallet";

async function main() {
  console.log("=".repeat(60));
  console.log("Testing Celo Wallet Integration");
  console.log("=".repeat(60));
  console.log("");

  try {
    // Test 1: Get wallet info
    console.log("Test 1: Fetching Celo wallet info...\n");
    const walletInfo = await getWalletInfo();
    console.log(walletInfo);
    console.log("");

    // Test 2: Get detailed balances
    console.log("Test 2: Fetching detailed balances...\n");
    const balances = await getAgentBalanceCelo();

    console.log("Detailed Balance Information:");
    console.log(`  Wallet Address: ${balances.address}`);
    console.log(`  Block Number: ${balances.blockNumber}`);
    console.log("");
    console.log("  Balances:");
    console.log(`    CELO (native): ${balances.balanceCELO.toFixed(6)} CELO`);
    console.log(`    USDC: $${balances.balanceUSDC.toFixed(2)}`);
    console.log(`    cUSD: $${balances.balanceCUSD.toFixed(2)}`);
    console.log("");

    // Test 3: Check if can tip
    const minTipAmount = 0.1;
    const canTipUSDC = balances.balanceUSDC >= minTipAmount;
    const canTipCUSD = balances.balanceCUSD >= minTipAmount;

    console.log("Test 3: Tipping capacity check...\n");
    console.log(`  Minimum tip amount: $${minTipAmount}`);
    console.log(`  Can tip with USDC: ${canTipUSDC ? '✓ YES' : '✗ NO'}`);
    console.log(`  Can tip with cUSD: ${canTipCUSD ? '✓ YES' : '✗ NO'}`);

    if (canTipUSDC) {
      console.log(`  → Can send up to ${Math.floor(balances.balanceUSDC / minTipAmount)} USDC tips`);
    }
    if (canTipCUSD) {
      console.log(`  → Can send up to ${Math.floor(balances.balanceCUSD / minTipAmount)} cUSD tips`);
    }
    console.log("");

    // Funding instructions if low balance
    if (!canTipUSDC && !canTipCUSD) {
      console.log("⚠️  LOW BALANCE - Funding Instructions:");
      console.log("");
      console.log("Get Celo Sepolia testnet tokens:");
      console.log("   https://faucet.celo.org/alfajores (select Celo Sepolia)");
      console.log("");
      console.log("Your wallet address:");
      console.log(`   ${balances.address}`);
      console.log("");
      console.log("Request:");
      console.log("   - CELO (for gas fees - if needed)");
      console.log("   - cUSD (for tipping)");
      console.log("   - USDC (for tipping)");
      console.log("");
    }

    console.log("=".repeat(60));
    console.log("✓ All tests passed!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Error during tests:");
    console.error(error);
    process.exit(1);
  }
}

main();
