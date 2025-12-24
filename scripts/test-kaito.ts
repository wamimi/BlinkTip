/**
 * Test script for Kaito Yaps API
 */

import { getYapsScore, analyzeYapsScore, meetsYapsThreshold } from "../agent/lib/services/kaito";

async function main() {
  console.log("\n Testing Kaito Yaps API...\n");

  // Test usernames (crypto influencers)
  const testUsers = ["vitalikbuterin", "SBF_FTX", "CZ_Binance"];

  try {
    for (const username of testUsers) {
      console.log(`\n--- Testing @${username} ---`);

      // Fetch Yaps score
      const score = await getYapsScore(username);

      if (!score) {
        console.log(`Failed to fetch Yaps score for @${username}`);
        continue;
      }

      // Display scores
      console.log(`User ID: ${score.userId}`);
      console.log(`Username: @${score.username}`);
      console.log(`\nYaps Scores:`);
      console.log(`  24h:     ${score.yaps24h.toFixed(2)}`);
      console.log(`  7d:      ${score.yaps7d.toFixed(2)}`);
      console.log(`  30d:     ${score.yaps30d.toFixed(2)}`);
      console.log(`  All-time: ${score.yapsAll.toFixed(2)}`);

      // Analyze trend
      const analysis = analyzeYapsScore(score);
      console.log(`\nAnalysis:`);
      console.log(`  Trend:          ${analysis.trend}`);
      console.log(`  Priority:       ${analysis.priority}`);
      console.log(`  Recommendation: ${analysis.recommendation}`);

      // Check threshold
      const meetsThreshold = meetsYapsThreshold(score, 10);
      console.log(`  Meets Threshold (≥10): ${meetsThreshold ? "✓ Yes" : "✗ No"}`);

      // Wait between requests (respect rate limits)
      if (username !== testUsers[testUsers.length - 1]) {
        console.log("\n⏳ Waiting 3 seconds (rate limit)...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    console.log("\n✅ All tests passed!\n");
  } catch (error) {
    console.error("\n Test failed:", error);
    process.exit(1);
  }
}

main();
