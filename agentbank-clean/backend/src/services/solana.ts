// solana.ts — Solana read-only queries (backend never signs anything)

import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";

const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");
export const connection = new Connection(RPC_URL, "confirmed");

export async function getBalance(walletAddress: string): Promise<{ sol: number; lamports: number }> {
  try {
    const pubkey   = new PublicKey(walletAddress);
    const lamports = await connection.getBalance(pubkey);
    return { sol: lamports / LAMPORTS_PER_SOL, lamports };
  } catch {
    return { sol: 0, lamports: 0 };
  }
}

export function isValidSolanaAddress(address: string): boolean {
  try { new PublicKey(address); return true; } catch { return false; }
}

export async function getOnChainHistory(walletAddress: string, limit = 10) {
  try {
    const pubkey     = new PublicKey(walletAddress);
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit });
    return signatures.map((s) => ({ txHash: s.signature, slot: s.slot, blockTime: s.blockTime, err: s.err }));
  } catch {
    return [];
  }
}

// Verify a txHash is real on-chain before tracking spend
export async function verifyTransaction(txHash: string): Promise<{ verified: boolean; blockTime?: number; fee?: number }> {
  try {
    const tx = await connection.getTransaction(txHash, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) return { verified: false };
    return {
      verified:  true,
      blockTime: tx.blockTime ?? undefined,
      fee:       tx.meta?.fee ? tx.meta.fee / LAMPORTS_PER_SOL : undefined,
    };
  } catch {
    return { verified: false };
  }
}
