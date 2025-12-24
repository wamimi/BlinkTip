/**
 * Thirdweb Server Wallet Service for Celo
 */

import { createThirdwebClient, defineChain } from "thirdweb";
import { getRpcClient, eth_getBalance, eth_blockNumber } from "thirdweb/rpc";

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY!;
const THIRDWEB_SERVER_WALLET = process.env.THIRDWEB_SERVER_WALLET_ADDRESS!;
const CELO_CHAIN_ID = parseInt(process.env.CELO_CHAIN_ID || "11142220");
const CELO_RPC_URL = process.env.CELO_RPC_URL!;
const CELO_USDC_TOKEN = process.env.CELO_USDC_TOKEN!;
const CELO_CUSD_ADDRESS = process.env.CELO_CUSD_ADDRESS!;

// Initialize thirdweb client (singleton)
let thirdwebClient: ReturnType<typeof createThirdwebClient> | null = null;

export function getThirdwebClient() {
  if (!thirdwebClient) {
    thirdwebClient = createThirdwebClient({
      secretKey: THIRDWEB_SECRET_KEY,
    });
  }
  return thirdwebClient;
}

// Define Celo Sepolia chain
export const celoSepolia = defineChain({
  id: CELO_CHAIN_ID,
  rpc: CELO_RPC_URL,
});

/**
 * Get the agent's server wallet address
 */
export function getServerWalletAddress(): string {
  return THIRDWEB_SERVER_WALLET;
}

/**
 * Get agent wallet balances on Celo
 * Returns balances for native token (CELO) and stablecoins (USDC, cUSD)
 */
export async function getAgentBalanceCelo(): Promise<{
  address: string;
  balanceCELO: number;
  balanceUSDC: number;
  balanceCUSD: number;
  blockNumber: number;
}> {
  try {
    const client = getThirdwebClient();
    const walletAddress = THIRDWEB_SERVER_WALLET;

    console.log(`[Celo Wallet] Fetching balances for: ${walletAddress}`);

    // Get RPC client for the chain
    const rpcRequest = getRpcClient({ client, chain: celoSepolia });

    // Get native CELO balance
    const celoBalance = await eth_getBalance(rpcRequest, {
      address: walletAddress as `0x${string}`,
    });

    // Get current block number
    const blockNumber = await eth_blockNumber(rpcRequest);

    // Get ERC20 token balances via direct RPC calls
    let usdcBalance = BigInt(0);
    let cusdBalance = BigInt(0);

    try {
      // Use public RPC for ERC20 balance queries (more reliable)
      const publicRpc = "https://forno.celo-sepolia.celo-testnet.org";

      // Query USDC balance (6 decimals)
      const usdcResult = await fetch(publicRpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: CELO_USDC_TOKEN,
              data: `0x70a08231000000000000000000000000${walletAddress.slice(2).toLowerCase()}`,
            },
            "latest",
          ],
          id: 1,
        }),
      });
      const usdcData = await usdcResult.json();
      if (usdcData.result && usdcData.result !== "0x") {
        usdcBalance = BigInt(usdcData.result);
      }

      // Query cUSD balance (18 decimals)
      const cusdResult = await fetch(publicRpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: CELO_CUSD_ADDRESS,
              data: `0x70a08231000000000000000000000000${walletAddress.slice(2).toLowerCase()}`,
            },
            "latest",
          ],
          id: 2,
        }),
      });
      const cusdData = await cusdResult.json();
      if (cusdData.result && cusdData.result !== "0x") {
        cusdBalance = BigInt(cusdData.result);
      }
    } catch (error) {
      console.warn("[Celo Wallet] Failed to fetch token balances:", error);
    }

    // Convert to human-readable amounts
    const balanceCELO = Number(celoBalance) / 1e18;
    const balanceUSDC = Number(usdcBalance) / 1e6; // 6 decimals
    const balanceCUSD = Number(cusdBalance) / 1e18; // 18 decimals

    console.log("[Celo Wallet] Balances:");
    console.log(`  CELO: ${balanceCELO.toFixed(4)} CELO`);
    console.log(`  USDC: $${balanceUSDC.toFixed(2)}`);
    console.log(`  cUSD: $${balanceCUSD.toFixed(2)}`);
    console.log(`  Block: ${blockNumber}`);

    return {
      address: walletAddress,
      balanceCELO,
      balanceUSDC,
      balanceCUSD,
      blockNumber: Number(blockNumber),
    };
  } catch (error: unknown) {
    console.error("[Celo Wallet] Error fetching balances:", error);
    throw new Error(
      `Failed to get Celo wallet balance: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if agent wallet has sufficient balance for a tip
 */
export async function hasSufficientBalance(
  amount: number,
  token: "USDC" | "cUSD" | "CELO"
): Promise<boolean> {
  const balances = await getAgentBalanceCelo();

  switch (token) {
    case "USDC":
      return balances.balanceUSDC >= amount;
    case "cUSD":
      return balances.balanceCUSD >= amount;
    case "CELO":
      return balances.balanceCELO >= amount;
    default:
      return false;
  }
}

/**
 * Get wallet info summary
 */
export async function getWalletInfo(): Promise<string> {
  try {
    const balances = await getAgentBalanceCelo();
    return `
Celo Server Wallet: ${balances.address}
├─ CELO: ${balances.balanceCELO.toFixed(4)} CELO
├─ USDC: $${balances.balanceUSDC.toFixed(2)}
├─ cUSD: $${balances.balanceCUSD.toFixed(2)}
└─ Block: ${balances.blockNumber}
    `.trim();
  } catch (error) {
    return `Error fetching Celo wallet info: ${error instanceof Error ? error.message : String(error)}`;
  }
}
