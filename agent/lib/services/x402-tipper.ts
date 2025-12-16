/**
 * x402 Tipping Service for Agent
 *
 * Implements autonomous agent tipping via x402 protocol with proper Solana transaction structure.
 *
 * REQUIRED INSTRUCTIONS
 * 1. ComputeBudgetProgram.setComputeUnitLimit (up to 7000)
 * 2. ComputeBudgetProgram.setComputeUnitPrice (< 5 lamports)
 * 3. createTransferCheckedInstruction (SPL token transfer)
 *
 * PREREQUISITES:
 * - Merchant's ATA (Associated Token Account) must exist before x402 transaction
 * - This implementation creates ATA in separate transaction if needed
 *
 * Uses FacilitatorClient from x402-solana/server package.
 */

import { FacilitatorClient, type PaymentRequirements } from "x402-solana/server";
import { createPaymentHeaderFromTransaction } from "x402-solana/utils";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { CdpClient } from "@coinbase/cdp-sdk";
import { getOrCreateAgentWallet, getAgentBalance } from "./cdp-wallet";
import { supabase } from "@/lib/supabase";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const USDC_DEVNET_MINT = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

// Initialize clients
const cdp = new CdpClient();
const connection = new Connection(SOLANA_RPC_URL, "confirmed");
const facilitatorClient = new FacilitatorClient("https://facilitator.payai.network");

export interface X402TipResult {
  success: boolean;
  signature?: string;
  error?: string;
  amount?: number;
}

/**
 * Tip a creator via x402 protocol
 *
 * @param creatorSlug - Creator's slug 
 * @param amountUSDC - Tip amount in USDC
 * @param reason - AI reasoning for tip
 * @returns Tip result with transaction signature
 */
export async function tipCreatorViaX402(
  creatorSlug: string,
  amountUSDC: number,
  reason: string
): Promise<X402TipResult> {
  try {
    console.log(`[x402 Tipper] Tipping @${creatorSlug} via x402...`);
    console.log(`[x402 Tipper] Amount: $${amountUSDC} USDC`);
    console.log(`[x402 Tipper] Reason: ${reason}`);

    // Check agent balance first
    const balance = await getAgentBalance();
    if (balance.balanceUSDC < amountUSDC) {
      return {
        success: false,
        error: `Insufficient USDC. Have: $${balance.balanceUSDC.toFixed(2)}, Need: $${amountUSDC.toFixed(2)}`,
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
    const agentWallet = await getOrCreateAgentWallet();

    const x402Endpoint = `${BASE_URL}/api/x402/tip/${creatorSlug}/pay-solana?amount=${amountUSDC}&agent_id=blinktip_agent&content_url=https://twitter.com/${creator.twitter_handle}`;

    console.log(`[x402 Tipper] Fetching payment requirements...`);
    const requirementsResponse = await fetch(x402Endpoint, {
      method: "GET",
    });

    if (requirementsResponse.status !== 402) {
      return {
        success: false,
        error: `Expected 402 response, got ${requirementsResponse.status}`,
      };
    }

    const responseData = await requirementsResponse.json();
    const paymentRequirements: PaymentRequirements = responseData.accepts[0];

    console.log(`[x402 Tipper] Payment requirements received`);
    console.log(`[x402 Tipper] Max amount: ${paymentRequirements.maxAmountRequired} micro-USDC`);
    console.log(`[x402 Tipper] Pay to: ${paymentRequirements.payTo}`);

    // Get fee payer from payment requirements
    // Use extra.feePayer if available (facilitator), otherwise payTo (creator)
    const feePayerAddress = paymentRequirements.extra?.feePayer
      ? (paymentRequirements.extra.feePayer as string)
      : paymentRequirements.payTo;

    console.log(`[x402 Tipper] Fee payer: ${feePayerAddress}`);
    console.log(`[x402 Tipper] Fee payer source: ${paymentRequirements.extra?.feePayer ? 'facilitator (extra.feePayer)' : 'creator (payTo)'}`);

    // Step 3: Build Solana payment transaction
    const fromPubkey = new PublicKey(agentWallet.address);
    const toPubkey = new PublicKey(paymentRequirements.payTo); // Use payTo from requirements
    const feePayerPubkey = new PublicKey(feePayerAddress);
    const usdcMint = new PublicKey(USDC_DEVNET_MINT);

    const fromTokenAccount = await getAssociatedTokenAddress(usdcMint, fromPubkey);
    const toTokenAccount = await getAssociatedTokenAddress(usdcMint, toPubkey);

    // Use maxAmountRequired from payment requirements
    const tokenAmount = BigInt(paymentRequirements.maxAmountRequired);

    // Check if recipient token account exists, create if not before x402 transaction
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toAccountInfo) {
      console.log("[x402 Tipper] Creating token account for recipient first...");

      // Create a separate transaction to create the account
      const createAccountTx = new Transaction();
      createAccountTx.add(
        createAssociatedTokenAccountInstruction(
          fromPubkey, // payer
          toTokenAccount, // associated token address
          toPubkey, // owner
          usdcMint // mint
        )
      );

      const { blockhash: createBlockhash } = await connection.getLatestBlockhash();
      createAccountTx.recentBlockhash = createBlockhash;
      createAccountTx.feePayer = fromPubkey;

      // Serialize and sign with CDP
      const createTxSerialized = Buffer.from(
        createAccountTx.serialize({ requireAllSignatures: false })
      ).toString("base64");

      const createSignResult = await cdp.solana.signTransaction({
        address: agentWallet.address,
        transaction: createTxSerialized,
      });

      const createSignedTx = Buffer.from(createSignResult.signature, "base64");

      // Send and confirm
      const createTxSig = await connection.sendRawTransaction(createSignedTx);
      await connection.confirmTransaction(createTxSig);

      console.log("[x402 Tipper] ✓ Token account created");
    }

    // Build x402 payment transaction with the 3 required instructions
    const instructions = [];

    // 1. ComputeBudgetProgram.setComputeUnitLimit (up to 7000)
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 7000,
      })
    );

    // 2. ComputeBudgetProgram.setComputeUnitPrice (< 5 lamports)
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 4, // Less than 5 lamports as required
      })
    );

    // 3. TransferChecked instruction ie SPL token transfer with decimals)
    instructions.push(
      createTransferCheckedInstruction(
        fromTokenAccount,
        usdcMint,
        toTokenAccount,
        fromPubkey,
        tokenAmount,
        6, // USDC decimals
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Create versioned transaction with fee payer
    const messageV0 = new TransactionMessage({
      payerKey: feePayerPubkey, // Facilitator pays fees
      recentBlockhash: blockhash,
      instructions: instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    console.log(`[x402 Tipper] Transaction built with ${instructions.length} instruction(s)`);
    console.log(`[x402 Tipper] Instructions:`, instructions.map(i => i.programId.toString()));

    // Step 4: Sign transaction with CDP (agent wallet signs as sender)
    console.log(`[x402 Tipper] Signing transaction with CDP...`);
    const serializedTx = Buffer.from(transaction.serialize()).toString("base64");
    const signResult = await cdp.solana.signTransaction({
      address: agentWallet.address,
      transaction: serializedTx,
    });

    const signedTx = VersionedTransaction.deserialize(
      Buffer.from(signResult.signature, "base64")
    );

    console.log(`[x402 Tipper] Signed transaction has ${signedTx.message.compiledInstructions.length} compiled instructions`);

    // Step 5: Create payment header from signed transaction
    console.log(`[x402 Tipper] Creating payment header...`);
    const paymentHeader = createPaymentHeaderFromTransaction(
      signedTx,
      paymentRequirements,
      1 // x402 version
    );

    // Step 6: Verify payment with facilitator
    console.log(`[x402 Tipper] Verifying payment with facilitator...`);
    const verifyResult = await facilitatorClient.verifyPayment(
      paymentHeader,
      paymentRequirements
    );

    if (!verifyResult.isValid) {
      return {
        success: false,
        error: `Payment verification failed: ${verifyResult.invalidReason}`,
      };
    }

    console.log(`[x402 Tipper] ✓ Payment verified`);

    // Step 7: Settle payment with facilitator (this sends the transaction)
    console.log(`[x402 Tipper] Settling payment with facilitator...`);
    const settleResult = await facilitatorClient.settlePayment(
      paymentHeader,
      paymentRequirements
    );

    if (!settleResult.success) {
      return {
        success: false,
        error: `Payment settlement failed: ${settleResult.errorReason}`,
      };
    }

    console.log(`[x402 Tipper] ✓ Payment settled! TX: ${settleResult.transaction}`);

    // Step 8: Record tip in database (payment already settled by facilitator)
    console.log(`[x402 Tipper] Recording tip in database...`);
    try {
      // Get creator
      const { data: creatorData, error: creatorError } = await supabase
        .from('creators')
        .select('*')
        .eq('slug', creatorSlug)
        .single();

      if (creatorError || !creatorData) {
        console.log(`[x402 Tipper] ⚠️  Creator not found: ${creatorSlug}`);
        console.log(`[x402 Tipper] Note: Payment is already on-chain, so this is not critical`);
      } else {
        // Verify transaction on-chain
        let transactionExists = false;
        try {
          const tx = await connection.getTransaction(settleResult.transaction, {
            maxSupportedTransactionVersion: 0,
          });
          transactionExists = tx !== null && tx.meta?.err === null;
        } catch (error) {
          console.warn('[x402 Tipper] Could not verify transaction on-chain:', error);
        }

        const agentWalletAddress = '3igN8HVgmkvnNvnjyXPRJftSM6cQHENPzpRwgWGbYHKh'; // Agent's CDP wallet

        // Record tip in database
        const { data: tip, error: tipError } = await supabase
          .from('tips')
          .insert({
            creator_id: creatorData.id,
            from_address: agentWalletAddress,
            amount: amountUSDC,
            token: 'USDC',
            signature: settleResult.transaction,
            source: 'agent',
            status: transactionExists ? 'confirmed' : 'pending',
            is_agent_tip: true, // IMPORTANT: Mark as agent tip for stats
            agent_reasoning: reason,
            metadata: {
              network: 'solana-devnet',
              protocol: 'x402',
              agent_id: 'blinktip_agent',
              verified_on_chain: transactionExists,
            },
          })
          .select()
          .single();

        if (tipError) {
          console.error('[x402 Tipper] Failed to record tip:', tipError);
        } else {
          console.log(`[x402 Tipper] ✓ Tip recorded in database! Tip ID: ${tip.id}`);

          // Record agent decision
          await supabase.from('agent_actions').insert({
            twitter_handle: creatorData.twitter_handle,
            content_url: `https://twitter.com/${creatorData.twitter_handle}`,
            content_title: creatorData.name,
            decision: 'TIP', // Use uppercase 'TIP' to match check constraint
            tip_id: tip.id,
            reasoning: reason || 'Autonomous tip via x402',
            yaps_score_7d: null,
            yaps_score_30d: null,
            evaluation_score: null,
            content_source: 'x402',
            metadata: {
              agent_id: 'blinktip_agent',
              network: 'solana-devnet',
              amount: amountUSDC,
              signature: settleResult.transaction,
            },
          });

          console.log(`[x402 Tipper] ✓ Agent action recorded`);
        }
      }
    } catch (error: unknown) {
      console.log(`[x402 Tipper] ⚠️  Database recording error:`, error instanceof Error ? error.message : String(error));
      console.log(`[x402 Tipper] Note: Payment is already on-chain, so this is not critical`);
    }

    // Payment was settled successfully - return success regardless of platform recording
    return {
      success: true,
      signature: settleResult.transaction,
      amount: amountUSDC,
    };
  } catch (error: unknown) {
    console.error("[x402 Tipper] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
