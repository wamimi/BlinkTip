/**
 * CDP Server-Side Wallet Service for Autonomous Agent
 */

import { CdpClient } from "@coinbase/cdp-sdk";
import {
  Connection,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Initialize CDP client
const cdp = new CdpClient();

// Solana connection
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC_URL, "confirmed");

// USDC Mint on Solana Devnet
const USDC_MINT = new PublicKey(
  "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
)

export interface AgentWalletInfo {
  address: string;
  balanceSOL: number;
  balanceUSDC: number;
  canTip: boolean;
}

export interface TipResult {
  success: boolean;
  signature?: string;
  error?: string;
  amount?: number;
  recipient?: string;
}

export async function getOrCreateAgentWallet() {
  try {
    const account = await cdp.solana.getOrCreateAccount({ name: "blinktip-agent" });
    console.log(`[CDP Wallet] Agent wallet: ${account.address}`);
    return account;
  } catch (error) {
    console.error("[CDP Wallet] Error creating/getting agent wallet:", error);
    throw error;
  }
}

/**
 * Get agent wallet balance (both SOL and USDC)
 */
export async function getAgentBalance(): Promise<AgentWalletInfo> {
  try {
    const account = await getOrCreateAgentWallet();
    const pubkey = new PublicKey(account.address);

    // Get SOL balance
    const balanceLamports = await connection.getBalance(pubkey);
    const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;

    // Get USDC balance
    let balanceUSDC = 0;
    try {
      const usdcTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        pubkey
      );
      const tokenAccountInfo = await connection.getTokenAccountBalance(
        usdcTokenAccount
      );
      balanceUSDC = Number(tokenAccountInfo.value.uiAmount || 0);
    } catch (error) {
      // Token account doesn't exist yet - that's okay
      console.log("[CDP Wallet] No USDC token account yet");
    }

    return {
      address: account.address,
      balanceSOL,
      balanceUSDC,
      canTip: balanceUSDC >= 0.01, // Need at least $0.01 USDC
    };
  } catch (error) {
    console.error("[CDP Wallet] Error getting balance:", error);
    throw error;
  }
}

/**
 * Send USDC tip to a creator
 *
 * @param creatorWallet - Creator's Solana wallet address
 * @param amountUSDC - Amount in USDC (e.g., 0.10 for 10 cents)
 * @param reason - Why the agent is tipping
 */
export async function sendUSDCTip(
  creatorWallet: string,
  amountUSDC: number,
  reason: string
): Promise<TipResult> {
  try {
    console.log(
      `[CDP Wallet] Sending ${amountUSDC} USDC to ${creatorWallet}`
    );
    console.log(`[CDP Wallet] Reason: ${reason}`);

    // Get agent account
    const account = await getOrCreateAgentWallet();
    const fromPubkey = new PublicKey(account.address);
    const toPubkey = new PublicKey(creatorWallet);

    // Check balance
    const walletInfo = await getAgentBalance();
    if (walletInfo.balanceUSDC < amountUSDC) {
      return {
        success: false,
        error: `Insufficient USDC. Have: $${walletInfo.balanceUSDC.toFixed(
          2
        )}, Need: $${amountUSDC.toFixed(2)}`,
      };
    }

    // Get associated token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      fromPubkey
    );
    const toTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      toPubkey
    );

    // Convert USDC amount to token amount (6 decimals for USDC)
    const tokenAmount = Math.floor(amountUSDC * 1_000_000);

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Create transfer transaction
    const transaction = new Transaction();

    // Check if recipient token account exists, create if not
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toAccountInfo) {
      console.log("[CDP Wallet] Creating token account for recipient...");
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromPubkey, // payer
          toTokenAccount, // associated token address
          toPubkey, // owner
          USDC_MINT // mint
        )
      );
    }

    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        tokenAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Serialize transaction
    const serializedTx = Buffer.from(
      transaction.serialize({ requireAllSignatures: false })
    ).toString("base64");

    // Sign transaction using CDP
    const { signature: signedTxBase64 } = await cdp.solana.signTransaction({
      address: account.address,
      transaction: serializedTx,
    });

    // Decode signed transaction
    const decodedSignedTx = Buffer.from(signedTxBase64, "base64");

    // Send transaction
    console.log("[CDP Wallet] Sending transaction...");
    const txSignature = await connection.sendRawTransaction(decodedSignedTx);

    // Wait for confirmation
    console.log("[CDP Wallet] Waiting for confirmation...");
    const latestBlockhash = await connection.getLatestBlockhash();
    const confirmation = await connection.confirmTransaction({
      signature: txSignature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
    }

    console.log(
      `[CDP Wallet] ✓ Tipped $${amountUSDC} USDC to ${creatorWallet}`
    );
    console.log(
      `[CDP Wallet] Transaction: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
    );

    return {
      success: true,
      signature: txSignature,
      amount: amountUSDC,
      recipient: creatorWallet,
    };
  } catch (error: any) {
    console.error("[CDP Wallet] Tip failed:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Request SOL from devnet faucet
 */
export async function requestDevnetSOL(): Promise<boolean> {
  try {
    const account = await getOrCreateAgentWallet();

    console.log("[CDP Wallet] Requesting SOL from devnet faucet...");
    const faucetResult = await cdp.solana.requestFaucet({
      address: account.address,
      token: "sol",
    });

    console.log(
      `[CDP Wallet] Faucet request sent: https://explorer.solana.com/tx/${faucetResult.signature}?cluster=devnet`
    );

    // Wait a bit for funds to arrive
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return true;
  } catch (error) {
    console.error("[CDP Wallet] Faucet request failed:", error);
    return false;
  }
}
